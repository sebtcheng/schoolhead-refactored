# Coding standards

What reviewers hold changes to in this monorepo (pnpm workspaces + Turbo:
`apps/school-head/{api,web}`, `apps/siif/{api,web}`, `packages/*`). Where a rule is
already enforced by a tool, the tool is named; everything else is a review call.

## Repository structure
- **No cross-app imports.** `apps/siif/**` and `apps/school-head/**` never import from each
  other; shared code goes in `packages/*` and is imported as `@shared/*`
  (enforced: ESLint `no-restricted-imports`).
- New shared database code goes in `packages/shared-db` / `packages/db`; shared auth in
  `packages/shared-auth`. Do not copy a helper into a second app.
- Generated and local-only files stay out of git: `dist/`, `.turbo/`, `node_modules/`,
  `.env*` (except `.env.example`), scratch exports.

## Configuration and secrets
- All credentials come from environment variables, with **no literal fallback**:
  ```js
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  ```
- Each environment variable an app needs is listed in `.env.example` with a fake value.
- Database TLS uses the provider CA, not `rejectUnauthorized: false`.

## API routes (Express 5)
- One router per resource/unit; mount it in the app's `index.js`.
- Every route that touches school data uses the auth middleware
  (`authMiddleware` from `@shared/auth` in school-head, `authenticate` in SIIF) and then
  checks the user may access that school (`req.user` vs the requested school id).
- Validate input at the top of the handler (zod is available) and return 400 on bad input.
- Response shape: `{ success: true, data }` / `{ success: false, error: '<user-safe message>' }`.
  Log the real error with context: `console.error('[unit2:save]', err)`.
- Express 5 forwards rejected promises to the error handler; still catch where you
  need to roll back a transaction or release a client.
- Keep the global JSON body limit small; give upload routes their own limits.

## Database access (pg + Drizzle)
- Values always go through parameters (`$1`, `$2`) or Drizzle builders / `` sql`...` ``.
  Never interpolate request data into SQL text.
- Dynamic identifiers (column names, sort fields) are mapped through an allowlist object.
- Transactions:
  ```js
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ...writes...
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  ```
- No queries inside loops over request data; use `ANY($1)`, `unnest`, multi-row
  `INSERT ... VALUES`, or Drizzle `inArray` / batch inserts.
- Select named columns; paginate or LIMIT list queries.
- Schema changes go through Drizzle (`drizzle/`, `pnpm db:generate`); the Drizzle schema
  and raw SQL must agree on table and column names.

## Frontend (React 19 + Vite + Tailwind)
- Function components and hooks only. Follow `eslint-plugin-react-hooks` (enforced): no
  conditional hooks, correct effect dependencies, no setState during render.
- Every data fetch handles loading, error and empty states; save failures are shown to
  the user, not only logged.
- Never render API or user data with `dangerouslySetInnerHTML`.
- Role and permission checks in the UI are for display only; the API must enforce them.
- Components over ~500 lines are split into section components and hooks.
- Tailwind classes for styling; keep inline `<style>` blocks static.

## Naming and style
- `camelCase` for variables/functions, `PascalCase` for components and component files,
  `UPPER_SNAKE_CASE` for module constants, `snake_case` for database columns.
- `const` by default, `let` only when reassigned, never `var`. `===` / `!==` always.
- No unused variables or imports (enforced: ESLint `no-unused-vars`; names starting with
  a capital or `_` are exempt).
- Comments explain *why*, not what. Remove commented-out code and `debugger`.
- No `console.log` of passwords, passcodes, tokens or full request bodies.

## Python scripts (deploy and tooling)
- `subprocess.run([...])` with an argument list, not `shell=True` with a built string.
- Credentials from environment variables or a gitignored config file, never inline.
- Catch specific exceptions; no bare `except:`.
