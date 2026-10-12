# Common antipatterns (rule reference)

One entry per rule that `scripts/code_quality_checker.py` reports. Each shows the
bad pattern, the fix, and how to tell a real hit from a false positive. ESLint
findings appear as `eslint/<rule>`; see the ESLint docs for those.

Suppress a confirmed false positive with a comment on the line or the line above:
`// review-ignore: <reason>`. Always give the reason.

---

## Security

### SEC001 Hardcoded secret (high) / SEC002 Known key or credential URL (critical)
```js
// Bad: committed forever in git history, even after the line is deleted
const dbUrl = process.env.DATABASE_URL || 'postgres://admin:S3cret@prod-host:5432/app';
// Good: fail fast when the variable is missing
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is not set');
```
A fallback after `||` is still a hardcoded secret. Removing the line is not
enough: **rotate the credential**, because it stays in git history.
False positive: test fixtures with fake values (reported as low), Firebase web
`apiKey` values (public by design, protected by Firebase rules).

### SQL001 SQL built from strings (high)
```js
// Bad: req.query.id can be `1 OR 1=1`
await client.query(`SELECT name FROM schools WHERE school_id = ${req.query.id}`);
// Good: values go as parameters
await client.query('SELECT name FROM schools WHERE school_id = $1', [req.query.id]);
// Good: dynamic column names come from an allowlist
const COLUMNS = { enrollment: 'total_enrollment', teachers: 'teacher_count' };
const col = COLUMNS[req.query.field];
if (!col) return res.status(400).json({ error: 'Unknown field' });
await client.query(`SELECT ${col} FROM schools WHERE school_id = $1`, [id]); // review-ignore: allowlisted column
```
Not flagged: Drizzle `` sql`... ${value}` `` (parameterized), `$${i + 1}` placeholder
builders, identifier-quoting helpers like `qi()`. Constants in ALL_CAPS are reported
as low. Check `whereClause`-style fragments: they are safe only if every piece is a
fixed string and all values are pushed to the params array.

### SEC003 eval / new Function (high)
```js
const result = eval(req.body.formula);              // Bad
const result = JSON.parse(req.body.payload);        // Good for data
const fn = OPERATIONS[req.body.op]; if (!fn) ...    // Good for behavior
```

### SEC004 Command injection (high/medium)
```js
execSync(`git grep "${pattern}"`);                          // Bad: pattern can contain `"; rm -rf ~`
execFileSync('git', ['grep', pattern]);                     // Good: no shell
spawn('taskkill', ['/pid', pid, '/T', '/F'], { shell: true }); // Medium: shell not needed here
```
Python: `subprocess.run(cmd, shell=True)` with any non-constant `cmd`.

### SEC005 dangerouslySetInnerHTML (medium; low for `<style>`)
Raw HTML from users or the API is XSS. Render as text, or sanitize with DOMPurify.
A `<style dangerouslySetInnerHTML>` with static CSS is fine.

### SEC006 Error details sent to the client (medium)
```js
} catch (err) {
  res.status(500).json({ error: err.message });            // Bad: leaks SQL, table names, paths
}
} catch (err) {
  console.error('[unit2] save failed', err);               // Good: details in the server log
  res.status(500).json({ error: 'Could not save. Please try again.' });
}
```
Fine to return messages from errors you threw yourself on purpose (validation).

### SEC007 Math.random for secrets (high)
`Math.random()` is predictable. For OTPs, passcodes and tokens use
`crypto.randomInt(0, 1_000_000)`, `crypto.randomBytes(32).toString('hex')` or `crypto.randomUUID()`.

### SEC008 CORS allows any origin (medium)
`cors()` or `origin: '*'` / `origin: true` lets any website call the API from a
user's browser. Use an allowlist: `cors({ origin: ['https://app.example.gov.ph'], credentials: true })`.

### SEC009 JWT not verified (medium/high)
`jwt.decode()` reads a token without checking its signature; anyone can forge it.
Use `jwt.verify(token, secret, { algorithms: ['HS256'] })`. Never accept `none`.

### SEC010 Secrets in logs (medium)
`console.log('login', password)` / `console.log(req.headers.authorization)`. Logs are
kept and shared; log a user id or `token.slice(0, 6) + '…'`.

### SEC011 Huge request body limit (medium)
`express.json({ limit: '500mb' })` lets one request allocate hundreds of MB and
take the server down. Keep the global limit at 1-10mb; give upload routes their
own parser (multer/busboy with file-size limits).

### SEC012 TLS verification disabled (medium/high)
`ssl: { rejectUnauthorized: false }` accepts any certificate, so a network attacker
can read database traffic. Use the provider's CA: `ssl: { ca: fs.readFileSync('azure-ca.pem') }`.
`NODE_TLS_REJECT_UNAUTHORIZED=0` disables it for the whole process (high).

### SEC013 Unsafe deserialization, Python (high)
`pickle.loads`, `yaml.load` without SafeLoader. Use `json` or `yaml.safe_load`.

### AUTH001 Route without auth middleware (medium)
```js
router.put('/api/ph_schools/unit2/:id', async (req, res) => { ... });               // Flagged
router.put('/api/ph_schools/unit2/:id', authMiddleware, async (req, res) => { ... }); // Good
```
The rule looks for auth middleware in the route definition or a `router.use(auth...)`
above it in the same file. It cannot see app-level mounts like
`app.use('/api', authMiddleware, router)` in another file, so **check how the router
is mounted** before reporting. Paths that look public (login, register, health,
reset, verify, otp, passcode) are skipped. Logged-in is not enough: also check the
user may access *this* school or record (see the checklist).

## Correctness

### COR001 Empty catch (medium)
`catch (e) {}` hides failures and makes bugs invisible. Log, rethrow, or comment why
ignoring is correct (`catch { /* rollback may fail after disconnect */ }` is not flagged).

### COR002 async callback in forEach (high)
```js
items.forEach(async (it) => { await save(it); });   // Bad: caller continues immediately, errors unhandled
for (const it of items) await save(it);              // Good: sequential
await Promise.all(items.map((it) => save(it)));      // Good: parallel
```

### COR003 Loose equality (low)
`==` coerces (`'0' == 0`, `'' == 0` are true). Use `===`; `x == null` is accepted.

### COR004 Bare except, Python (medium)
`except:` also catches KeyboardInterrupt/SystemExit. Catch specific exceptions.

### COR005 debugger statement (medium)
Remove before merging.

## Performance

### PERF001 Database call in a loop (N+1) (medium)
```js
for (const s of students) {                                            // Bad: 500 students = 500 round trips
  await client.query('UPDATE learners SET grade = $1 WHERE id = $2', [s.grade, s.id]);
}
await client.query(                                                    // Good: one statement
  `UPDATE learners AS l SET grade = v.grade
     FROM unnest($1::int[], $2::text[]) AS v(id, grade) WHERE l.id = v.id`,
  [students.map(s => s.id), students.map(s => s.grade)]);
// Reads: WHERE id = ANY($1) (pg) or inArray(table.id, ids) (Drizzle)
```
Transaction control (BEGIN/COMMIT/ROLLBACK/SET) inside loops is not flagged.
Acceptable in one-off migration scripts with small inputs; say so with review-ignore.

### PERF002 SELECT * (low)
Fetches every column (including large JSON) and breaks silently when columns are
added. Name the columns.

## Maintainability

### MAINT001 Long file (low >500 lines, medium >1000)
Large React pages and route files hide bugs. Split routes by resource, queries into a
data module, and UI into section components.

### MAINT002 TODO/FIXME (info)
Resolve or link a ticket.
