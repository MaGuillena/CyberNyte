# CyberNyte computer shop management system

CyberNyte is a localhost system operated by an administrator and staff. It keeps the existing dark purple UI and now saves business records through Fetch, Express, and MySQL. Customers are records managed by employees; there is no customer login or public booking interface.

## Start on this computer

The workspace already has installed dependencies, a configured `.env`, and a seeded **MySQL Community Server 8.4.4** database. MySQL uses port **3318** and Express uses **3015** because other programs already use the usual ports.

Open a terminal in `CyberNyte` and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Open **http://localhost:3015**. Keep the terminal running. The script can restart the portable database after a reboot; it does not install a Windows service. The portable runtime/data are local ignored files in `tmp/`, not part of the source repository. Do not delete `tmp/mysql8-data` if you want to keep this local database.

| Account | Username | Password |
|---|---|---|
| Administrator | admin | admin123 |
| Staff | staff | staff123 |
| Staff | mika | mika123 |

These are fictional local classroom accounts. Plain-text passwords were explicitly requested. This is a known security limitation, not a production authentication design.

## Set up on another computer

1. Install Node.js 20 or newer and **MySQL 8**. Start MySQL. XAMPP normally bundles MariaDB, which is a different product; use MySQL to match the specification without needing approval for an alternative.
2. Open the `CyberNyte` project folder in a terminal.
3. Install the dependencies:

   ```powershell
   npm.cmd ci
   ```

4. Copy the configuration example:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Edit `.env` for your MySQL installation. Example:

   ```dotenv
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=cybernyte
   SESSION_SECRET=choose-a-long-random-local-secret
   ```

6. Create the schema and import starter data:

   ```powershell
   npm.cmd run db:setup
   ```

   This refuses to overwrite an existing database that contains tables. It creates the database named in `.env`, then runs `sql/schema.sql` and `sql/seed.sql`. DDL is not transactional in MySQL: if an import fails partway through, inspect the error and use a new empty database name rather than rerunning blindly.

   Alternative: import **`sql/cybernyte.sql`** in MySQL Workbench using its SQL editor, or a compatible SQL import tool. This combined file creates/uses the fixed database name `cybernyte`. Use either this import or `db:setup`, not both. Schema-only and seed-only files are also provided.

7. Start Express:

   ```powershell
   npm.cmd start
   ```

8. Open **http://localhost:3000** or the `PORT` configured in `.env`. Do not double-click `index.html` or use VS Code Live Server: Express serves both the frontend and API from one origin.
9. Check `/api/health`. A working connection returns `success: true` and `database: connected`.
10. Log in, add/edit a station, reload the page, and inspect its saved MySQL row. This verifies the complete connection rather than only the login screen.

## What each connection does

```text
HTML forms and existing screen modules
        ↓ Fetch with async/await
Express REST endpoints in server/server.js
        ↓ mysql2 execute(sql, values)
MySQL tables
        ↓ JSON response and GET /api/state
Existing UI refreshes from saved records
```

- `.env` supplies database credentials to `server/db.js`; it is never served to the browser.
- `server/db.js` creates the mysql2 pool and transactions.
- `server/server.js` authenticates requests, checks roles, validates input, and executes parameterized queries.
- `server/helpers.js` maps SQL `snake_case` fields to the frontend's `camelCase`, turns IDs into strings, and converts database timestamps to ISO dates.
- `js/data.js` contains the shared Fetch helper and loads actual database records. There is no sample-data fallback.
- Each form awaits a successful API response, then `App.commit()` reloads records. API errors keep the modal open with a meaningful message.
- Numeric database IDs are displayed directly. Labels such as `PC-01` remain editable station names. IDs do not need client-side counters.

## Permissions

| Feature | Admin | Staff |
|---|---|---|
| Dashboard, stations, customers | Yes | Yes |
| Sessions, reservations, payments | Yes | Yes |
| Categories, food menu, food orders | Yes | Yes |
| User management | Yes | No |
| Reports and CSV export | Yes | No |
| Read cafe information | Yes | Yes |
| Edit cafe information | Yes | No |
| Shared interface preferences | Yes | Yes |

The backend checks permissions even if somebody types an API URL directly. Staff get HTTP 403 from user-management and report endpoints. Staff receive only account IDs/names for historical recorded-by labels, not an account-management directory.

## Images

Seed menu photos use existing paths under `/assets/images/food/`. New uploads go to `uploads/food/` and MySQL stores only a path such as `/uploads/food/unique-name.jpg`.

Use **Food Menu → Add Food/Edit → Photo** to upload or replace an image. Select **Remove current image** to remove it. Uploads accept JPG, PNG, and WebP up to 3 MB; the server checks the file signature. Failed saves remove newly uploaded files. Replacing/removing generated uploads cleans up the old file. Shared seed images under `assets/` are retained so the starter SQL remains reusable.

## CRUD and history

- Stations: create, list, details/history, edit, deactivate/reactivate. Deactivation is the core archive/delete mechanism permitted by the PDF.
- Customers: create, list/details/history, edit, delete if there are no linked sessions/reservations.
- Categories: create, list, edit, activate/deactivate, delete if empty. Inactive categories cannot receive orders.
- Food: create, read, edit, availability toggle, image replacement/removal, delete if not referenced by old orders.
- Sessions: start, details, end; financial history is retained.
- Reservations: create, details, edit upcoming bookings, cancel; past/cancelled history is retained.
- Payments: create/read, full or partial; no destructive payment editing/deletion.
- Orders: create/read details and move Pending → Preparing → Completed, or cancel before completion.
- Users: add/edit, activate/deactivate; cannot remove the last active administrator.

## Business rules and scope

- Server time determines session start/end, and Philippine time (`Asia/Manila`, UTC+08) determines business dates. Use the browser in the same timezone for matching calendar display.
- Gaming charge = starting hourly rate × elapsed minutes ÷ 60, rounded to two decimals; no minimum charge period. Editing a station rate does not change an existing session's rate.
- A station can have only one active session. Maintenance/inactive/currently reserved stations cannot start a session. Transactions lock station records for concurrent writes.
- Bookings must start in the future, end later on the same day, and not overlap on a station. Unassigned bookings are allowed. A running session requires a 30-minute buffer for new bookings. Booking windows are guidance, not automatic PC cut-off; staff start/end sessions manually.
- Payments are manual Cash/GCash/Maya/Other entries after a gaming session ends. No gateway is connected. Overpayment and nonpositive amounts are rejected on the server.
- Revenue is recorded gaming-session payments, not running/unpaid charges or food-order totals. Food orders have no payment workflow in the original UI and remain separate. This is an explicit scope assumption.
- Food quantity is 1–20 per item; service charge remains 0%, matching the existing UI. Prices/totals are calculated by the server; old order lines keep the name and price at purchase time.
- Preferences are shared cafe preferences, as in the original frontend. Cafe settings use one row, not three conflicting settings records.
- Three starter records are inserted per business table, including three order lines. They are SQL seed records, not hardcoded frontend data. The system does not regenerate records on refresh.

## Verification and project documents

- [API request guide](docs/API.md): each request, body, permission, and purpose.
- [Architecture and ERD](docs/ERD.md): database relationships and request flow.
- [Requirements and demo guide](docs/REQUIREMENTS.md): PDF mapping and demonstration sequence.
- [Test report](docs/TESTING.md): executed checks, evidence, and limitations.

Run the API/SQL tests with `npm.cmd test`. They create and drop only a unique disposable test database; the configured account needs create/drop privileges for tests. They do not reset your application database.

Run browser tests with `npm.cmd run test:e2e` after `npx.cmd playwright install chromium`. On a computer with Edge installed, use:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:e2e
```

The browser tests start their own Express server and disposable database. They save evidence screenshots under `docs/screenshots/`.

## Known limitations

Localhost classroom scope: plain-text account passwords, process-memory login sessions (restart means sign in again), no pagination for the small dataset, no actual PC hardware control, no payment gateway, and no food inventory quantities. Topic approval, member contributions, and the live defense must be provided by the group. The database and uploaded files must both be backed up to preserve images and records.

Implementation references: [Express async errors](https://expressjs.com/en/5x/guide/error-handling/), [mysql2 prepared statements](https://sidorares.github.io/node-mysql2/docs/documentation/prepared-statements), and [Multer uploads](https://expressjs.com/en/resources/middleware/multer/).
