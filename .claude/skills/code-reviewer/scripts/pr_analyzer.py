#!/usr/bin/env python3
"""
PR Analyzer

Scopes a review: diffs the current branch (plus uncommitted work) against the
merge base with a target branch, classifies every changed file by risk area,
and flags PR-level problems (size, committed secrets, build output, missing
tests). Run this first so review time goes to the riskiest files.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

from _common import (
    default_base, force_utf8_output, repo_root, run_git, write_output,
)

# (category, weight, path regex, added-line regex or None)
RISK_RULES = [
    ("auth", 5,
     re.compile(r"(auth|login|logout|passcode|password|session|jwt|token|permission|role|middleware)", re.I),
     re.compile(r"(jwt\.(sign|verify|decode)|bcrypt\.|passcode|req\.user\b|verifyIdToken|headers\.authorization|['\"]authorization['\"])", re.I)),
    ("secrets-config", 4,
     re.compile(r"(^|/)(\.env[^/]*|.*\.(pem|key|p12|pfx)|.*credential[^/]*|.*secret[^/]*|nginx/.*|.*\.conf|ecosystem[^/]*|vercel\.json|deploy[^/]*)$", re.I),
     None),
    ("db-schema", 4,
     re.compile(r"(^|/)(drizzle|migrations?|schema|sql)(/|\.)|\.sql$", re.I),
     re.compile(r"\b(ALTER\s+TABLE|DROP\s+(TABLE|COLUMN)|CREATE\s+(TABLE|INDEX)|pgTable\()", re.I)),
    ("api-routes", 3,
     re.compile(r"(^|/)(routes?|api|units|controllers?|handlers?)/", re.I),
     re.compile(r"\b(router|app)\.(get|post|put|patch|delete|use)\(")),
    ("data-access", 3,
     None,
     re.compile(r"\b(client|pool|db|tx|trx)\.(query|execute|select|insert|update|delete)\b|\bsql(\.raw)?`")),
    ("dependencies", 3,
     re.compile(r"(^|/)(package\.json|requirements[^/]*\.txt|pyproject\.toml)$", re.I),
     None),
    ("lockfile", 1,
     re.compile(r"(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock)$", re.I),
     None),
    ("frontend", 1,
     re.compile(r"(^|/)(web|components?|pages)/|\.(jsx|tsx|css|html)$", re.I),
     None),
    ("tests", 0,
     re.compile(r"(^|/)(tests?|__tests__|e2e)/|\.(test|spec)\.[jt]sx?$|(^|/)test_[^/]+\.py$", re.I),
     None),
    ("docs", 0,
     re.compile(r"\.(md|txt|rst)$", re.I),
     None),
]

SECRET_FILE = re.compile(
    r"(^|/)(\.env(\.[^/]*)?|.*\.(pem|key|p12|pfx)|id_rsa[^/]*|.*credentials?[^/]*\.json|.*service[-_]?account[^/]*\.json|.*_auth\.txt)$",
    re.I,
)
SECRET_FILE_ALLOWED = re.compile(r"\.(example|sample|template)$", re.I)
# Dev tooling (agent skills, scripts) is reviewed, but after shipped app code.
TOOLING = re.compile(r"^(\.claude|\.agent|\.context|scratch|docs)/")
BUILD_OUTPUT = re.compile(r"(^|/)(dist|build|\.turbo|coverage|\.next)/")
SOURCE_FILE = re.compile(r"\.(js|jsx|mjs|cjs|ts|tsx|py)$")

LARGE_PR_LINES = 1000
LARGE_FILE_LINES = 500


class PrAnalyzer:
    """Classifies the changes on the current branch by review risk."""

    def __init__(self, target_path: str, base: str = None, verbose: bool = False):
        self.target_path = Path(target_path).resolve()
        self.base = base
        self.verbose = verbose
        self.results: Dict = {}

    def log(self, message: str) -> None:
        if self.verbose:
            print(message, file=sys.stderr)

    def run(self) -> Dict:
        if not self.target_path.exists():
            raise ValueError(f"Target path does not exist: {self.target_path}")
        self.repo = repo_root(self.target_path)
        self.base = self.base or default_base(self.repo)
        self.merge_base = run_git(self.repo, ["merge-base", self.base, "HEAD"]).strip()
        self.log(f"Repo {self.repo}, base {self.base}, merge base {self.merge_base[:8]}")
        self.analyze()
        return self.results

    def _scope_args(self) -> List[str]:
        """Limit git output to the target when it is a subfolder of the repo."""
        rel = self.target_path.relative_to(self.repo)
        return [] if str(rel) == "." else ["--", rel.as_posix()]

    def _added_lines_by_file(self) -> Dict[str, List[str]]:
        diff = run_git(self.repo, ["diff", "-U0", "--no-color", self.merge_base, *self._scope_args()])
        added: Dict[str, List[str]] = {}
        current = None
        for line in diff.splitlines():
            if line.startswith("+++ "):
                current = line[6:] if line.startswith("+++ b/") else None
                if current:
                    added.setdefault(current, [])
            elif current and line.startswith("+") and not line.startswith("+++"):
                added[current].append(line[1:])
        return added

    def analyze(self) -> None:
        scope = self._scope_args()
        numstat = run_git(self.repo, ["diff", "--numstat", self.merge_base, *scope])
        status = run_git(self.repo, ["diff", "--name-status", self.merge_base, *scope])
        untracked = [p for p in run_git(self.repo, ["ls-files", "--others", "--exclude-standard", *scope]).splitlines() if p]
        commits = [c for c in run_git(self.repo, ["log", "--format=%h %an: %s", f"{self.merge_base}..HEAD"]).splitlines() if c]

        files: Dict[str, Dict] = {}
        for line in numstat.splitlines():
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            added, deleted, path = parts[0], parts[1], parts[-1]
            if " => " in path:  # rename shorthand, e.g. src/{a => b}.js
                path = re.sub(r"\{[^}]* => ([^}]*)\}", r"\1", path).replace("//", "/")
            binary = added == "-"
            files[path] = {
                "path": path, "status": "M", "binary": binary,
                "added": 0 if binary else int(added), "deleted": 0 if binary else int(deleted),
            }
        for line in status.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2 and parts[-1] in files:
                files[parts[-1]]["status"] = parts[0][0]
        for path in untracked:
            full = self.repo / path
            try:
                count = len(full.read_text(encoding="utf-8", errors="replace").splitlines())
            except OSError:
                count = 0
            files[path] = {"path": path, "status": "?", "binary": False, "added": count, "deleted": 0}

        added_lines = self._added_lines_by_file()
        for path, info in files.items():
            categories, weight = [], 0
            lines = added_lines.get(path, [])
            for name, w, path_re, content_re in RISK_RULES:
                hit = bool(path_re and path_re.search(path))
                if not hit and content_re and info["status"] != "D" and SOURCE_FILE.search(path):
                    hit = any(content_re.search(l) for l in lines)
                if hit:
                    categories.append(name)
                    weight = max(weight, w)
            churn = info["added"] + info["deleted"]
            if TOOLING.search(path):
                categories.insert(0, "tooling")
                weight = min(weight, 1)
            info["categories"] = categories or ["other"]
            info["risk_score"] = weight * 2 + min(churn // 200, 3) if info["status"] != "D" else 0
        ranked = sorted(files.values(), key=lambda f: (-f["risk_score"], -(f["added"] + f["deleted"]), f["path"]))

        warnings = []
        total_added = sum(f["added"] for f in ranked)
        total_deleted = sum(f["deleted"] for f in ranked)
        if total_added + total_deleted > LARGE_PR_LINES:
            warnings.append({
                "severity": "medium",
                "message": f"Large change: {total_added + total_deleted} lines across {len(ranked)} files. "
                           "Review quality drops sharply past ~400 lines; consider splitting.",
            })
        for f in ranked:
            if f["status"] == "D":
                continue
            if SECRET_FILE.search(f["path"]) and not SECRET_FILE_ALLOWED.search(f["path"]):
                warnings.append({"severity": "critical", "path": f["path"],
                                 "message": "Looks like a secrets/credentials file. Remove it from git and rotate the values."})
            if BUILD_OUTPUT.search(f["path"]):
                warnings.append({"severity": "low", "path": f["path"],
                                 "message": "Build output is in the diff; it should be ignored, not committed."})
            if f["added"] + f["deleted"] > LARGE_FILE_LINES and SOURCE_FILE.search(f["path"]) and not TOOLING.search(f["path"]):
                warnings.append({"severity": "low", "path": f["path"],
                                 "message": f"{f['added'] + f['deleted']} changed lines in one file; review in chunks."})
        changed_source = [f for f in ranked if SOURCE_FILE.search(f["path"]) and "tests" not in f["categories"] and f["status"] != "D"]
        changed_tests = [f for f in ranked if "tests" in f["categories"]]
        if changed_source and not changed_tests:
            warnings.append({"severity": "medium",
                             "message": f"{len(changed_source)} source files changed but no test files changed."})
        if any("dependencies" in f["categories"] for f in ranked) and not any("lockfile" in f["categories"] for f in ranked):
            warnings.append({"severity": "low",
                             "message": "A manifest changed without its lockfile; installs may not be reproducible."})

        by_category: Dict[str, int] = {}
        for f in ranked:
            for c in f["categories"]:
                by_category[c] = by_category.get(c, 0) + 1

        self.results = {
            "repo": str(self.repo),
            "base": self.base,
            "merge_base": self.merge_base,
            "head": run_git(self.repo, ["rev-parse", "--short", "HEAD"]).strip(),
            "branch": run_git(self.repo, ["rev-parse", "--abbrev-ref", "HEAD"]).strip(),
            "commits": commits,
            "summary": {
                "files_changed": len(ranked),
                "lines_added": total_added,
                "lines_deleted": total_deleted,
                "uncommitted_files": len(untracked) + len(run_git(self.repo, ["diff", "--name-only", "HEAD", *scope]).split()),
                "by_category": dict(sorted(by_category.items(), key=lambda kv: -kv[1])),
            },
            "warnings": sorted(warnings, key=lambda w: ["critical", "high", "medium", "low", "info"].index(w["severity"])),
            "files": ranked,
        }


def format_text(results: Dict, limit: int) -> str:
    s = results["summary"]
    out = [
        f"PR analysis: {results['branch']} ({results['head']}) vs {results['base']}",
        f"{len(results['commits'])} commits, {s['files_changed']} files, +{s['lines_added']} / -{s['lines_deleted']} lines"
        + (f", {s['uncommitted_files']} with uncommitted changes" if s["uncommitted_files"] else ""),
        "Areas touched: " + ", ".join(f"{k} ({v})" for k, v in s["by_category"].items()),
        "",
    ]
    if results["warnings"]:
        out.append("Warnings:")
        for w in results["warnings"]:
            where = f" {w['path']}:" if w.get("path") else ""
            out.append(f"  [{w['severity'].upper()}]{where} {w['message']}")
        out.append("")
    out.append(f"Review these first (top {min(limit, len(results['files']))} by risk):")
    for f in results["files"][:limit]:
        out.append(f"  {f['risk_score']:>2}  {f['status']}  {f['path']}  (+{f['added']}/-{f['deleted']})  "
                   f"[{', '.join(f['categories'])}]")
    return "\n".join(out)


def main():
    force_utf8_output()
    parser = argparse.ArgumentParser(description="Rank the files changed on this branch by review risk.")
    parser.add_argument("target", nargs="?", default=".", help="Repo path, or a subfolder to limit the analysis to")
    parser.add_argument("--base", help="Branch the PR targets (default: origin/HEAD, main or master)")
    parser.add_argument("--top", type=int, default=25, help="How many files to list in text output")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print progress to stderr")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--output", "-o", help="Write output to this file instead of stdout")
    args = parser.parse_args()

    try:
        results = PrAnalyzer(args.target, base=args.base, verbose=args.verbose).run()
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)
    text = json.dumps(results, indent=2) if args.json else format_text(results, args.top)
    write_output(text, args.output)


if __name__ == "__main__":
    main()
