# API requests and their purpose

Base URL: `http://localhost:3015/api` on this prepared workspace, or your configured Express port. JSON requests use `Content-Type: application/json`. Login sets an HTTP-only session cookie. Fetch uses `credentials: 'same-origin'`. No credentials belong in frontend JavaScript.

Success format:

```json
{"success":true,"data":{"id":"4"},"message":"Station saved."}
```

Error format:

```json
{"success":false,"message":"Invalid amount.","errors":{"hourlyRate":"Enter an amount greater than zero, up to 1000."}}
```

Statuses: 200 read/update/delete success; 201 created; 400 invalid input; 401 not signed in/wrong login; 403 forbidden; 404 missing record/endpoint; 409 duplicate, related history, invalid transition or business conflict; 500 database/server unavailable. Database settings missing returns 503. SQL details and passwords are not returned.

## Request matrix

All business endpoints require a signed-in active account. **Admin only** applies to every user-management endpoint, all reports, and cafe-information updates.

| Method and endpoint | Request body / parameters | Purpose and frontend |
|---|---|---|
| GET `/health` | None | Check Express → MySQL connectivity |
| POST `/auth/login` | `username`, `password` | Verify the SQL account and start a server session; login form |
| GET `/auth/me` | None | Restore/check the current login after refresh |
| POST `/auth/logout` | None | Destroy the login session |
| GET `/state` | None | Load database collections for the existing screen modules; no passwords |
| GET `/dashboard` | None | Database-based record/session/revenue summary |
| GET `/stations` | Optional `q`, `status` | List/search computer records |
| GET `/stations/:id` | ID in path | Read one station |
| POST `/stations` | `name`, `specs`, `hourlyRate`, `status` | Add Station form |
| PATCH `/stations/:id` | Same editable fields, or only `active` | Edit/maintenance or deactivate/reactivate |
| GET `/customers` | Optional `q` | Customer list/search |
| GET `/customers/:id` | ID | Customer details; UI joins loaded sessions/payments for history |
| POST `/customers` | `fullName`, optional `contactNumber` | Add Customer form |
| PATCH `/customers/:id` | `fullName`, optional `contactNumber` | Edit Customer form |
| DELETE `/customers/:id` | None | Delete an unreferenced customer; linked history returns 409 |
| GET `/sessions` | Optional `q`, `status` | Gaming session list |
| GET `/sessions/:id` | ID | Session details |
| POST `/sessions` | `customerId`, `stationId` | Start session using server time and current station rate |
| PATCH `/sessions/:id/end` | None | End once and save the server-calculated charge |
| GET `/reservations` | Optional `q`, `date`, stored `status` | Booking records |
| GET `/reservations/:id` | ID | Booking details |
| POST `/reservations` | `customerId`, optional `stationId`, `date`, `startTime`, `endTime` | Create future booking |
| PATCH `/reservations/:id` | Same booking fields, or only `status: "cancelled"` | Edit upcoming booking or cancel |
| GET `/payments` | Optional `q` | Manual payment history |
| GET `/payments/:id` | ID | Payment details including derived customer ID |
| POST `/payments` | `sessionId`, `amount`, `method` | Record Payment form; check completed session and current balance |
| GET `/categories` | Optional `q` | Populate category management, dropdowns and filters |
| GET `/categories/:id` | ID | Read category |
| POST `/categories` | `name` | Add Category form |
| PATCH `/categories/:id` | `name` and/or `active` | Rename or deactivate/reactivate category |
| DELETE `/categories/:id` | None | Delete empty category; linked food returns 409 |
| GET `/food-items` | Optional `q`, `category` (ID) | Menu cards, food search/filter |
| GET `/food-items/:id` | ID | Read food record and image path |
| POST `/food-items` | See upload example below | Add Food form |
| PATCH `/food-items/:id` | Same food fields, or only `available` | Edit food/photo or toggle availability |
| DELETE `/food-items/:id/image` | None | Remove image reference and generated upload file |
| DELETE `/food-items/:id` | None | Delete food with no order history; otherwise 409 |
| GET `/food-orders` | Optional `status`, `q` | Order history |
| GET `/food-orders/:id` | ID | Saved line items and totals |
| POST `/food-orders` | `items: [{foodId, quantity}]` | Place the cart as a saved order; prices come from MySQL |
| PATCH `/food-orders/:id/status` | `status` | Pending → Preparing → Completed; cancel Pending/Preparing |
| GET `/users` | Admin only | User-management list |
| GET `/users/:id` | Admin only | Account record without password |
| POST `/users` | Admin: `fullName`, `username`, `password`, `role` | Add Staff Account form |
| PATCH `/users/:id` | Admin: same fields; blank password keeps existing; or only `active` | Edit/activate/deactivate account |
| GET `/settings` | None | Cafe information and shared preferences |
| PATCH `/settings` | Admin: `cafeName`, `address`, `contactNumber`, `openingHours` | Save Cafe Information |
| PATCH `/settings/preferences` | `compactTables`, `reduceMotion` | Persist both shared preferences |
| GET `/reports` | Admin: optional `from`, `to` dates | Payment transactions and revenue in date range; checks CSV access |

The original UI filters its loaded database snapshot locally to preserve its responsive search behavior. List endpoints also support the filters above. Derived station states (`in_use`, `reserved`) and booking states (`upcoming`, `ongoing`, `completed`) are calculated by `Rules` for display; stored station statuses are `available`/`maintenance`, and stored booking statuses are `confirmed`/`cancelled`.

## Example frontend request

```javascript
const response = await fetch('/api/stations', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'PC-04',
    specs: 'Intel i5 / 16GB RAM',
    hourlyRate: 40,
    status: 'available'
  })
});
const result = await response.json();
if (!response.ok) throw new Error(result.message);
```

The actual UI calls the shared `API.request()` helper rather than duplicating this code in every screen. `App.commit()` reloads the saved SQL records after success.

## Food image request

Use multipart `FormData`, not JSON/base64, for image uploads:

```javascript
const body = new FormData();
body.append('name', 'Cake');
body.append('categoryId', selectedCategoryId);
body.append('description', 'Chocolate cake');
body.append('price', '50');
body.append('featured', 'false');
body.append('available', 'true');
body.append('image', fileInput.files[0]);
await API.request('/food-items', 'POST', body);
```

Do not set the multipart Content-Type manually: the browser supplies its boundary. On edit, omit `image` to keep the current photo; `removeImage=true` removes it. Image paths are assigned by the server, never arbitrary filesystem paths supplied by users.

## Database query example

```javascript
await pool.execute(
  'INSERT INTO customers (full_name, contact_number) VALUES (?, ?)',
  [fullName, contactNumber]
);
```

The `?` values are parameterized. The only interpolated table names in shared read helpers are fixed source-code names. The database name used by the setup script is restricted to letters, digits and underscores.
