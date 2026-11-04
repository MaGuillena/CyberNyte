# Verification report

Verification date: **November 5, 2026, Asia/Manila**.

The final database tests run against **MySQL Community Server 8.4.4**, using mysql2 and the submitted schema/seed SQL. Early compatibility checks also passed on XAMPP MariaDB 10.4.32, but the final evidence uses actual MySQL, matching the project specification.

## API and SQL integration

Command: `npm.cmd test`.

Result: **18 scenarios passed; 0 failures**. Node's TAP total is 19 because it also counts the containing parent test. Raw evidence: [api-results.tap](api-results.tap).

| Scenario | Result |
|---|---|
| Anonymous access, invalid login, SQL-injection login attempt | Passed |
| Login cookie, password omission, three seed records from SQL | Passed |
| Staff denied user management/reports and cafe-information writes | Passed |
| Station create/details/search/update/deactivate/reactivate | Passed |
| Invalid amount/contact/ID, missing record, protected history deletion | Passed |
| Customer create/edit/details/delete and literal SQL-looking input | Passed |
| Two simultaneous session starts: one accepted, one rejected | Passed |
| Server-calculated session charge, repeat-end rejection, rate snapshot | Passed |
| Concurrent payments: overpayment rejected | Passed |
| Reservation IDs, overlap rejection, invalid date, edit/cancel | Passed |
| Category create/duplicate/edit/delete and linked-record protection | Passed |
| Actual image upload/retrieval/replacement/removal and file cleanup | Passed |
| Invalid image bytes rejected | Passed |
| Order prices/totals from SQL, detail lines, status transitions, inactive category | Passed |
| Unreferenced food delete and availability update | Passed |
| Account creation/deactivation, last-admin rule, shared preferences | Passed |
| Report revenue matches SQL payments; private source/config inaccessible | Passed |
| Logout invalidates the server session | Passed |

Tests create a uniquely named `cybernyte_test_*` database and drop only that database afterward. They use a temporary Express server on an OS-assigned port. Application seed records are unaffected.

## Real browser end-to-end verification

Command used on this Windows computer:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:e2e
```

Result: **11 workflow groups passed**, with **no uncaught browser JavaScript errors**. Machine-readable evidence: [browser-results.json](browser-results.json).

The browser uses the real HTML, Fetch calls, Express handlers and MySQL database. No API responses are mocked. Checks include admin login/dashboard; station CRUD/details/deactivation and persistence after reload; customer CRUD/details/search; dynamic category and menu/image forms; food cart/orders; session end and partial payment through chained modals; reservation creation; reports and an actual CSV download; admin user management; staff sidebar/direct-URL/API restrictions; and mobile layout/menu behavior.

Evidence screenshots were opened for visual inspection:

- [Admin reports](screenshots/admin-reports.png)
- [Staff dashboard](screenshots/staff-dashboard.png)
- [Mobile dashboard](screenshots/mobile-dashboard.png)

Browser tests use their own `cybernyte_browser_*` database and delete it afterward. Screenshots may therefore show temporary browser-test records rather than the application's three-record starter dataset.

## Limits of this evidence

This verifies the implemented local workflows, not a production deployment, high-load performance, every browser, or a security audit. Plain-text password storage is the requested classroom limitation. Login sessions use process memory and are lost on restart. The live presentation, topic approval, and individual contributions remain group responsibilities.
