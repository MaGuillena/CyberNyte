# Gabay sa pagpapatakbo ng CyberNyte

Para sa paliwanag kung paano binuo ang database/backend/frontend connection, CRUD at PDF requirements, basahin ang [Paano gumagana ang system](docs/PAANO-GUMAGANA-ANG-SYSTEM.md).

Tapos na ang frontend-to-backend-to-database integration. Pareho pa rin ang existing UI. Admin at staff lang ang nagla-login; ang customers ay records na sila ang nagma-manage.

## Sa computer na ito

1. Sa VS Code, buksan ang folder na `CyberNyte`.
2. Mag-open ng terminal sa folder na iyon.
3. Patakbuhin:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
   ```

4. Buksan ang **http://localhost:3015**. Ito ang current port, dahil may ibang app na gumagamit ng port 3000.
5. Mag-login:

   | Role | Username | Password |
   |---|---|---|
   | Admin | admin | admin123 |
   | Staff | staff | staff123 |
   | Staff | mika | mika123 |

6. Huwag isara ang terminal habang ginagamit ang system. `Ctrl+C` para ihinto ang Express.

May working MySQL 8.4.4 na sa workspace na ito, port **3318**. Ang actual database files ay nasa `tmp/mysql8-data`. Huwag burahin ang folder na iyon kung gusto mong panatilihin ang records. Ang local MySQL ay background process; hindi Windows service. Pinapaandar ito ng startup script kapag kailangan.

## Kung ililipat sa ibang computer

1. Install at start **MySQL 8** at install **Node.js 20+**.
2. Sa project terminal, run `npm.cmd ci` para ma-install ang packages mula sa lockfile.
3. Run `Copy-Item .env.example .env`.
4. Sa `.env`, ilagay ang database connection:

   ```dotenv
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=ilagay_ang_mysql_password_mo
   DB_NAME=cybernyte
   SESSION_SECRET=palitan_ng_mahabang_random_na_text
   ```

   `DB_PORT` ay MySQL port; `PORT` ay website/Express port. Magkaibang bagay ang mga ito. Kung walang password ang sarili mong local MySQL, blank ang `DB_PASSWORD=`.

5. Run `npm.cmd run db:setup`. Gagawa ito ng database/tables at maglalagay ng tig-tatlong starter records sa business tables. Isang settings row lang dahil iisang comshop ang configuration.
6. Run `npm.cmd start`.
7. Open **http://localhost:3000** o ang port na inilagay mo sa `.env`.

Alternative sa step 5: import ang **`sql/cybernyte.sql`** sa MySQL Workbench. May `CREATE DATABASE`, lahat ng `CREATE TABLE`, at seed `INSERT` na iyon. Piliin ang isang paraan lang; huwag i-import ulit kung mayroon nang tables. Walang automatic delete/reset ng existing database.

Ang XAMPP ay karaniwang MariaDB ang kasama. Gumamit ng actual MySQL kung kailangang eksaktong sundin ang PDF. Na-test ang project na ito sa actual **MySQL 8.4.4**.

## Para saan ang bawat connection

**SQL → backend:** Binabasa ng `server/db.js` ang `.env`. Gumagamit ito ng `mysql2` connection pool. `server/server.js` ang nagpapatakbo ng SQL statements gamit ang `?` parameters para hindi direktang pinagdudugtong ang user input sa SQL.

**Frontend → backend:** Ang `js/data.js` ay may `API.request()`. Gumagamit ito ng Fetch at `async/await` para magpadala at maghintay sa response. Hindi na nagse-save ng business records sa localStorage.

**Backend → frontend:** Pagkatapos ng successful write, tumatawag ang form sa `App.commit()`. Nire-reload nito ang saved database records at nire-refresh ang UI. Kapag may error, hindi isinasara ang form at ipinapakita ang error.

Halimbawa ng Add Station:

```text
Add Station form
  → POST /api/stations
  → server validation at permission check
  → INSERT INTO stations (...)
  → HTTP 201 + JSON response
  → GET /api/state
  → bagong station sa UI
```

## Para saan ang request methods

| Method | Gamit | Halimbawa |
|---|---|---|
| GET | Kumuha ng saved records/details | `GET /api/stations/1` |
| POST | Gumawa ng bagong record | `POST /api/customers` |
| PATCH | Mag-edit o magpalit ng status | `PATCH /api/stations/1` |
| DELETE | Mag-delete kung walang linked history | `DELETE /api/categories/4` |

Para sa stations at users, deactivation ang ginagamit para manatili ang history. Pinapayagan ito ng PDF bilang appropriate archive/deactivation mechanism. Hindi kailangang burahin ang financial records para masabing may CRUD.

Nasa **`docs/API.md`** ang lahat ng endpoints, request fields, at purpose ng bawat isa.

## Images

Sa Food Menu, click **Add Food** o **Edit**. Pumili ng Photo, then Save. Ang backend ang magse-save ng file sa `uploads/food/` at path lang sa MySQL. Puwedeng palitan o alisin ang photo sa Edit form. Ang original seed images ay nasa `assets/images/food/`.

## Roles

- **Admin:** access sa lahat, kasama ang User Management at Reports.
- **Staff:** walang User Management at Reports; may operations access. Read-only ang cafe information, pero puwedeng baguhin ang shared interface preferences.
- Parehong nasa frontend at backend ang restrictions. Kahit direktang tawagin ng staff ang protected API, `403 Forbidden` ang response.

## Testing at demonstration

1. Run `npm.cmd test` para sa API/database tests.
2. Para sa real browser tests gamit ang installed Edge:

   ```powershell
   $env:BROWSER_CHANNEL = 'msedge'
   npm.cmd run test:e2e
   ```

3. Tests use their own disposable database; hindi nila nire-reset ang actual `cybernyte` database.
4. Nasa `docs/TESTING.md` ang results at screenshots.
5. Nasa `docs/REQUIREMENTS.md` ang PDF checklist at suggested defense sequence.

Local classroom demo ang target. Plain-text password ang ginamit ayon sa request mo; kailangan ng password hashing bago gumamit ng real accounts o mag-deploy. Manual ang session tracking at payment recording; walang PC remote-control o payment gateway.
