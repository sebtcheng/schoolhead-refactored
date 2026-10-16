"""Shared helpers for the code-reviewer scripts. Standard library only."""

import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

SEVERITIES = ["critical", "high", "medium", "low", "info"]
SEVERITY_RANK = {name: i for i, name in enumerate(SEVERITIES)}

SOURCE_EXTENSIONS = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py"}

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "coverage", ".turbo", ".next",
    ".vercel", "__pycache__", ".venv", "venv", "out", ".cache",
}


def force_utf8_output() -> None:
    """Windows consoles default to cp1252, which cannot print emoji or arrows."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def run_git(repo: Path, args: List[str]) -> str:
    result = subprocess.run(
        ["git", *args], cwd=str(repo), capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def repo_root(path: Path) -> Path:
    start = path if path.is_dir() else path.parent
    return Path(run_git(start, ["rev-parse", "--show-toplevel"]).strip())


def default_base(repo: Path) -> str:
    """Best guess at the branch a PR would target."""
    try:
        ref = run_git(repo, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]).strip()
        if ref:
            return ref.replace("refs/remotes/", "")
    except RuntimeError:
        pass
    for candidate in ("main", "master", "origin/main", "origin/master"):
        try:
            run_git(repo, ["rev-parse", "--verify", "--quiet", candidate])
            return candidate
        except RuntimeError:
            continue
    raise RuntimeError("Could not detect a base branch; pass --base <branch>.")


def changed_files(repo: Path, base: str, include_uncommitted: bool = True) -> List[str]:
    """Repo-relative paths changed since the merge base with `base` (deleted files excluded)."""
    merge_base = run_git(repo, ["merge-base", base, "HEAD"]).strip()
    names = set(run_git(repo, ["diff", "--name-only", "--diff-filter=d", merge_base]).split("\n")) \
        if include_uncommitted else \
        set(run_git(repo, ["diff", "--name-only", "--diff-filter=d", merge_base, "HEAD"]).split("\n"))
    if include_uncommitted:
        names |= set(run_git(repo, ["ls-files", "--others", "--exclude-standard"]).split("\n"))
    return sorted(n for n in names if n)


def is_skipped(rel_path: str) -> bool:
    parts = Path(rel_path).parts
    if any(p in SKIP_DIRS for p in parts):
        return True
    name = parts[-1] if parts else ""
    return name.endswith((".min.js", ".bundle.js", ".map"))


def iter_source_files(target: Path) -> List[Path]:
    if target.is_file():
        return [target]
    found = []
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix in SOURCE_EXTENSIONS and not is_skipped(str(p)):
                found.append(p)
    return sorted(found)


def find_eslint(start: Path) -> Optional[Path]:
    """Walk up from `start` to a locally installed ESLint; returns its JS entry point (run with `node`)."""
    for folder in [start, *start.parents]:
        candidate = folder / "node_modules" / "eslint" / "bin" / "eslint.js"
        if candidate.exists():
            return candidate
    return None


def write_output(text: str, output: Optional[str]) -> None:
    if output:
        Path(output).write_text(text, encoding="utf-8")
        print(f"Wrote {output}")
    else:
        print(text)
