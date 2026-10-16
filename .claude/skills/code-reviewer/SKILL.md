---
name: code-reviewer
description: Reviews a branch or pull request in a JavaScript/TypeScript (Express, pg, Drizzle, React) or Python codebase. Ranks changed files by risk, runs static checks for SQL injection, hardcoded secrets, routes without auth, N+1 queries, swallowed errors and runtime-crash lint errors, then produces a markdown review report with a verdict and a manual checklist. Use when asked to review code, review a PR or branch, "check my changes before I merge", give code feedback, find security or quality issues, or run the code reviewer.
---

# Code reviewer

Three scripts find candidates; you confirm them in the code and write the review.
The scripts are heuristics: **never report a finding you have not looked at.**

All scripts are Python 3.8+ standard library only, run from the repo root, and work on
Windows (UTF-8 output is forced). Each takes `--json` and `-o <file>`.

## Workflow

1. **Scope the change.**
   ```bash
   python .claude/skills/code-reviewer/scripts/pr_analyzer.py . --base <target-branch>
   ```
   Prints commits, size, areas touched, PR-level warnings (committed secrets files,
   build output, oversized change, no tests) and files ranked by risk. If `--base` is
   omitted it uses origin/HEAD, then main, then master; ask the user if unsure.
   Uncommitted and untracked files are included.

2. **Run the checks on the changed files.**
   ```bash
   python .claude/skills/code-reviewer/scripts/code_quality_checker.py . --changed-only --base <target-branch>
   ```
   - Add `--exclude '<glob>'` (repeatable) for paths outside the review, e.g.
     `--exclude '.claude/**'` when reviewing app code only. Say what you excluded.
   - Pass a folder or file instead of `.` without `--changed-only` to audit existing code.
   - ESLint runs through the project's own config when installed (`--no-eslint` skips it).
   - Exit code: 0 clean, 1 findings at or above `--fail-on` (default high), 2 usage error.

3. **Verify.** For every critical and high finding, and a sample of each medium rule,
   open the file and decide: confirmed, or false positive (and why). Look up each rule in
   `references/common_antipatterns.md`; it says how to tell the two apart. In particular:
   - `AUTH001`: check how the router is mounted (`app.use(...)`) before calling it missing auth.
   - `SQL001`: trace where the interpolated value comes from; allowlisted identifiers are fine.
   - `SEC001`/`SEC002`: a real committed credential must be **rotated**, not just removed.

4. **Read the riskiest files yourself** (top of step 1's list) against
   `references/code_review_checklist.md`. Rules cannot see broken access control, missing
   validation, wrong business logic or data-loss risks; these come from reading.

5. **Generate the report.**
   ```bash
   python .claude/skills/code-reviewer/scripts/review_report_generator.py . --base <target-branch> [--exclude ...] -o review.md
   ```
   It reruns steps 1 and 2 (or loads them with `--pr-json` / `--quality-json`) and writes
   markdown: provisional verdict, PR-level issues, risky files, findings by severity, and
   a checklist for the areas touched. Secret values are redacted in snippets.

6. **Edit and deliver.** Remove false positives from the report, add the issues you found by
   reading, and set the final verdict:
   - **Request changes**: any confirmed critical/high (secrets, injection, missing auth or
     access control, runtime crash, data loss).
   - **Approve with comments**: only medium/low issues.
   - **Approve**: nothing beyond nits.
   Give each issue `file:line`, what is wrong, why it matters, and a concrete fix; label it
   blocker / should fix / nit. State how many automated findings you dismissed.

Do not modify the code under review unless the user asks for fixes after the review.

## Suppressing false positives

Put `review-ignore` in a comment on the flagged line or the line above, with the reason:
`// review-ignore: column name comes from SORT_COLUMNS allowlist`. Applies to ESLint
findings in the report too (it does not change ESLint itself).

## Rules

| Area | Rules |
|---|---|
| Security | SEC001 hardcoded secret, SEC002 known key / DB URL with password, SQL001 string-built SQL, SEC003 eval, SEC004 command injection, SEC005 raw HTML, SEC006 error details to client, SEC007 Math.random for secrets, SEC008 open CORS, SEC009 unverified JWT, SEC010 secrets in logs, SEC011 huge body limit, SEC012 TLS verification off, SEC013 unsafe deserialization (Py), AUTH001 route without auth |
| Correctness | COR001 empty catch, COR002 async forEach, COR003 loose equality, COR004 bare except (Py), COR005 debugger, `eslint/no-undef` and other crash-level ESLint rules (high) |
| Performance | PERF001 DB call in a loop (N+1), PERF002 SELECT * |
| Maintainability | MAINT001 long file, MAINT002 TODO/FIXME, other ESLint rules |

Severity: critical > high > medium > low > info. ESLint `no-undef` errors for Node globals
(`process`, `require`) mean the ESLint config lacks Node globals for server files; they are
summarized as one note instead of hundreds of findings.

## References

- `references/code_review_checklist.md`: the manual review checklist (blockers first).
- `references/common_antipatterns.md`: every rule with bad/good examples and false-positive guidance.
- `references/coding_standards.md`: the standards this repo's code is held to.
