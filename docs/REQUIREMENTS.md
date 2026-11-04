# Integrative Programming 2 requirement mapping

Source: `INTEGRATIVE PROGRAMMING 2 FINAL Project.docx.pdf`, pages 5–10. The specification is a project reference; business scope and permissions follow the user's instructions.

| Requirement | Implementation / evidence |
|---|---|
| HTML, CSS, JavaScript frontend | Existing `index.html`, `css/style.css`, screen modules retained |
| Node.js and Express | `server/server.js`, `package.json` |
| MySQL and mysql2 | `server/db.js`, `sql/schema.sql`; tests executed on MySQL 8.4.4 |
| Related tables, PK/FK and suitable types | 11 tables in `sql/schema.sql`; `docs/ERD.md`. Three related tables are a recommendation, not an absolute PDF minimum |
| Core CRUD including details | Stations create/list/details/edit/deactivate/reactivate; customers/categories/menu also have guarded DELETE workflows |
| Database persistence | Every business write uses SQL; refresh reloads through `/api/state`; no localStorage business records or mock fallback |
| REST JSON and HTTP methods | GET, POST, PATCH, DELETE with consistent success/error JSON; `docs/API.md` |
| Fetch and async/await | `js/data.js`, awaited form handlers, shared async modal submit |
| Search and filtering | Existing keyword/status/date filters use loaded database records; categories are dynamic |
| Dashboard from actual data | Existing dashboard and rules calculate summaries from persisted sessions, reservations, stations and payments |
| Frontend and backend validation | Forms + `server/helpers.js` + endpoint business checks |
| Duplicate/missing/invalid/database errors | 400, 401, 403, 404, 409, 500/503; inline modal errors, toasts, login error banner |
| Parameterized queries | mysql2 `execute(sql, values)` for business operations |
| Additional feature 1 | Reservation scheduling with overlap detection and running-session buffer |
| Additional feature 2 | Date-range reports and CSV export, admin only |
| Other features | Food availability/order workflow, dynamic categories, local image CRUD, role-based access |
| Setup/SQL/API/test documents | README, schema/seed/combined SQL, API guide, ERD, test report and screenshots |
| Topic approval and group presentation | Must be supplied/demonstrated by the group; software cannot establish approval or individual contributions |

## Suggested defense sequence

1. Explain the computer shop's manual station/session/payment tracking problem and the admin/staff users.
2. Show the architecture and ERD, then the MySQL tables/foreign keys.
3. Sign in as admin. Add a station, view details, edit its rate/specs, deactivate and reactivate it. Reload and show the SQL row.
4. Add a customer, search by name, view details/history. Demonstrate deleting an unused customer and rejecting deletion of a customer with history.
5. Start a session, end it, and record a partial payment. Explain the rate snapshot and computed balance.
6. Create/edit/cancel a reservation. Show an overlap error from the API.
7. Add a category and food item with an image, replace/remove the image, and explain that MySQL stores only its path.
8. Build a food order, change quantity, place it, and move it through preparation/completion. The order is a saved transaction; no payment gateway is claimed.
9. Show the dashboard, date-range reports and CSV export.
10. Sign in as staff. Show that User Management and Reports are hidden and direct API requests return 403.
11. Open browser DevTools Network to show the Fetch request, JSON body, HTTP status, and response.
12. Run/show the API and browser tests, explain known limitations, and let each member explain their work.

Plain-text passwords remain a stated localhost-demo limitation requested by the user. Parameterized SQL, HTTP-only sessions, server permissions, protected source files, validation, and upload checks are implemented; do not describe plain-text password storage as production-safe.
