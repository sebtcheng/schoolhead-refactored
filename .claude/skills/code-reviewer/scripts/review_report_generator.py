#!/usr/bin/env python3
"""
Review Report Generator

Runs pr_analyzer and code_quality_checker on the same scope (or loads their
saved --json output) and writes one markdown review report: provisional
verdict, riskiest files, findings by severity and a manual checklist tailored
to the areas the change touches. The verdict is a starting point: the reviewer
confirms or dismisses each finding before sharing the report.
"""

import argparse
import fnmatch
import json
import sys
from collections import OrderedDict
from datetime import date
from pathlib import Path
from typing import Dict, List

from _common import SEVERITIES, force_utf8_output, write_output
from code_quality_checker import CodeQualityChecker, select_files
from pr_analyzer import PrAnalyzer

# Manual checks per risk area: things static rules cannot decide.
CHECKLIST = OrderedDict([
    ("auth", [
        "Every new or changed route checks the session/token AND that this user may access this school/record (not just that they are logged in).",
        "Passwords/passcodes are hashed with bcrypt (cost >= 10); comparisons use bcrypt.compare, never ==.",
        "Login, passcode and reset endpoints are rate-limited and do not reveal whether an account exists.",
        "Tokens have an expiry; logout/reset invalidates them server-side where it matters.",
    ]),
    ("api-routes", [
        "Request bodies and params are validated (zod or explicit checks) before use.",
        "Errors return a generic message to the client; details go to the server log.",
        "Multi-step writes run in one transaction (BEGIN/COMMIT/ROLLBACK) and release the client in finally.",
        "Responses only include the fields the UI needs (no password hashes, internal ids, raw rows).",
    ]),
    ("data-access", [
        "All values reach SQL as $1/$2 parameters or through Drizzle builders; dynamic column/table names come from an allowlist.",
        "No query per item in a loop; list endpoints have a LIMIT/pagination.",
        "pool.connect() clients are always released (finally { client.release() }).",
    ]),
    ("db-schema", [
        "Migrations are additive or have a backfill/rollback plan; nothing drops data in use.",
        "New WHERE/JOIN/ORDER BY columns have indexes; Drizzle schema matches the live table.",
        "Drizzle schema files and the SQL that actually runs agree on column names and types.",
    ]),
    ("secrets-config", [
        "No credentials, connection strings or keys in committed files; .env* stays in .gitignore.",
        "Deploy/config changes were tested on staging; production values are not hardcoded as fallbacks.",
    ]),
    ("dependencies", [
        "New packages are needed, maintained and licensed acceptably; lockfile updated with the same package manager.",
        "`pnpm audit` shows no new high/critical advisories.",
    ]),
    ("frontend", [
        "Loading, empty and error states are handled; failed saves are visible to the user.",
        "useEffect dependencies are correct; no state set during render; effects clean up timers/listeners.",
        "Works on mobile width; no user data rendered as raw HTML.",
    ]),
])
ALWAYS = [
    "The change does what the ticket/PR description says, including edge cases (empty lists, missing school, network failure).",
    "Tests cover the new behavior, or the PR says how it was verified.",
]


def provisional_verdict(counts: Dict[str, int]) -> str:
    if counts.get("critical") or counts.get("high"):
        return "Request changes"
    if counts.get("medium"):
        return "Approve with comments"
    return "Approve"


def build_report(pr: Dict, quality: Dict, excludes: List[str], top: int, medium_per_rule: int) -> str:
    files = pr["files"]
    if excludes:
        files = [f for f in files if not any(fnmatch.fnmatch(f["path"], g) for g in excludes)]
    findings = quality["findings"]
    counts = {s: 0 for s in SEVERITIES}
    for f in findings:
        counts[f["severity"]] += 1
    s = pr["summary"]
    lines_added = sum(f["added"] for f in files)
    lines_deleted = sum(f["deleted"] for f in files)
    verdict = provisional_verdict(counts)
    touched = {c for f in files for c in f["categories"]}

    out = [
        f"# Code review: `{pr['branch']}` → `{pr['base']}`",
        "",
        f"_Generated {date.today().isoformat()} at {pr['head']} by the code-reviewer skill. "
        "Findings are automated heuristics: each one must be confirmed in the code before it is acted on._",
        "",
        f"**Provisional verdict: {verdict}**",
        "",
        "| | |",
        "|---|---|",
        f"| Commits | {len(pr['commits'])} |",
        f"| Files changed | {len(files)}" + (f" (of {s['files_changed']}; excluded: {', '.join(excludes)})" if excludes else "") + " |",
        f"| Lines | +{lines_added} / -{lines_deleted} |",
        f"| Files checked by rules | {quality['files_checked']} |",
        "| Findings | " + ", ".join(f"{counts[k]} {k}" for k in SEVERITIES if counts[k]) + " |",
        "",
    ]

    warnings = [w for w in pr["warnings"]
                if not (w.get("path") and excludes and any(fnmatch.fnmatch(w["path"], g) for g in excludes))]
    if excludes:  # PR-wide size warning was computed before exclusion; restate it for the reviewed scope
        warnings = [w for w in warnings if not w["message"].startswith("Large change")]
        if lines_added + lines_deleted > 1000:
            warnings.insert(0, {"severity": "medium",
                                "message": f"Large change: {lines_added + lines_deleted} lines across {len(files)} "
                                           "files in scope. Review quality drops sharply past ~400 lines; consider splitting."})
    if warnings or quality["notes"]:
        out += ["## PR-level issues", ""]
        for w in warnings:
            where = f"`{w['path']}`: " if w.get("path") else ""
            out.append(f"- **{w['severity']}** {where}{w['message']}")
        for n in quality["notes"]:
            out.append(f"- **note** {n}")
        out.append("")

    out += [f"## Review these files first", "",
            "| Risk | File | Change | Areas |", "|---:|---|---|---|"]
    for f in files[:top]:
        out.append(f"| {f['risk_score']} | `{f['path']}` | {f['status']} +{f['added']}/-{f['deleted']} | {', '.join(f['categories'])} |")
    out.append("")

    for sev in ("critical", "high"):
        items = [f for f in findings if f["severity"] == sev]
        if not items:
            continue
        out += [f"## {sev.capitalize()} ({len(items)})", ""]
        for f in items:
            out.append(f"- [ ] **{f['rule']}** `{f['file']}:{f['line']}` {f['message']}")
            if f.get("snippet"):
                out.append(f"  - Code: `{f['snippet'].replace('`', "'")}`")
            out.append(f"  - Fix: {f['fix']}")
        out.append("")

    for sev in ("medium", "low", "info"):
        items = [f for f in findings if f["severity"] == sev]
        if not items:
            continue
        by_rule: Dict[str, List[Dict]] = OrderedDict()
        for f in sorted(items, key=lambda x: x["rule"]):
            by_rule.setdefault(f["rule"], []).append(f)
        out += [f"## {sev.capitalize()} ({len(items)})", ""]
        for rule, group in sorted(by_rule.items(), key=lambda kv: -len(kv[1])):
            out.append(f"- **{rule}** ({len(group)}): {group[0]['message']} Fix: {group[0]['fix']}")
            if sev == "medium":
                for f in group[:medium_per_rule]:
                    out.append(f"  - `{f['file']}:{f['line']}`")
                if len(group) > medium_per_rule:
                    out.append(f"  - ...and {len(group) - medium_per_rule} more")
        out.append("")

    out += ["## Manual checklist", "",
            "Static rules cannot judge these; tick them while reading the high-risk files.", ""]
    for area, items in CHECKLIST.items():
        if area in touched or (area == "auth" and "api-routes" in touched):
            out.append(f"**{area}**")
            out += [f"- [ ] {i}" for i in items]
            out.append("")
    out += ["**always**"] + [f"- [ ] {i}" for i in ALWAYS] + [""]
    return "\n".join(out)


def main():
    force_utf8_output()
    parser = argparse.ArgumentParser(description="Write a markdown code review report for the current branch.")
    parser.add_argument("target", nargs="?", default=".", help="Repo path (or a subfolder to limit the review to)")
    parser.add_argument("--base", help="Branch the PR targets (default: origin/HEAD, main or master)")
    parser.add_argument("--exclude", action="append", default=[], metavar="GLOB",
                        help="Leave repo-relative paths matching this glob out of the review (repeatable)")
    parser.add_argument("--all-files", action="store_true", help="Check every file under target, not only changed files")
    parser.add_argument("--no-eslint", action="store_true", help="Skip ESLint")
    parser.add_argument("--pr-json", help="Use saved pr_analyzer.py --json output instead of running it")
    parser.add_argument("--quality-json", help="Use saved code_quality_checker.py --json output instead of running it")
    parser.add_argument("--top", type=int, default=20, help="How many risky files to list")
    parser.add_argument("--medium-per-rule", type=int, default=10, help="Locations listed per medium rule")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print progress to stderr")
    parser.add_argument("--json", action="store_true", help="Output the combined data as JSON instead of markdown")
    parser.add_argument("--output", "-o", help="Write the report to this file instead of stdout")
    args = parser.parse_args()

    try:
        if args.pr_json:
            pr = json.loads(Path(args.pr_json).read_text(encoding="utf-8"))
        else:
            pr = PrAnalyzer(args.target, base=args.base, verbose=args.verbose).run()
        if args.quality_json:
            quality = json.loads(Path(args.quality_json).read_text(encoding="utf-8"))
        else:
            files = select_files(Path(args.target).resolve(), not args.all_files, pr["base"], args.exclude)
            quality = CodeQualityChecker(args.target, verbose=args.verbose, files=files,
                                         use_eslint=not args.no_eslint).run()
    except (ValueError, RuntimeError, OSError, json.JSONDecodeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    if args.json:
        counts = quality["counts"]
        text = json.dumps({"verdict": provisional_verdict(counts), "pr": pr, "quality": quality}, indent=2)
    else:
        text = build_report(pr, quality, args.exclude, args.top, args.medium_per_rule)
    write_output(text, args.output)


if __name__ == "__main__":
    main()
