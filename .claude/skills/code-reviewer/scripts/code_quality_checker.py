#!/usr/bin/env python3
"""
Code Quality Checker

Static checks for JavaScript/TypeScript (Express, pg, Drizzle, React) and
Python code: string-built SQL, hardcoded secrets, eval, command injection,
routes without auth middleware, database calls inside loops (N+1), swallowed
errors, leaked error details and more. ESLint results from the project's own
config are merged in when ESLint is installed.

Findings are heuristics: confirm each one in the code before reporting it.
Put `review-ignore` in a comment on the line (or the line above) to suppress
a confirmed false positive, ideally with the reason.
"""

import argparse
import bisect
import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from _common import (
    SEVERITIES, SEVERITY_RANK, changed_files, default_base, find_eslint,
    force_utf8_output, is_skipped, iter_source_files, repo_root, write_output,
    SOURCE_EXTENSIONS,
)

JS_EXT = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"}
TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|e2e|fixtures?|mocks?)/|\.(test|spec)\.[jt]sx?$|(^|/)test_[^/]+\.py$", re.I)

# ---------------------------------------------------------------- rule data

SECRET_ASSIGN = re.compile(
    # The optional middle part catches fallbacks: `secret = process.env.JWT_SECRET || 'literal'`.
    r"""\b([\w$]*(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret|jwt[_-]?key)[\w$]*)\s*[:=]\s*(?:[\w$.\[\]'"]+\s*(?:\|\||\?\?|\bor\b)\s*)*(['"`])([^'"`\s]{6,})\2""",
    re.I,
)
SECRET_PLACEHOLDER = re.compile(r"(your[_-]|change[_-]?me|example|placeholder|dummy|sample|xxx|\*\*\*|<[^>]+>|\$\{|process\.env)", re.I)
KNOWN_KEYS = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key ID"),
    (re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"), "private key"),
    (re.compile(r"\bsk-(proj-)?[A-Za-z0-9_-]{20,}"), "OpenAI-style secret key"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36}\b"), "GitHub token"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"), "Slack token"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "Google API key (Firebase web keys are public by design; anything else is a secret)"),
    (re.compile(r"\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^:\s/'\"]+:([^@\s'\"]{3,})@"), "database URL with an inline password"),
]

# Uppercase keywords anywhere, or a lowercase statement at the start of the string.
# Case-insensitive matching anywhere flags English UI/report text ("where", "order by").
SQL_KEYWORDS = re.compile(
    r"\b(SELECT\b[\s\S]*?\bFROM|INSERT\s+INTO|UPDATE\s+[\w\".${}]+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|WHERE\b|ORDER\s+BY|VALUES\s*\()"
)
SQL_LOWER_START = re.compile(r"^\s*(select|insert\s+into|update|delete\s+from|with)\b", re.I)
# Interpolations that are identifier-quoting helpers or module constants are lower risk.
SQL_SAFE_EXPR = re.compile(r"^\s*(qi|quoteIdent\w*|escapeIdentifier|pg\.escapeIdentifier|client\.escapeIdentifier|format\.ident|ident)\s*\(")
SQL_CONSTANT_EXPR = re.compile(r"^\s*[A-Z][A-Z0-9_]*\s*$")
TX_CONTROL = re.compile(r"""\(\s*['"`]\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET\s|RESET\s|EXPLAIN|LISTEN|NOTIFY)""", re.I)
# ESLint rules whose violations crash or misbehave at runtime vs. ones that are hygiene.
ESLINT_BUG_RULES = {
    "no-undef", "react-hooks/rules-of-hooks", "no-dupe-keys", "no-dupe-args", "no-const-assign",
    "no-func-assign", "no-import-assign", "no-unreachable", "no-self-assign", "no-cond-assign",
    "no-unsafe-finally", "no-unsafe-negation", "use-isnan", "valid-typeof", "no-obj-calls",
    "getter-return", "no-setter-return", "no-dupe-else-if", "no-duplicate-case",
}
ESLINT_NOISE_RULES = {"no-unused-vars", "no-useless-escape", "no-empty", "react-refresh/only-export-components"}
NODE_GLOBALS = {"process", "require", "module", "exports", "__dirname", "__filename", "Buffer", "global",
                "setImmediate", "clearImmediate"}
SQL_CALL = re.compile(r"\.(query|execute|raw|unsafe)\s*\(|\bsql\.raw\b|\bknex\.raw\b")

AUTH_NAME = re.compile(
    r"\b[\w$]*(auth|Auth|authenticate|verify[\w$]*Token|verifyJwt|protect|requireRole|requireUser|requireLogin|requireAdmin|ensure[A-Z][\w$]*|isLoggedIn|isAuthenticated|guard|Guard|checkRole|isAdmin)[\w$]*"
)
ROUTE_DEF = re.compile(r"""\b([\w$]*[rR]outer|app)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]*)\3\s*,?(.*)""")
PUBLIC_ROUTE = re.compile(r"(login|logout|signin|sign-in|register|signup|sign-up|health|ping|status|version|forgot|reset|verify|otp|passcode|public|webhook|callback)", re.I)

LOOP_HEAD = re.compile(r"\bfor\s*(?:await\s*)?\(|\bwhile\s*\(|\.(?:forEach|map|flatMap|filter|reduce|some|every)\s*\(\s*async\b")
DB_AWAIT = re.compile(
    r"\bawait\s+(?:[\w$]+\.)*(?:query|execute|select|insert|update|delete|findFirst|findMany|findOne|findAll|raw)\s*\("
)

# (rule id, severity, category, regex on masked code, message, fix)
JS_CODE_RULES = [
    ("SEC003", "high", "security", re.compile(r"(?<![\w$.])eval\s*\(|\bnew\s+Function\s*\("),
     "eval/new Function runs arbitrary code.", "Parse data with JSON.parse or use a lookup table instead."),
    ("SEC004", "high", "security", re.compile(r"\b(exec|execSync)\s*\([^)]*(`|\+)"),
     "Shell command built from a string; possible command injection.", "Use execFile/spawn with an argument array and no shell."),
    ("SEC004", "medium", "security", re.compile(r"\bshell\s*:\s*true\b"),
     "Process spawned with shell: true.", "Drop shell: true and pass arguments as an array."),
    ("SEC005", "medium", "security", re.compile(r"\bdangerouslySetInnerHTML\b"),
     "Raw HTML injected into the page (XSS risk).", "Render as text, or sanitize with DOMPurify first."),
    ("SEC006", "medium", "security",
     re.compile(r"\bres\.(status\([^)]*\)\.)?(json|send)\s*\(.*\b(err|error|e|ex)\.(message|stack|detail)\b"),
     "Internal error details sent to the client (can leak SQL, schema or file paths).",
     "Log the error server-side and return a generic message with a request id."),
    ("SEC009", "medium", "security", re.compile(r"\bjwt\.decode\s*\("),
     "jwt.decode does not verify the signature.", "Use jwt.verify with an explicit algorithms list for anything trusted."),
    ("SEC012", "high", "security", re.compile(r"NODE_TLS_REJECT_UNAUTHORIZED"),
     "TLS certificate verification disabled process-wide.", "Remove it; trust the specific CA instead."),
    ("SEC012", "medium", "security", re.compile(r"\brejectUnauthorized\s*:\s*false\b"),
     "TLS certificate verification disabled for this connection.", "Provide the server CA (ssl: { ca }) instead of disabling verification."),
    ("COR001", "medium", "correctness", re.compile(r"\bcatch\s*(\([^)]*\))?\s*\{\s*\}"),
     "Empty catch block silently swallows errors.", "Log the error or rethrow; comment why if ignoring is intended."),
    ("COR002", "high", "correctness", re.compile(r"\.forEach\s*\(\s*async\b"),
     "async callback in forEach: the awaits are not awaited by the caller and errors are unhandled.",
     "Use for...of with await, or await Promise.all(items.map(async ...))."),
    ("COR005", "medium", "correctness", re.compile(r"^\s*debugger\s*;?\s*$"),
     "debugger statement left in code.", "Remove it."),
    ("COR003", "low", "correctness", re.compile(r"[^=!<>]==[^=]|!=[^=]"),
     "Loose equality (==/!=) coerces types.", "Use === / !== (x == null is the one accepted exception)."),
    # Masked line: string contents are blank, so only variables named like secrets match, not log text.
    ("SEC010", "medium", "security",
     re.compile(r"\bconsole\.(log|info|debug|warn)\s*\(.*\b[\w$.]*(password|passcode|token|secret|authorization|otp)\b", re.I),
     "Possible secret or credential written to logs.", "Log an id or a redacted value instead."),
]
JS_RAW_RULES = [
    ("SEC008", "medium", "security", re.compile(r"\borigin\s*:\s*(['\"]\*['\"]|true)\b|\bcors\(\s*\)"),
     "CORS allows any origin.", "Restrict origin to an allowlist of your front-end domains."),
    ("SEC007", "high", "security",
     re.compile(r"Math\.random\s*\(.*\b(token|otp|passcode|password|secret|salt|nonce|reset|verification)|\b(token|otp|passcode|password|secret|salt|nonce)\w*\s*=.*Math\.random", re.I),
     "Math.random is predictable; not safe for tokens, passcodes or OTPs.", "Use crypto.randomInt / crypto.randomBytes / crypto.randomUUID."),
    ("SEC009", "high", "security", re.compile(r"algorithms\s*:\s*\[[^\]]*['\"]none['\"]", re.I),
     "JWT 'none' algorithm accepted.", "Allow only the algorithm you sign with, e.g. ['HS256']."),
    ("PERF002", "low", "performance", re.compile(r"\bSELECT\s+(\w+\.)?\*\s+FROM\b", re.I),
     "SELECT * fetches every column.", "Select only the columns the caller uses."),
    ("MAINT002", "info", "maintainability", re.compile(r"(//|/\*|#)\s*(TODO|FIXME|HACK|XXX)\b"),
     "Unresolved TODO/FIXME.", "Resolve it or link a ticket."),
]
PY_CODE_RULES = [
    ("SEC003", "high", "security", re.compile(r"(?<![\w.])(eval|exec)\s*\("),
     "eval/exec runs arbitrary code.", "Use ast.literal_eval or explicit parsing."),
    ("SEC004", "medium", "security", re.compile(r"\bshell\s*=\s*True\b"),
     "subprocess with shell=True; possible command injection.", "Pass an argument list without shell=True."),
    ("SEC012", "medium", "security", re.compile(r"\bverify\s*=\s*False\b"),
     "TLS certificate verification disabled.", "Keep verification on; pass the CA bundle if needed."),
    ("SEC013", "high", "security", re.compile(r"\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader\s*=\s*yaml\.SafeLoader)"),
     "Unsafe deserialization.", "Use json, or yaml.safe_load."),
    ("COR004", "medium", "correctness", re.compile(r"^\s*except\s*:"),
     "Bare except catches everything, including KeyboardInterrupt.", "Catch specific exceptions (at least Exception)."),
]
PY_RAW_RULES = [
    ("SQL001", "high", "security",
     re.compile(r"\.(execute|executemany|raw)\s*\(\s*(f['\"]|['\"][^'\"]*['\"]\s*(%|\.format\b|\+))"),
     "SQL built with f-string/format/concatenation.", "Pass values as query parameters (cursor.execute(sql, params))."),
    ("MAINT002", "info", "maintainability", re.compile(r"#\s*(TODO|FIXME|HACK|XXX)\b"),
     "Unresolved TODO/FIXME.", "Resolve it or link a ticket."),
]

BODY_LIMIT = re.compile(r"\b(json|urlencoded|raw|text)\s*\(\s*\{[^}]*\blimit\s*:\s*['\"](\d+)\s*mb", re.I)
LONG_FILE = (500, 1000)


# --------------------------------------------------------------- redaction

def redact(snippet: str) -> str:
    """Hide secret values in snippets so reports can be shared without leaking them again."""
    def keep_prefix(m):
        return m.group(0)[:4] + "****"
    for rx, label in KNOWN_KEYS:
        if label.startswith("database URL"):
            snippet = rx.sub(lambda m: m.group(0).replace(":" + m.group(2) + "@", ":****@"), snippet)
        else:
            snippet = rx.sub(keep_prefix, snippet)
    return SECRET_ASSIGN.sub(lambda m: m.group(0).replace(m.group(3), m.group(3)[:2] + "****"), snippet)


# ------------------------------------------------------------------ masking

def _blank(chars: List[str], start: int, end: int) -> None:
    for k in range(start, end):
        if chars[k] != "\n":
            chars[k] = " "


def mask_js(text: str) -> Tuple[str, List[Tuple[str, int, int]]]:
    """Blank out comments and string contents; return masked text and string spans (quote, start, end)."""
    chars, spans, i, n = list(text), [], 0, len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if c == "/" and nxt == "/":
            j = text.find("\n", i)
            j = n if j == -1 else j
            _blank(chars, i, j)
            i = j
        elif c == "/" and nxt == "*":
            j = text.find("*/", i + 2)
            j = n if j == -1 else j + 2
            _blank(chars, i, j)
            i = j
        elif c in "'\"`":
            j = i + 1
            while j < n:
                ch = text[j]
                if ch == "\\":
                    j += 2
                    continue
                if ch == c or (c != "`" and ch == "\n"):
                    break
                if c == "`" and ch == "$" and j + 1 < n and text[j + 1] == "{":
                    depth, j = 1, j + 2
                    while j < n and depth:
                        depth += {"{": 1, "}": -1}.get(text[j], 0)
                        j += 1
                    continue
                j += 1
            j = min(j, n)
            spans.append((c, i + 1, j))
            _blank(chars, i + 1, j)
            i = j + 1
        else:
            i += 1
    return "".join(chars), spans


def mask_py(text: str) -> Tuple[str, List[Tuple[str, int, int]]]:
    chars, spans, i, n = list(text), [], 0, len(text)
    while i < n:
        c = text[i]
        if c == "#":
            j = text.find("\n", i)
            j = n if j == -1 else j
            _blank(chars, i, j)
            i = j
        elif c in "'\"":
            quote = text[i:i + 3] if text[i:i + 3] in ('"""', "'''") else c
            j = i + len(quote)
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text.startswith(quote, j) or (len(quote) == 1 and text[j] == "\n"):
                    break
                j += 1
            j = min(j, n)
            spans.append((quote, i + len(quote), j))
            _blank(chars, i + len(quote), j)
            i = j + len(quote)
        else:
            i += 1
    return "".join(chars), spans


def match_close(text: str, open_pos: int, open_ch: str, close_ch: str) -> int:
    depth = 0
    for k in range(open_pos, len(text)):
        if text[k] == open_ch:
            depth += 1
        elif text[k] == close_ch:
            depth -= 1
            if depth == 0:
                return k
    return len(text)


# ------------------------------------------------------------------ checker

class CodeQualityChecker:
    """Runs the rule set over a file tree or a list of changed files."""

    def __init__(self, target_path: str, verbose: bool = False, files: Optional[List[Path]] = None,
                 use_eslint: bool = True):
        self.target_path = Path(target_path).resolve()
        self.verbose = verbose
        self.files = files
        self.use_eslint = use_eslint
        self.findings: List[Dict] = []
        self.notes: List[str] = []
        self.results: Dict = {}

    def log(self, message: str) -> None:
        if self.verbose:
            print(message, file=sys.stderr)

    def run(self) -> Dict:
        if not self.target_path.exists():
            raise ValueError(f"Target path does not exist: {self.target_path}")
        try:
            self.root = repo_root(self.target_path)
        except RuntimeError:
            self.root = self.target_path if self.target_path.is_dir() else self.target_path.parent
        files = self.files if self.files is not None else iter_source_files(self.target_path)
        files = [f for f in files if f.suffix in SOURCE_EXTENSIONS and f.exists()]
        self.log(f"Checking {len(files)} files")
        for path in files:
            self.check_file(path)
        if self.use_eslint:
            self.run_eslint([f for f in files if f.suffix in JS_EXT])
        self.findings.sort(key=lambda f: (SEVERITY_RANK[f["severity"]], f["file"], f["line"]))
        counts = {s: 0 for s in SEVERITIES}
        for f in self.findings:
            counts[f["severity"]] += 1
        self.results = {
            "target": str(self.target_path),
            "files_checked": len(files),
            "counts": counts,
            "notes": self.notes,
            "findings": self.findings,
        }
        return self.results

    def rel(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.root).as_posix()
        except ValueError:
            return path.as_posix()

    # ------------------------------------------------------------- per file

    def check_file(self, path: Path) -> None:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            self.notes.append(f"Could not read {path}: {e}")
            return
        rel = self.rel(path)
        is_js = path.suffix in JS_EXT
        is_test = bool(TEST_PATH.search(rel))
        raw_lines = text.splitlines()
        masked, spans = mask_js(text) if is_js else mask_py(text)
        masked_lines = masked.splitlines()
        line_starts = [0] + [m.end() for m in re.finditer(r"\n", text)]
        line_of = lambda pos: bisect.bisect_right(line_starts, pos)  # 1-based

        def ignored(line_no: int) -> bool:
            for k in (line_no - 1, line_no - 2):
                if 0 <= k < len(raw_lines) and "review-ignore" in raw_lines[k]:
                    return True
            return False

        def add(rule, severity, category, line_no, message, fix):
            if ignored(line_no):
                return
            snippet = redact(raw_lines[line_no - 1].strip()) if 0 < line_no <= len(raw_lines) else ""
            self.findings.append({
                "rule": rule, "severity": severity, "category": category, "file": rel,
                "line": line_no, "message": message, "fix": fix, "snippet": snippet[:160],
            })

        code_rules, raw_rules = (JS_CODE_RULES, JS_RAW_RULES) if is_js else (PY_CODE_RULES, PY_RAW_RULES)
        for idx, line in enumerate(masked_lines, 1):
            for rule, sev, cat, rx, msg, fix in code_rules:
                if rx.search(line):
                    if rule == "COR003" and re.search(r"[=!]=\s*null\b|\bnull\s*[=!]=", line):
                        continue
                    # catch { /* why */ } documents an intentional ignore; only flag truly empty blocks.
                    if rule == "COR001" and not rx.search(raw_lines[idx - 1]):
                        continue
                    # <style dangerouslySetInnerHTML> usually holds static CSS: still worth a glance, not XSS-grade.
                    if rule == "SEC005" and re.search(r"<style\b", raw_lines[idx - 1]):
                        add(rule, "low", cat, idx, "Inline <style> via dangerouslySetInnerHTML.",
                            "Fine for static CSS; never interpolate user data into it.")
                        continue
                    add(rule, sev, cat, idx, msg, fix)
        for idx, line in enumerate(raw_lines, 1):
            for rule, sev, cat, rx, msg, fix in raw_rules:
                if rx.search(line):
                    add(rule, sev, cat, idx, msg, fix)
            m = BODY_LIMIT.search(line)
            if m and int(m.group(2)) >= 50:
                add("SEC011", "medium", "security", idx,
                    f"Request body limit of {m.group(2)}mb lets one request exhaust server memory.",
                    "Keep the global limit small (1-10mb); raise it only on the upload routes that need it.")

        self.check_secrets(raw_lines, is_test, add)
        if is_js:
            self.check_sql_strings(text, masked, spans, line_of, add)
            self.check_loops(text, masked, line_of, add)
            if not is_test:
                self.check_routes(raw_lines, masked_lines, add)

        if len(raw_lines) > LONG_FILE[1]:
            add("MAINT001", "medium", "maintainability", 1,
                f"File has {len(raw_lines)} lines.", "Split by responsibility (routes, queries, UI sections).")
        elif len(raw_lines) > LONG_FILE[0]:
            add("MAINT001", "low", "maintainability", 1,
                f"File has {len(raw_lines)} lines.", "Consider splitting by responsibility.")

    def check_secrets(self, raw_lines, is_test, add) -> None:
        for idx, line in enumerate(raw_lines, 1):
            known_hit = False
            for rx, label in KNOWN_KEYS:
                m = rx.search(line)
                if not m or SECRET_PLACEHOLDER.search(m.group(0)):
                    continue
                known_hit = True
                if m.group(0).startswith("AIza") and re.search(r"\bapiKey\s*:", line):
                    add("SEC002", "low", "security", idx,
                        "Firebase web apiKey in client config (public by design).",
                        "OK if Firebase security rules and API key restrictions are set; confirm in the console.")
                else:
                    add("SEC002", "low" if is_test else "critical", "security", idx,
                        f"Hardcoded {label}.", "Move it to an environment variable and rotate the exposed value.")
            if known_hit:
                continue
            for m in SECRET_ASSIGN.finditer(line):
                value = m.group(3)
                # `process.env.X || 'literal'` is still a hardcoded secret: the fallback ships in the code.
                if SECRET_PLACEHOLDER.search(value):
                    continue
                # Field names and column names ('password_hash', 'newPassword') are not secrets.
                if re.fullmatch(r"[A-Za-z_.\-]+", value) or value.lower() in m.group(1).lower():
                    continue
                add("SEC001", "low" if is_test else "high", "security", idx,
                    f"Possible hardcoded secret in '{m.group(1)}'.",
                    "Load it from an environment variable; rotate it if it was ever committed.")

    def check_sql_strings(self, text, masked, spans, line_of, add) -> None:
        if not SQL_CALL.search(masked):
            return  # SQL-looking text in files that never run queries is UI copy, not SQL
        for quote, start, end in spans:
            content = text[start:end]
            if not (SQL_KEYWORDS.search(content) or SQL_LOWER_START.search(content)):
                continue
            if quote == "`":
                prefix = text[max(0, start - 12):start - 1]
                if re.search(r"\bsql\s*$", prefix):  # Drizzle sql`...` parameterizes ${} values
                    continue
                exprs = [m for m in re.finditer(r"\$\{([^}]*)\}", content)
                         if not (m.start() > 0 and content[m.start() - 1] == "$")]  # $${i} builds a $1 placeholder
                exprs = [m for m in exprs if not SQL_SAFE_EXPR.search(m.group(1))]
                risky = [m for m in exprs if not SQL_CONSTANT_EXPR.search(m.group(1))]
                if risky or exprs:
                    first = (risky or exprs)[0]
                    names = ", ".join(sorted({u.group(1).strip()[:40] for u in (risky or exprs)})[:4])
                    if risky:
                        add("SQL001", "high", "security", line_of(start + first.start()),
                            f"SQL template interpolates values directly: ${{{names}}}.",
                            "Use $1, $2 placeholders with a values array. If it is a column/table name or a clause "
                            "built from fixed fragments, check it against an allowlist and mark the line "
                            "review-ignore with that reason.")
                    else:
                        add("SQL001", "low", "security", line_of(start + first.start()),
                            f"SQL template interpolates constant(s) ${{{names}}}.",
                            "Fine if the constant never holds user input; otherwise parameterize it.")
            else:
                before = masked[max(0, start - 40):start - 1].rstrip()
                after = masked[end + 1:end + 40].lstrip()
                if before.endswith("+") or after.startswith("+"):
                    add("SQL001", "high", "security", line_of(start),
                        "SQL built by string concatenation.", "Use $1, $2 placeholders with a values array.")

    def check_loops(self, text, masked, line_of, add) -> None:
        reported = set()
        for m in LOOP_HEAD.finditer(masked):
            pos = m.end() - 1 if masked[m.end() - 1] == "(" else m.end()
            if m.group(0).lstrip().startswith(("for", "while")):
                close = match_close(masked, pos, "(", ")")
                k = close + 1
                while k < len(masked) and masked[k] in " \t\r\n":
                    k += 1
                if k >= len(masked) or masked[k] != "{":
                    continue
                body_start = k
            else:
                arrow = masked.find("=>", m.end())
                body_start = masked.find("{", arrow if arrow != -1 else m.end())
                if body_start == -1 or (arrow != -1 and masked[arrow + 2:body_start].strip()):
                    continue
            body_end = match_close(masked, body_start, "{", "}")
            for q in DB_AWAIT.finditer(masked, body_start, body_end):
                ln = line_of(q.start())
                if ln in reported or TX_CONTROL.search(text[q.end() - 1:q.end() + 30]):
                    continue
                reported.add(ln)
                add("PERF001", "medium", "performance", ln,
                    f"Database call inside a loop (loop starts line {line_of(m.start())}): one query per item (N+1).",
                    "Fetch in one query (WHERE id = ANY($1) / inArray) or insert in one multi-row statement.")

    def check_routes(self, raw_lines, masked_lines, add) -> None:
        def has_auth(fragment: str) -> bool:
            # authRouter / authRoutes mount login endpoints; they are not middleware.
            return any(not x.group(0).endswith(("Router", "router", "Routes", "routes"))
                       for x in AUTH_NAME.finditer(fragment))

        router_auth_lines = []
        for idx, line in enumerate(raw_lines, 1):
            m = re.search(r"\b([\w$]*[rR]outer|app)\.use\s*\((.*)", line)
            if m and has_auth(m.group(2)):
                router_auth_lines.append(idx)
        for idx, line in enumerate(raw_lines, 1):
            m = ROUTE_DEF.search(line)
            if not m or not masked_lines[idx - 1].strip():
                continue
            path = m.group(4)
            if any(l < idx for l in router_auth_lines) or PUBLIC_ROUTE.search(path):
                continue
            rest = m.group(5) + " " + " ".join(raw_lines[idx:idx + 3])
            head = re.split(r"\basync\b|\bfunction\b|=>", rest, maxsplit=1)[0]
            if has_auth(head):
                continue
            add("AUTH001", "medium", "security", idx,
                f"{m.group(2).upper()} {path or '/'} has no auth middleware in its definition or a router.use() above it.",
                "Add the auth middleware (e.g. authMiddleware / authenticate), or confirm it is mounted behind auth "
                "or meant to be public and mark it review-ignore with the reason.")

    # --------------------------------------------------------------- eslint

    def run_eslint(self, files: List[Path]) -> None:
        if not files:
            return
        eslint = find_eslint(self.target_path if self.target_path.is_dir() else self.target_path.parent)
        if not eslint:
            self.notes.append("ESLint not installed; skipped lint findings.")
            return
        config_dir = None
        for folder in [self.target_path if self.target_path.is_dir() else self.target_path.parent,
                       *self.target_path.parents]:
            if any((folder / f"eslint.config.{ext}").exists() for ext in ("js", "mjs", "cjs", "ts")) or \
               any((folder / name).exists() for name in (".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json")):
                config_dir = folder
                break
        if not config_dir:
            self.notes.append("No ESLint config found; skipped lint findings.")
            return
        linted, node_global_hits, node_global_files = 0, 0, set()
        for i in range(0, len(files), 40):
            chunk = [str(f) for f in files[i:i + 40]]
            try:
                proc = subprocess.run(
                    ["node", str(eslint), "--format", "json", "--no-warn-ignored", *chunk],
                    cwd=str(config_dir), capture_output=True, text=True, encoding="utf-8",
                    errors="replace", timeout=300,
                )
            except (OSError, subprocess.TimeoutExpired) as e:
                self.notes.append(f"ESLint failed to run: {e}")
                return
            if proc.returncode == 2 or not proc.stdout.strip().startswith("["):
                self.notes.append("ESLint error: " + (proc.stderr or proc.stdout).strip().splitlines()[0][:200]
                                  if (proc.stderr or proc.stdout).strip() else "ESLint exited with an error.")
                return
            for result in json.loads(proc.stdout):
                linted += 1
                path = Path(result["filePath"])
                lines = None
                for msg in result.get("messages", []):
                    line_no = msg.get("line") or 1
                    if lines is None:
                        try:
                            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
                        except OSError:
                            lines = []
                    if any("review-ignore" in lines[k] for k in (line_no - 1, line_no - 2) if 0 <= k < len(lines)):
                        continue
                    undef = re.match(r"'([\w$]+)' is not defined", msg.get("message", ""))
                    if msg.get("ruleId") == "no-undef" and undef and undef.group(1) in NODE_GLOBALS:
                        # A config gap (Node files linted with browser globals), not a code bug: report once.
                        node_global_hits += 1
                        node_global_files.add(self.rel(path))
                        continue
                    fatal = bool(msg.get("fatal"))
                    rule_id = msg.get("ruleId") or ("parse-error" if fatal else "directive")
                    if fatal or rule_id in ESLINT_BUG_RULES:
                        severity = "high"
                    elif rule_id in ESLINT_NOISE_RULES or rule_id == "directive" or msg.get("severity") != 2:
                        severity = "low"
                    else:
                        severity = "medium"
                    self.findings.append({
                        "rule": f"eslint/{rule_id}",
                        "severity": severity,
                        "category": "correctness" if severity == "high" else "lint",
                        "file": self.rel(path), "line": line_no,
                        "message": msg.get("message", "").strip(),
                        "fix": "Fix the syntax error." if fatal else "Fix per the ESLint rule docs.",
                        "snippet": (redact(lines[line_no - 1].strip())[:160] if lines and 0 < line_no <= len(lines) else ""),
                    })
        if node_global_hits:
            sample = ", ".join(sorted(node_global_files)[:3])
            self.notes.append(
                f"ESLint reported {node_global_hits} no-undef errors for Node globals (process, require, ...) in "
                f"{len(node_global_files)} files (e.g. {sample}). The ESLint config is missing globals.node for "
                "server code; fix the config rather than the files. These were left out of the findings.")
        self.log(f"ESLint checked {linted} files")


# --------------------------------------------------------------------- CLI

def select_files(target: Path, changed_only: bool, base: Optional[str], excludes: List[str]) -> Optional[List[Path]]:
    """Files to check, or None to let the checker walk the target itself."""
    if not changed_only and not excludes:
        return None
    try:
        repo = repo_root(target)
    except RuntimeError:
        repo = target if target.is_dir() else target.parent
    if changed_only:
        files = [repo / p for p in changed_files(repo, base or default_base(repo)) if not is_skipped(p)]
        files = [f for f in files if f.resolve() == target or target in f.resolve().parents]
    else:
        files = iter_source_files(target)

    def rel(f: Path) -> str:
        try:
            return f.resolve().relative_to(repo.resolve()).as_posix()
        except ValueError:
            return f.as_posix()
    return [f for f in files if not any(fnmatch.fnmatch(rel(f), g) for g in excludes)]


def format_text(results: Dict, min_severity: str, limit: int) -> str:
    c = results["counts"]
    out = [
        f"Code quality: {results['files_checked']} files checked in {results['target']}",
        "Findings: " + ", ".join(f"{c[s]} {s}" for s in SEVERITIES),
    ]
    out += [f"Note: {n}" for n in results["notes"]]
    shown = [f for f in results["findings"] if SEVERITY_RANK[f["severity"]] <= SEVERITY_RANK[min_severity]]
    current = None
    for f in shown[:limit]:
        if f["severity"] != current:
            current = f["severity"]
            out.append(f"\n[{current.upper()}]")
        out.append(f"  {f['file']}:{f['line']}  {f['rule']}  {f['message']}")
        if f["snippet"]:
            out.append(f"      > {f['snippet']}")
    if len(shown) > limit:
        out.append(f"\n... {len(shown) - limit} more (use --limit or --json)")
    return "\n".join(out)


def main():
    force_utf8_output()
    parser = argparse.ArgumentParser(description="Static security, correctness and performance checks for JS/TS/Python.")
    parser.add_argument("target", nargs="?", default=".", help="File or folder to check")
    parser.add_argument("--changed-only", action="store_true", help="Only check files changed vs --base (plus uncommitted)")
    parser.add_argument("--base", help="Base branch for --changed-only (default: origin/HEAD, main or master)")
    parser.add_argument("--exclude", action="append", default=[], metavar="GLOB",
                        help="Skip repo-relative paths matching this glob (repeatable), e.g. '.claude/**'")
    parser.add_argument("--no-eslint", action="store_true", help="Skip ESLint")
    parser.add_argument("--min-severity", choices=SEVERITIES, default="low", help="Lowest severity shown in text output")
    parser.add_argument("--fail-on", choices=SEVERITIES + ["never"], default="high",
                        help="Exit 1 if any finding is at or above this severity")
    parser.add_argument("--limit", type=int, default=200, help="Max findings in text output")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print progress to stderr")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--output", "-o", help="Write output to this file instead of stdout")
    args = parser.parse_args()

    try:
        files = select_files(Path(args.target).resolve(), args.changed_only, args.base, args.exclude)
        results = CodeQualityChecker(args.target, verbose=args.verbose, files=files,
                                     use_eslint=not args.no_eslint).run()
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    text = json.dumps(results, indent=2) if args.json else format_text(results, args.min_severity, args.limit)
    write_output(text, args.output)
    if args.fail_on != "never" and any(SEVERITY_RANK[f["severity"]] <= SEVERITY_RANK[args.fail_on]
                                       for f in results["findings"]):
        sys.exit(1)


if __name__ == "__main__":
    main()
