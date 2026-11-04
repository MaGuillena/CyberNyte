# Paano binuo at gumagana ang CyberNyte

Dokumentasyon ito ng actual implementation ng CyberNyte: paano nakakonekta ang MySQL sa Express backend, paano ginagamit ng frontend ang API, paano gumagana ang CRUD, at saan makikita ang requirements ng Integrative Programming 2.

Ang system ay para sa computer shop. Admin at staff ang operators; walang customer login o customer-facing interface. Customer records ang pinipili ng operator kapag nagsisimula ng gaming session o gumagawa ng reservation.

## 1. Mga bahagi ng system

| Bahagi | Technology | Trabaho |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Forms, buttons, tables, dashboard at user feedback |
| Communication | Fetch API at async/await | Nagpapadala ng request at naghihintay ng response |
| Backend | Node.js at Express | Login, permissions, validation, business rules at API endpoints |
| Database driver | mysql2 | Nagpapatakbo ng SQL mula sa Node.js |
| Database | MySQL 8.4.4 sa prepared workspace | Permanent storage ng records |
| Images | Local files at saved image paths | Actual file sa folder, reference sa MySQL |

```text
User clicks a button or submits a form
                ↓
Frontend JavaScript calls Fetch
                ↓
Express receives the HTTP request
                ↓
Authentication, permission and input validation
                ↓
mysql2 executes parameterized SQL
                ↓
MySQL reads or saves the records
                ↓
Express returns JSON and an HTTP status
                ↓
Frontend displays the result or error
```

Hindi direktang kumokonekta ang browser sa MySQL. Backend lang ang may database connection settings.

## 2. Paano binuo mula sa dating frontend

Ang dating frontend ay may sample arrays at nagsa-save ng business data sa browser localStorage. Pinanatili ang UI layout, forms, screen modules at calculations, pero pinalitan ang source at destination ng records.

Mga ginawa sa integration:

1. Gumawa ng relational schema mula sa existing users, customers, stations, sessions, reservations, payments at food-order data.
2. Ginawang separate table ang categories para puwedeng mag-add/edit ng category mula sa system.
3. Gumawa ng SQL seed file na may tig-tatlong starter records sa business tables. Isang settings record lang ang kailangan.
4. Gumawa ng Express server at mysql2 connection pool.
5. Nagdagdag ng login session, server-side role checks, input validation at consistent errors.
6. Gumawa ng GET, POST, PATCH at DELETE endpoints.
7. Pinalitan ang local array writes ng awaited API requests sa existing form handlers.
8. Ginawang async ang shared modal handler para hindi magsara ang form habang pending o failed ang request.
9. Nagdagdag ng local image upload, replacement at removal.
10. Nag-test gamit ang actual MySQL, API requests at real browser workflows.

Ang starter records ay nasa SQL na. Hindi na sila nire-regenerate ng frontend kapag nag-refresh. Business-rule constants tulad ng allowed payment methods at maximum order quantity ay configuration; hindi sila fabricated database records.

## 3. Paano nakakonekta ang database sa backend

### Connection configuration

Binabasa ng `dotenv` ang `.env`. Ito ang relevant settings sa current computer:

```dotenv
PORT=3015
DB_HOST=127.0.0.1
DB_PORT=3318
DB_USER=root
DB_PASSWORD=
DB_NAME=cybernyte
```

Ang website ay nasa port **3015**. Ang MySQL ay nasa port **3318**. Hindi sila iisang port. Ang actual `.env` ay may sarili ring session secret; hindi iyon inilalagay sa frontend o public documentation.

### mysql2 connection pool

Actual file: [server/db.js](../server/db.js).

```javascript
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cybernyte',
  connectionLimit: 8,
  decimalNumbers: true,
  dateStrings: true,
  timezone: '+08:00'
});
```

- `createPool()` ang gumagawa ng reusable database connections.
- `mysql2/promise` ang nagbibigay ng Promise-based queries na puwedeng gamitan ng `await`.
- `process.env` ang kumukuha ng configuration mula sa environment.
- `decimalNumbers` ang nagpapabalik ng DECIMAL values bilang JavaScript numbers para sa existing calculations.
- Sine-set din ng code ang MySQL connection timezone sa `+08:00` para sa Philippine business dates.

### Paano ginagamit ng endpoint ang connection

Halimbawa mula sa [server/server.js](../server/server.js), paggawa ng customer:

```javascript
const [insert] = await pool.execute(
  'INSERT INTO customers (full_name,contact_number) VALUES (?,?)',
  [fullName, number]
);
```

Ang `fullName` at `number` ay na-validate na bago makarating dito. Ang `?` ay placeholders; hiwalay ang SQL statement at user input. Ito ang parameterized query requirement sa PDF.

Ang `insert.insertId` ay bagong ID na ginawa ng MySQL `AUTO_INCREMENT`. Hindi na frontend counter ang gumagawa ng record IDs.

### Schema at relationships

Nasa [sql/schema.sql](../sql/schema.sql) ang 11 tables. Nasa [sql/seed.sql](../sql/seed.sql) ang starter data. Nasa [sql/cybernyte.sql](../sql/cybernyte.sql) ang combined import file.

| Table | Data na sine-save |
|---|---|
| users | Admin/staff accounts at activation |
| customers | Customer names at contact numbers |
| stations | PC names/specifications/rates/maintenance |
| gaming_sessions | Customer, station, start/end time, rate snapshot at final charge |
| reservations | Customer, optional station, booking date/time at cancellation |
| payments | Session payments, amount, method at recorded-by user |
| categories | Editable food categories at activation |
| food_items | Menu information, price, availability at image path |
| food_orders | Order header, totals at workflow status |
| food_order_items | Saved items, quantities, names at prices per order |
| cafe_settings | Cafe information at shared preferences |

Halimbawa ng relationship: `gaming_sessions.customer_id` references `customers.id`. Hindi puwedeng gumawa ng session para sa nonexistent customer. May backend check at may foreign key din sa database.

Hiwalay ang order header sa order lines dahil maaaring maraming food items ang isang order. Hiwalay ang payments sa session dahil puwedeng maraming partial payments ang isang session. Nasa [ERD](ERD.md) ang diagram.

## 4. Paano ginagamit ng frontend ang backend

Actual Fetch helper: [js/data.js](../js/data.js).

Kapag tumawag ang screen ng:

```javascript
await API.request('/customers', 'POST', {
  fullName: 'Test Customer',
  contactNumber: '09175550111'
});
```

Ang helper ay gumagawa ng request sa `/api/customers`, nilalagay ang JSON body, at naghihintay sa response gamit ang `await fetch(...)`.

Ganito ang importanteng bahagi ng helper:

```javascript
options.headers['Content-Type'] = 'application/json';
options.body = JSON.stringify(body);

const response = await fetch(`/api${path}`, options);
const result = await response.json();
```

Ang `JSON.stringify()` ay nagko-convert ng JavaScript object papuntang JSON text. Ang `response.json()` ay nagko-convert ng response pabalik sa JavaScript object.

### Pag-load ng records

Actual frontend loader:

```javascript
const DB = {
  data: null,
  async load() {
    this.data = await API.request('/state');
    return this.data;
  }
};
```

Ang `GET /api/state` ay kumukuha ng database collections sa pamamagitan ng [server/state.js](../server/state.js). Ang existing screens ay nagre-render mula sa loaded `DB.data`.

`DB.data` ay in-memory copy ng server records para sa UI; hindi ito ang permanent database. Kapag nag-refresh, muling kumukuha ng records sa backend.

### Pag-save at pag-refresh ng UI

Actual station form handler sa [js/stations.js](../js/stations.js):

```javascript
await API.request(
  '/stations' + (isEdit ? '/' + station.id : ''),
  isEdit ? 'PATCH' : 'POST',
  { name, specs, hourlyRate: rate, status: v.status }
);

await App.commit();
UI.toast('Station saved.');
```

Kapag bagong record, `POST` ang gamit. Kapag edit, `PATCH` at record ID ang gamit. Naghihintay muna ng successful save bago mag-reload ng data at magpakita ng success.

Ang `App.commit()` sa [js/app.js](../js/app.js) ay naglo-load ulit ng state, nagche-check ng current user, at nagre-refresh ng current screen.

### SQL names at frontend names

Sa SQL, `full_name` ang column. Sa frontend, `fullName` ang property. Ang [server/helpers.js](../server/helpers.js) ang nagma-map ng `snake_case` papuntang `camelCase` at nagko-convert ng numeric IDs sa strings na compatible sa existing UI comparisons.

### Details at search

Ang existing detail modals at search/filter controls ay gumagamit ng loaded database snapshot. Halimbawa, customer details ay kumukuha ng customer, related sessions at payments mula sa `DB.data`.

May individual `GET /api/customers/:id`, `GET /api/stations/:id` at ibang read endpoints din para sa direct API retrieval. Hindi ibig sabihin na bawat pag-open ng existing detail modal ay gumagawa ng bagong individual GET; karamihan ay gumagamit ng records na na-load na sa `/api/state`.

## 5. Paano gumagana ang CRUD

### Create

Halimbawa: Add Customer.

1. Naglalagay ng name/contact ang admin o staff.
2. Chine-check ng frontend ang required name at contact format.
3. Nagpapadala ng `POST /api/customers`.
4. Vine-validate ulit ng backend ang input.
5. Nagpapatakbo ng parameterized `INSERT`.
6. MySQL ang gumagawa ng ID.
7. Nagbabalik ng `201 Created` at JSON.
8. Nire-refresh ng frontend ang records.

### Read at record details

Halimbawa: Customer list/details.

1. Nagpapadala ng `GET /api/state` pagkatapos ng login o data refresh.
2. Nagpapatakbo ang backend ng SELECT queries.
3. Nagbabalik ng JSON records na walang account passwords.
4. Dinidisplay ng frontend ang list/table.
5. Sa View Details, ipinapakita ang selected record at related history mula sa loaded records.

Ang standalone customer-detail endpoint ay `GET /api/customers/:id`. Kapag walang record, `404 Not Found` ang response.

### Update

Halimbawa: Edit Customer.

```javascript
await pool.execute(
  'UPDATE customers SET full_name=?, contact_number=? WHERE id=?',
  [fullName, number, id(req.params.id)]
);
```

Ang ID sa URL ang tumutukoy sa record. Hindi gumagawa ng bagong row ang edit. Pagkatapos ng update, nire-reload ng UI ang saved values.

### Delete at deactivation

May dalawang paraan depende sa record:

| Record | Ginagamit na action | Dahilan |
|---|---|---|
| Stations/users | Deactivate/reactivate gamit ang PATCH | Manatili ang sessions, payments at account history |
| Customers | DELETE kung walang linked history | Foreign keys protect referenced records |
| Categories | DELETE kung empty; deactivate kung ginagamit | Manatiling valid ang related food items |
| Food items | DELETE kung walang order history; out-of-stock kung ginagamit | Manatili ang old order references |
| Reservations | Cancel | Retained ang booking history |
| Payments/completed sessions/orders | Retained history | Hindi basta binubura ang transaction records |

Actual customer deletion:

```javascript
await pool.execute(
  'DELETE FROM customers WHERE id=?',
  [id(req.params.id)]
);
```

Kapag referenced ang customer ng session/reservation, tatanggihan ng foreign key ang deletion at magbabalik ang API ng meaningful `409 Conflict`.

Para sa stations, `active = false` ang ise-save. Ito ang core archive/deactivation mechanism, na pinapayagan ng PDF. Hindi kailangang hard-delete ang lahat ng uri ng records para matugunan ang CRUD requirement.

## 6. Login at role permissions

1. Nagpapadala ang login form ng `POST /api/auth/login`.
2. Hinahanap ng backend ang username sa `users` gamit ang parameterized query.
3. Chine-check ang password at active status.
4. Gumagawa ng server session at nagse-set ng HTTP-only session cookie.
5. Kasama ang cookie sa succeeding same-origin Fetch requests.
6. Muling chine-check ng backend ang active account bago payagan ang protected request.

| Feature | Admin | Staff |
|---|---|---|
| Shop operations | Allowed | Allowed |
| User management | Allowed | Forbidden |
| Reports/CSV | Allowed | Forbidden |
| Edit cafe information | Allowed | Forbidden |
| Read cafe info/shared preferences | Allowed | Allowed |

Nakatago ang protected sidebar links para sa staff. May backend permission check din: kahit direktang tawagin ang `/api/users` o `/api/reports`, `403 Forbidden` pa rin ang response.

Plain-text passwords ang requested localhost-demo implementation. May real server-session/role enforcement, pero hindi production-safe ang password storage. Nawawala rin ang memory-based login sessions kapag ni-restart ang Express; kailangang mag-login ulit.

## 7. Business rules at additional features

### Gaming sessions at billing

- Server ang nagtatakda ng session start/end time.
- Sine-save ang hourly rate noong nagsimula ang session. Hindi naaapektuhan ang old session kapag binago ang station rate.
- Formula: `hourly rate × elapsed minutes / 60`, rounded to two decimals.
- Isang active session lang ang pinapayagan sa bawat station.
- Hindi puwedeng gamitin ang maintenance, inactive o currently reserved station.

Gumagamit ang backend ng transaction at row locks para sa concurrent operations. Kung dalawang staff ang sabay na mag-start sa parehong station, isa lang ang matatanggap.

### Payments

- Pagkatapos lang matapos ang session puwedeng mag-record ng payment.
- Puwedeng full o partial.
- Server ang nagre-recompute ng remaining balance.
- Hindi puwede ang zero/negative payment o overpayment.
- Session record ang naka-lock habang nire-record ang payment para hindi lumampas ang dalawang sabay na payment sa balance.

Manual record lang ang Cash/GCash/Maya/Other; walang external payment gateway.

### Reservations

- Future bookings lang at dapat later ang end time sa parehong araw.
- Puwedeng walang station assignment muna.
- Hindi puwedeng overlapping bookings sa parehong station.
- May 30-minute booking buffer kapag may running session.
- Upcoming reservations lang ang puwedeng i-edit; cancellation keeps history.

### Food orders at categories

- Dynamic ang category dropdowns mula sa MySQL.
- Hindi puwedeng i-order ang unavailable food o item sa inactive category.
- Cart ay temporary browser memory; placed orders lang ang saved transactions.
- Server ang kumukuha ng current prices at nagko-compute ng totals. Hindi pinagkakatiwalaan ang total na maaaring ipadala ng browser.
- Saved ang item name at unit price sa order lines para hindi magbago ang old receipts kapag nag-edit ng menu.
- Status flow: Pending → Preparing → Completed; cancellation bago makumpleto.

### Dashboard at reports

Ang counts, revenue chart, active sessions, upcoming bookings at balances ay kinukuwenta mula sa actual SQL records na ni-load ng API.

Revenue ay recorded gaming-session payments. Hindi kasama ang unpaid/running charges o food-order totals. Hiwalay ang food orders dahil walang food-payment workflow ang original scope.

Additional features na ginagamit para sa PDF demonstration: reservation conflict checking at date-range reports/CSV export.

## 8. Paano gumagana ang image CRUD

1. Sa Add/Edit Food form, pumipili ng image file ang operator.
2. Ipinapadala ito bilang `FormData`, hindi JSON/base64.
3. Tumatanggap ang Multer middleware ng upload.
4. Chine-check ng backend ang file size at JPG/PNG/WebP signature.
5. Sine-save ang actual file sa `uploads/food/` gamit ang generated unique filename.
6. Path lang, halimbawa `/uploads/food/unique-name.png`, ang sine-save sa `food_items.image_path`.
7. Express ang nagsi-serve ng image kapag nilo-load ito ng browser.

Sa replace/remove, nililinis ang lumang generated upload kapag successful ang change. Kapag failed ang save, nililinis ang bagong uploaded file. Ang shared starter images sa `assets/` ay pinapanatili para reusable pa rin ang seed SQL.

## 9. Validation at errors

Frontend validation ay para sa mabilis na feedback. Backend validation ang final check bago ma-save sa MySQL.

| HTTP status | Kahulugan sa system |
|---|---|
| 200 | Successful read/update/delete |
| 201 | Created ang bagong record |
| 400 | Invalid o missing input |
| 401 | Hindi signed in o wrong login |
| 403 | Walang permission |
| 404 | Walang record o endpoint |
| 409 | Duplicate, booking conflict, invalid transition, linked history o concurrent conflict |
| 500 | Database/server problem |
| 503 | Missing required cafe settings sa current implementation |

Example error response:

```json
{
  "success": false,
  "message": "Payment exceeds the remaining balance.",
  "errors": {
    "amount": "Maximum payment is 25.00."
  }
}
```

Binabasa ito ng Fetch helper. Ang shared modal handler sa `js/ui.js` ay naghihintay sa request, nagdi-disable ng submit habang pending, at nagpapakita ng error nang hindi isinasara ang form.

## 10. Pagtapat sa PDF requirements

Basehan: `INTEGRATIVE PROGRAMMING 2 FINAL Project.docx.pdf`, lalo na pages 5–10.

| Requirement | Paano ginawa | Evidence |
|---|---|---|
| Functional frontend | Existing UI at working forms | index.html, css/style.css, js modules |
| Node.js + Express | Express server at routes | server/server.js, package.json |
| MySQL + mysql2 | Connection pool at real SQL storage | server/db.js, sql files |
| Related tables, PK/FK | 11 tables at relationships | sql/schema.sql, docs/ERD.md |
| Complete core CRUD/details | Stations plus permitted deactivation | js/stations.js, station API |
| REST JSON API | GET/POST/PATCH/DELETE at status codes | server/server.js, docs/API.md |
| Fetch + async/await | Shared helper at awaited form handlers | js/data.js, js/ui.js |
| Persistence | Reload reads saved database rows | GET /api/state, server/state.js |
| Search/filter | Keyword/status/date/category filtering ng loaded records | Existing screen modules |
| Actual-data dashboard | Derived station/session/payment summaries | js/dashboard.js, js/rules.js |
| Frontend/backend validation | Form feedback plus server guards | js modules, server/helpers.js, routes |
| Meaningful errors | Structured JSON at inline messages | Error middleware, API helper, modals |
| Parameterized queries | SQL placeholders with separate values | mysql2 execute calls |
| At least two additional features | Reservations; reports/CSV | Reservation/report modules at API |
| Setup documentation | Local/new-computer instructions | README.md, GABAY.md, MYSQL-SETUP.md |
| SQL scripts | Schema, starter records, combined import | sql/schema.sql, seed.sql, cybernyte.sql |
| ERD/API docs | Relationships and request contracts | docs/ERD.md, docs/API.md |
| Testing evidence | API/SQL and real browser checks | tests/, docs/TESTING.md |

Tatlong related tables ay recommendation sa PDF, hindi absolute minimum sa lahat ng approved topics. Gumagamit ang CyberNyte ng 11 tables dahil iyon ang kailangan ng retained workflows.

Hindi automatic na napapatunayan ng code ang topic approval, individual group contributions at live defense. Ang mga iyon ay responsibilidad pa rin ng group. Ang plain-text passwords ay documented security limitation; huwag itong ipresenta bilang production-safe.

## 11. Testing na ginawa

Na-test ang submitted implementation sa **actual MySQL 8.4.4**.

- **18 API/database scenarios passed**, kabilang ang CRUD, validation, protected endpoints, actual image operations at concurrent session/payment checks.
- **11 browser workflow groups passed**, kabilang ang actual forms, Fetch requests, reload persistence, CSV download at mobile layout.
- Walang uncaught browser JavaScript errors sa recorded successful run.
- Disposable test databases ang ginamit; hindi nire-reset ng tests ang application database.

Commands:

```powershell
npm.cmd test

$env:BROWSER_CHANNEL = 'msedge'
npm.cmd run test:e2e
```

Detailed evidence: [TESTING.md](TESTING.md), [API results](api-results.tap), at [browser results](browser-results.json). Ang recorded tests ay hindi production load/security audit o guarantee sa lahat ng browsers.

## 12. Paano ipapakita sa demonstration

1. I-open ang http://localhost:3015 at mag-login bilang admin.
2. Buksan ang browser DevTools gamit ang F12, then Network tab at Fetch/XHR filter.
3. Mag-add ng station. Ipakita ang POST request, JSON body, HTTP 201 at response ID.
4. Sa MySQL Workbench, run `SELECT * FROM stations;` para makita ang saved row.
5. I-refresh ang website para ipakita ang persistence.
6. I-view ang details, i-edit ang station, at i-deactivate/reactivate. Ipakita ang PATCH requests at `active` value sa SQL.
7. Gumawa ng unused customer at i-delete; ipakita ang DELETE request. Subukang i-delete ang customer na may history para ipakita ang 409 error.
8. Start/end session at record partial payment. Ipaliwanag ang server time, rate snapshot at balance.
9. Gumawa ng reservation at subukang mag-overlap para makita ang validation.
10. Mag-add ng category/food/photo at place ng food order.
11. Ipakita ang dashboard, date-filtered report at CSV download.
12. Mag-login bilang staff at ipakita na walang User Management/Reports access, pati sa direct API calls.
13. Ipakita ang ERD, API guide, test results at known limitations.

Maikling paliwanag na puwedeng gamitin sa defense:

> Ang frontend namin ay nagpapadala ng HTTP requests gamit ang Fetch API. Tumatanggap ang Express backend ng requests, nagche-check ng login, permission at input, at gumagamit ng mysql2 parameterized queries para magbasa o mag-save sa MySQL. Nagbabalik ito ng JSON response, pagkatapos nire-refresh ng frontend ang displayed records. Kaya nananatili ang data kahit mag-refresh ng browser.
