# Paano na-set up ang MySQL ng CyberNyte

Ang CyberNyte ay gumagamit ng actual **MySQL Community Server 8.4.4**. Localhost lang ang setup: parehong nasa computer mo ang website, Express backend, at database.

## Saan bubuksan at susubukan

**System:** http://localhost:3015

| Role | Username | Password |
|---|---|---|
| Admin | admin | admin123 |
| Staff | staff | staff123 |
| Staff | mika | mika123 |

Sa website ka mag-a-add/edit ng records. Sa MySQL Workbench o MySQL command line mo makikita ang actual tables at SQL rows.

Kung hindi bumubukas ang website, buksan ang VS Code terminal sa `CyberNyte` folder at run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Huwag isara ang terminal habang ginagamit ang website. Huwag buksan ang `index.html` sa pamamagitan ng double-click o Live Server; gamitin ang Express URL sa itaas.

## Actual connection settings sa computer mo

| Setting | Current value | Para saan |
|---|---|---|
| MySQL version | 8.4.4 | Database server |
| Host | 127.0.0.1 | Sarili mong computer |
| MySQL port | 3318 | Connection papunta sa database |
| Database name | cybernyte | Lalagyan ng system tables |
| Database username | root | Local database account |
| Database password | Blank sa prepared local instance | Local demo connection |
| Express port | 3015 | Website at API |

Magkaiba ang **3318 para sa MySQL** at **3015 para sa website**. Ginamit ang mga port na ito dahil may ibang programs nang gumagamit ng usual ports sa computer mo.

Ang `admin/admin123` ay login sa CyberNyte application. Iba iyon sa `root` database account.

## Paano ginawa ang setup

1. Gumamit ng portable official MySQL 8.4.4 runtime. Hindi ito ang MariaDB na kasama ng XAMPP, at walang Windows service na in-install.
2. In-extract ang runtime sa:

   ```text
   CyberNyte/tmp/mysql-runtime/mysql-8.4.4-winx64/
   ```

3. Nag-initialize ng bagong hiwalay na data directory sa:

   ```text
   CyberNyte/tmp/mysql8-data/
   ```

   Dito naka-save ang actual database files. Hindi sa SQL script naka-save ang future changes ng user. Huwag burahin ang directory na ito kung gusto mong panatilihin ang database.

4. Pinatakbo ang MySQL sa `127.0.0.1:3318`. Ang `scripts/start-local.ps1` ang puwedeng mag-start ulit nito pagkatapos ng reboot, bago patakbuhin ang Express.
5. Nilagay ang connection configuration sa `.env`:

   ```dotenv
   PORT=3015
   DB_HOST=127.0.0.1
   DB_PORT=3318
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=cybernyte
   SESSION_SECRET=may-sariling-random-value-sa-actual-env
   ```

   Ang `SESSION_SECRET` sa example ay placeholder lamang. Huwag palitan ang existing secret para lang sundan ang guide.

6. Pinatakbo ang:

   ```powershell
   npm.cmd run db:setup
   ```

   Binasa nito ang `.env`, gumawa ng `cybernyte` database, at nag-import ng `sql/schema.sql` at `sql/seed.sql`.

7. Gumawa ang schema ng 11 tables:

   ```text
   users
   customers
   stations
   gaming_sessions
   reservations
   payments
   categories
   food_items
   food_orders
   food_order_items
   cafe_settings
   ```

8. Nag-import ng tig-tatlong starter records sa bawat business table. Isang record lang ang `cafe_settings` dahil iisang cafe configuration ang ginagamit.
9. Kinonekta ang Express sa MySQL gamit ang `mysql2/promise` sa `server/db.js`.
10. Kinonekta ang existing frontend forms sa Express REST endpoints gamit ang Fetch API at `async/await`.

May combined file na **`sql/cybernyte.sql`** kung mano-manong import sa bagong MySQL database ang gusto mo. Kasama rito ang database creation, table definitions, at seed inserts. Huwag itong i-import ulit sa current populated database. Refuses to overwrite existing tables ang `db:setup` script.

## Paano makita sa MySQL Workbench

Kung mayroon kang MySQL Workbench:

1. Patakbuhin muna ang local startup script sa itaas para siguradong running ang MySQL.
2. Buksan ang MySQL Workbench.
3. Gumawa ng bagong connection gamit ang mga settings:

   ```text
   Connection Name: CyberNyte Local
   Connection Method: Standard TCP/IP
   Hostname: 127.0.0.1
   Port: 3318
   Username: root
   Password: leave blank
   ```

4. Test Connection, pagkatapos buksan ang connection.
5. Sa SQL editor, execute:

   ```sql
   SELECT VERSION();
   USE cybernyte;
   SHOW TABLES;

   SELECT id, full_name, username, role, active FROM users;
   SELECT * FROM stations;
   SELECT * FROM customers;
   SELECT * FROM categories;
   SELECT * FROM food_items;
   ```

6. Makikita mo rin ang `cybernyte` sa Schemas panel. I-refresh ang panel kung hindi agad lumitaw.

MySQL Workbench ay viewer/editor lamang. Ang MySQL server ang kailangang running para gumana ang database at system.

## Kung walang Workbench

May MySQL command-line client na kasama sa portable runtime. Sa terminal na nasa `CyberNyte` folder, run:

```powershell
& './tmp/mysql-runtime/mysql-8.4.4-winx64/bin/mysql.exe' -h 127.0.0.1 -P 3318 -u root cybernyte
```

Pag nasa `mysql>` prompt na:

```sql
SHOW TABLES;
SELECT * FROM stations;
```

Para lumabas:

```sql
exit;
```

## Paano patunayan na connected ang frontend at MySQL

1. Buksan ang http://localhost:3015/api/health. Dapat may `success: true` at `database: connected`.
2. Sa http://localhost:3015, mag-login bilang admin.
3. Pumunta sa Computer Stations at mag-add ng bagong station na may unique name, halimbawa `PC-TEST`.
4. Sa Workbench o MySQL client, execute:

   ```sql
   USE cybernyte;
   SELECT * FROM stations WHERE name = 'PC-TEST';
   ```

5. Dapat lumabas ang bagong row.
6. I-edit ang station sa website. Execute ulit ang SELECT para makita ang updated values.
7. I-refresh ang website. Dapat nandiyan pa rin ang saved station.
8. I-deactivate ang station. Sa SQL row, magiging `active = 0`; retained ang history.

Ito ang actual request flow:

```text
Add Station form
  → Fetch POST /api/stations
  → Express validates the input
  → mysql2 executes a parameterized INSERT
  → MySQL saves the row
  → Express returns HTTP 201 and JSON
  → frontend reloads saved records and updates the UI
```

## Kung ililipat sa ibang computer

1. Install at start MySQL 8, at install Node.js 20+.
2. Sa project folder, run `npm.cmd ci`.
3. Copy `.env.example` to `.env` at ilagay ang host, port, username at password ng sarili mong MySQL installation. Karaniwang port ay 3306; hindi kailangang 3318 kung wala namang conflict sa bagong computer.
4. Run `npm.cmd run db:setup` para sa bagong empty database, o import ang combined SQL file. Isang import method lang ang gamitin.
5. Run `npm.cmd start`, pagkatapos buksan ang website sa configured `PORT`.

Ang source ZIP ay may SQL at setup scripts, pero walang bundled MySQL runtime/data directory o `.env`. Gamitin ang sariling MySQL installation sa bagong computer. Ang pag-import ng seed SQL ay magbibigay ng starter records; hindi nito inililipat ang latest records na ginawa mo sa current database. Kailangan ng database backup/export para roon.

## Common problems

| Problem | Dapat i-check |
|---|---|
| Cannot connect to MySQL | Running ba ang server at tama ba ang `DB_PORT`? Sa prepared setup, 3318 |
| Website cannot be reached | Running ba ang Express? Website URL ay localhost:3015 |
| Access denied for root | Baka ibang MySQL instance/port ang ginagamit o mali ang password |
| Database/table already exists | Naka-import na; huwag ulitin ang schema import |
| Unknown database/table | Na-import ba ang schema sa parehong server at DB_NAME na nasa `.env`? |
| Hindi nakikita ang records sa Workbench | Same host, port at schema ba ang binubuksan? |
| May image path pero walang photo | Dapat kasama ang actual file sa assets/uploads folder; path lang ang nasa MySQL |

## Verification na ginawa

Na-test sa actual MySQL 8.4.4 ang 18 API/database scenarios at 11 browser workflow groups. Nasa `docs/TESTING.md` ang test details at evidence.

Local classroom demo ang setup. Blank database root password at plain-text application passwords ang current local configuration; hindi ito production security setup.
