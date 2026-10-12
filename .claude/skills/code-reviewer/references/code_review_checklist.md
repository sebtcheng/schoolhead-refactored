# Code review checklist

Use with the scripts: they find candidates, this checklist covers what they cannot
judge. Work top to bottom; stop and report as soon as a blocker is confirmed.

## 0. Scope
- [ ] Ran `pr_analyzer.py` and know the base branch, commit count and size.
- [ ] Read the PR description / ticket: what is this change supposed to do?
- [ ] Over ~400 changed lines of app code: review in chunks by risk, and suggest splitting.
- [ ] No secrets files, build output (`dist/`, `.turbo/`), or `node_modules` in the diff.

## 1. Blockers (Request changes if any are confirmed)
- [ ] **Secrets**: no passwords, connection strings, API keys or private keys in code or
      as `||` fallbacks. Any committed secret must be **rotated**, not just deleted.
- [ ] **SQL injection**: every value reaches SQL as `$n` parameters or via Drizzle builders;
      dynamic identifiers come from an allowlist.
- [ ] **Missing auth**: every non-public route requires a valid session/token
      (`authMiddleware` in school-head, `authenticate` in SIIF).
- [ ] **Broken access control**: a logged-in user can only read/write *their own*
      school's data (compare `req.user` school id to the `:id`/body school id), and
      role-restricted actions check the role server-side, not only in the UI.
- [ ] **Runtime crashes**: `eslint/no-undef` hits (undefined variables/setters), parse errors,
      hooks called conditionally.
- [ ] **Data loss**: migrations do not drop or rewrite data without a backfill and rollback;
      multi-step writes are in one transaction.

## 2. Backend (Express + pg + Drizzle)
- [ ] Input validated (types, required fields, lengths, enums) before use; reject with 400.
- [ ] Errors: generic message to client, details logged server-side (`SEC006`).
- [ ] Every `pool.connect()` client is released in `finally`.
- [ ] Transactions: `BEGIN` / `COMMIT`, `ROLLBACK` in catch; no awaits on other pools inside.
- [ ] No query per item in loops (`PERF001`); list endpoints are paginated or LIMITed.
- [ ] Responses do not include password hashes, passcodes, tokens or unrelated rows.
- [ ] Auth endpoints: rate limited, constant-time compare (bcrypt.compare), no
      "user not found" vs "wrong password" difference, tokens expire.
- [ ] School-year lock and other global guards still apply to new write routes.
- [ ] New columns used in WHERE/JOIN/ORDER BY have indexes; Drizzle schema matches the SQL.

## 3. Frontend (React + Vite)
- [ ] Loading, empty and error states exist; failed saves are visible to the user.
- [ ] No state updates during render; `useEffect` dependency arrays are correct
      (react-hooks ESLint findings); effects clean up timers/listeners/subscriptions.
- [ ] No user or API data rendered as raw HTML (`SEC005`).
- [ ] Auth/role checks in the UI are for UX only; the API enforces them too.
- [ ] Offline/draft behavior (IndexedDB/localStorage) does not lose data on reload or logout.
- [ ] Usable at mobile width; inputs have labels; buttons are reachable by keyboard.

## 4. Tests and verification
- [ ] New logic has tests, or the PR says exactly how it was verified (steps, screenshots).
- [ ] `pnpm lint` and `pnpm build` pass.

## 5. Writing the review
- One comment per issue: **file:line**, what is wrong, why it matters, a concrete fix.
- Label each: **blocker**, **should fix**, or **nit**. Nits never block.
- Say what is good too; it tells the author what to keep doing.
- Confirm every automated finding in the code before posting it. Drop false positives
  and say in the report how many were dismissed.
