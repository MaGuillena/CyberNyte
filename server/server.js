require('dotenv').config({ quiet: true });
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, transaction } = require('./db');
const { fail, text, id, money, choice, bool, round, nowSql, iso, mapRow, record, contact } = require('./helpers');
const { getState, summary } = require('./state');

const app = express();
const root = path.join(__dirname, '..');
const uploadDir = path.join(root, 'uploads/food');
const ok = (res, data = null, message = 'OK', status = 200) => res.status(status).json({ success: true, data, message });

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 3600000 }
}));

// Same-origin frontend and API; no cross-origin credential sharing.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get('host')}`) return next(Object.assign(new Error('Cross-origin request rejected.'), { status: 403 }));
  next();
});

app.get('/api/health', async (req, res) => {
  await pool.execute('SELECT 1');
  ok(res, { database: 'connected' });
});

app.post('/api/auth/login', async (req, res) => {
  const username = text(req.body.username, 'username', 20);
  const password = text(req.body.password, 'password', 255);
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length || rows[0].password !== password) fail(401, 'Incorrect username or password.');
  if (!rows[0].active) fail(403, 'This account is deactivated.');
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.userId = rows[0].id;
  ok(res, mapRow(rows[0]), 'Signed in.');
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    ok(res, null, 'Signed out.');
  });
});

app.use('/api', async (req, res, next) => {
  if (!req.session.userId) fail(401, 'Please sign in.');
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND active = TRUE', [req.session.userId]);
  if (!rows.length) fail(401, 'Your account is no longer active.');
  req.user = rows[0];
  next();
});
const admin = (req, res, next) => {
  if (req.user.role !== 'admin') fail(403, 'Only administrators can access this feature.');
  next();
};

app.get('/api/auth/me', (req, res) => ok(res, mapRow(req.user)));
app.get('/api/state', async (req, res) => ok(res, await getState(pool, req.user)));
app.get('/api/dashboard', async (req, res) => ok(res, summary(await getState(pool, req.user))));
app.get('/api/reports', admin, async (req, res) => {
  const from = req.query.from || '2000-01-01';
  const to = req.query.to || nowSql().slice(0, 10);
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(from) || !validDate(to) || from > to) fail(400, 'Invalid report date range.');
  const [payments] = await pool.execute(
    'SELECT p.*, s.customer_id FROM payments p JOIN gaming_sessions s ON s.id = p.session_id WHERE p.paid_at >= ? AND p.paid_at < DATE_ADD(?, INTERVAL 1 DAY)', [from, to]);
  ok(res, { from, to, revenue: round(payments.reduce((sum, p) => sum + p.amount, 0)), payments: payments.map(mapRow) });
});

// Read endpoints use the same mapped database data as the existing UI.
const collections = { stations: 'stations', customers: 'customers', sessions: 'sessions',
  reservations: 'reservations', payments: 'payments', categories: 'categories',
  'food-items': 'foodItems', 'food-orders': 'foodOrders', users: 'users' };
for (const [route, key] of Object.entries(collections)) {
  const guards = route === 'users' ? [admin] : [];
  app.get(`/api/${route}`, ...guards, async (req, res) => {
    let rows = (await getState(pool, req.user))[key];
    const query = String(req.query.q || '').trim().toLowerCase();
    if (query) rows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query));
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    if (req.query.category) rows = rows.filter(row => row.categoryId === req.query.category);
    if (req.query.date) rows = rows.filter(row => row.date === req.query.date);
    ok(res, rows);
  });
  app.get(`/api/${route}/:id`, ...guards, async (req, res) => {
    const value = String(id(req.params.id));
    const row = (await getState(pool, req.user))[key].find(item => item.id === value);
    if (!row) fail(404, 'Record not found.');
    ok(res, row);
  });
}

// Station locking is shared by session, reservation, and maintenance writes.
async function stationLock(db, value) { return record(db, 'stations', value, true); }
async function stationIdle(db, stationId, includeBookings = false) {
  const [sessions] = await db.execute("SELECT id FROM gaming_sessions WHERE station_id = ? AND status = 'active' FOR UPDATE", [stationId]);
  if (sessions.length) fail(409, 'End the active session first.');
  if (includeBookings) {
    const [bookings] = await db.execute("SELECT id FROM reservations WHERE station_id = ? AND status = 'confirmed' AND TIMESTAMP(reservation_date, end_time) > ? FOR UPDATE", [stationId, nowSql()]);
    if (bookings.length) fail(409, 'Cancel or reassign upcoming reservations first.');
  }
}

async function saveStation(req, res) {
  const b = req.body;
  const result = await transaction(async db => {
    const old = req.params.id ? await stationLock(db, req.params.id) : null;
    if (Object.hasOwn(b, 'active') && Object.keys(b).length === 1 && old) {
      const active = bool(b.active, 'active');
      if (!active) await stationIdle(db, old.id, true);
      await db.execute('UPDATE stations SET active = ? WHERE id = ?', [active, old.id]);
      return old.id;
    }
    const name = text(b.name, 'name', 20);
    const specs = text(b.specs, 'specs', 120);
    const rate = money(b.hourlyRate, 'hourlyRate', 1000);
    const status = choice(b.status || 'available', 'status', ['available', 'maintenance']);
    if (old && status === 'maintenance') await stationIdle(db, old.id, true);
    if (old) {
      await db.execute('UPDATE stations SET name=?, specs=?, hourly_rate=?, status=? WHERE id=?', [name, specs, rate, status, old.id]);
      return old.id;
    }
    const [insert] = await db.execute('INSERT INTO stations (name,specs,hourly_rate,status) VALUES (?,?,?,?)', [name, specs, rate, status]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Station saved.', req.params.id ? 200 : 201);
}
app.post('/api/stations', saveStation);
app.patch('/api/stations/:id', saveStation);

async function saveCustomer(req, res) {
  const fullName = text(req.body.fullName, 'fullName', 60);
  if (fullName.length < 2) fail(400, 'Name needs at least two characters.', { fullName: 'Enter a full name.' });
  const number = contact(req.body.contactNumber);
  if (req.params.id) {
    await record(pool, 'customers', req.params.id);
    await pool.execute('UPDATE customers SET full_name=?, contact_number=? WHERE id=?', [fullName, number, id(req.params.id)]);
    return ok(res, null, 'Customer updated.');
  }
  const [insert] = await pool.execute('INSERT INTO customers (full_name,contact_number) VALUES (?,?)', [fullName, number]);
  ok(res, { id: String(insert.insertId) }, 'Customer added.', 201);
}
app.post('/api/customers', saveCustomer);
app.patch('/api/customers/:id', saveCustomer);
app.delete('/api/customers/:id', async (req, res) => {
  await record(pool, 'customers', req.params.id);
  await pool.execute('DELETE FROM customers WHERE id=?', [id(req.params.id)]);
  ok(res, null, 'Customer deleted.');
});

app.post('/api/sessions', async (req, res) => {
  const inserted = await transaction(async db => {
    const customer = await record(db, 'customers', req.body.customerId);
    const station = await stationLock(db, req.body.stationId);
    if (!station.active || station.status === 'maintenance') fail(409, 'Station is unavailable.');
    await stationIdle(db, station.id);
    const now = nowSql();
    const [bookings] = await db.execute("SELECT id FROM reservations WHERE station_id=? AND status='confirmed' AND TIMESTAMP(reservation_date,start_time)<=? AND TIMESTAMP(reservation_date,end_time)>? FOR UPDATE", [station.id, now, now]);
    if (bookings.length) fail(409, 'Station is reserved for the current time.');
    const [insert] = await db.execute('INSERT INTO gaming_sessions (customer_id,station_id,started_by,start_time,hourly_rate) VALUES (?,?,?,?,?)', [customer.id, station.id, req.user.id, now, station.hourly_rate]);
    return insert.insertId;
  });
  ok(res, { id: String(inserted) }, 'Session started.', 201);
});
app.patch('/api/sessions/:id/end', async (req, res) => {
  const result = await transaction(async db => {
    const current = await record(db, 'gaming_sessions', req.params.id);
    await stationLock(db, current.station_id);
    const live = await record(db, 'gaming_sessions', req.params.id, true);
    if (live.status !== 'active') fail(409, 'Session was already ended.');
    const end = nowSql();
    const minutes = Math.max(0, (new Date(iso(end)) - new Date(iso(live.start_time))) / 60000);
    const charge = round(live.hourly_rate * minutes / 60);
    await db.execute("UPDATE gaming_sessions SET end_time=?,charge=?,status='completed' WHERE id=?", [end, charge, live.id]);
    return { id: String(live.id), charge };
  });
  ok(res, result, 'Session ended.');
});

async function saveReservation(req, res) {
  const b = req.body;
  const result = await transaction(async db => {
    // Serialize booking writes, including reassignments, in one consistent lock order.
    await db.execute('SELECT id FROM stations ORDER BY id FOR UPDATE');
    const old = req.params.id ? await record(db, 'reservations', req.params.id, true) : null;
    if (old && b.status === 'cancelled' && Object.keys(b).length === 1) {
      if (old.status === 'cancelled' || `${old.reservation_date} ${old.end_time}` <= nowSql()) fail(409, 'Reservation can no longer be cancelled.');
      await db.execute("UPDATE reservations SET status='cancelled' WHERE id=?", [old.id]);
      return old.id;
    }
    if (old && (old.status === 'cancelled' || `${old.reservation_date} ${old.start_time}` <= nowSql())) fail(409, 'Only upcoming reservations can be edited.');
    const date = text(b.date, 'date', 10);
    const start = text(b.startTime, 'startTime', 5);
    const end = text(b.endTime, 'endTime', 5);
    const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || !validTime(start) || !validTime(end) || end <= start) fail(400, 'Choose a valid date and a later end time.');
    if (`${date} ${start}:00` <= nowSql()) fail(400, 'Choose a future booking time.', { startTime: 'Booking must start in the future.' });
    await record(db, 'customers', b.customerId);
    const stationId = b.stationId ? id(b.stationId, 'stationId') : null;
    if (stationId) {
      const station = await stationLock(db, stationId);
      if (!station.active || station.status === 'maintenance') fail(409, 'Station is unavailable.');
      const [clashes] = await db.execute("SELECT id FROM reservations WHERE station_id=? AND reservation_date=? AND status='confirmed' AND id<>? AND start_time<? AND end_time>?", [stationId, date, old ? old.id : 0, end, start]);
      if (clashes.length) fail(409, 'Station already has an overlapping reservation.', { stationId: 'Choose another station or time.' });
      const [running] = await db.execute("SELECT id FROM gaming_sessions WHERE station_id=? AND status='active'", [stationId]);
      if (running.length && new Date(`${date}T${start}:00+08:00`) - new Date() < 30 * 60000) fail(409, 'A running session requires a 30-minute booking buffer.');
    }
    if (old) {
      await db.execute('UPDATE reservations SET customer_id=?,station_id=?,reservation_date=?,start_time=?,end_time=? WHERE id=?', [id(b.customerId), stationId, date, start, end, old.id]);
      return old.id;
    }
    const [insert] = await db.execute('INSERT INTO reservations (customer_id,station_id,reservation_date,start_time,end_time,created_by) VALUES (?,?,?,?,?,?)', [id(b.customerId), stationId, date, start, end, req.user.id]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Reservation saved.', req.params.id ? 200 : 201);
}
app.post('/api/reservations', saveReservation);
app.patch('/api/reservations/:id', saveReservation);

app.post('/api/payments', async (req, res) => {
  const amount = money(req.body.amount, 'amount');
  const method = choice(req.body.method, 'method', ['Cash', 'GCash', 'Maya', 'Other']);
  const result = await transaction(async db => {
    const current = await record(db, 'gaming_sessions', req.body.sessionId, true);
    if (current.status !== 'completed') fail(409, 'End the session before recording a payment.');
    const [rows] = await db.execute('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE session_id=?', [current.id]);
    const balance = round(current.charge - Number(rows[0].paid));
    if (amount > balance) fail(409, 'Payment exceeds the remaining balance.', { amount: `Maximum payment is ${balance.toFixed(2)}.` });
    const [insert] = await db.execute('INSERT INTO payments (session_id,amount,method,paid_at,recorded_by) VALUES (?,?,?,?,?)', [current.id, amount, method, nowSql(), req.user.id]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Payment recorded.', 201);
});

async function saveCategory(req, res) {
  const result = await transaction(async db => {
    const old = req.params.id ? await record(db, 'categories', req.params.id, true) : null;
    const name = Object.hasOwn(req.body, 'name') ? text(req.body.name, 'name', 100) : old && old.name;
    if (!name) fail(400, 'Category name is required.');
    const active = Object.hasOwn(req.body, 'active') ? bool(req.body.active, 'active') : old ? Boolean(old.active) : true;
    if (old) {
      await db.execute('UPDATE categories SET name=?,active=? WHERE id=?', [name, active, old.id]);
      return old.id;
    }
    const [insert] = await db.execute('INSERT INTO categories (name,active) VALUES (?,?)', [name, active]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Category saved.', req.params.id ? 200 : 201);
}
app.post('/api/categories', saveCategory);
app.patch('/api/categories/:id', saveCategory);
app.delete('/api/categories/:id', async (req, res) => {
  await transaction(async db => {
    await record(db, 'categories', req.params.id, true);
    const [items] = await db.execute('SELECT id FROM food_items WHERE category_id=?', [id(req.params.id)]);
    if (items.length) fail(409, 'Category contains food items. Deactivate it instead.');
    await db.execute('DELETE FROM categories WHERE id=?', [id(req.params.id)]);
  });
  ok(res, null, 'Category deleted.');
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 12 } });
function imageExtension(file) {
  const b = file.buffer;
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return '.jpg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  fail(400, 'Upload a JPG, PNG, or WebP image.');
}
async function removeUpload(value) {
  if (typeof value === 'string' && /^\/uploads\/food\/[a-f0-9-]+\.(jpg|png|webp)$/.test(value)) {
    await fs.unlink(path.join(uploadDir, path.basename(value))).catch(error => {
      if (error.code !== 'ENOENT') console.error('Image cleanup failed:', error.message);
    });
  }
}
async function saveFood(req, res) {
  let newPath;
  let oldPath;
  try {
    if (req.file) {
      const extension = imageExtension(req.file);
      await fs.mkdir(uploadDir, { recursive: true });
      newPath = `/uploads/food/${crypto.randomUUID()}${extension}`;
      await fs.writeFile(path.join(uploadDir, path.basename(newPath)), req.file.buffer);
    }
    const result = await transaction(async db => {
      const old = req.params.id ? await record(db, 'food_items', req.params.id, true) : null;
      oldPath = old && old.image_path;
      const b = req.body;
      if (old && Object.keys(b).length === 1 && Object.hasOwn(b, 'available') && !req.file) {
        await db.execute('UPDATE food_items SET available=? WHERE id=?', [bool(b.available, 'available'), old.id]);
        return old.id;
      }
      const name = text(b.name, 'name', 100);
      const description = text(b.description, 'description', 500, false);
      const price = money(b.price, 'price', 99999999.99);
      const category = await record(db, 'categories', b.categoryId, true);
      if (!category.active && (!old || old.category_id !== category.id)) fail(409, 'Choose an active category.');
      const featured = bool(b.featured ?? false, 'featured');
      const available = bool(b.available ?? true, 'available');
      const image = newPath || (b.removeImage === 'true' || b.removeImage === true ? null : oldPath) || null;
      if (old) {
        await db.execute('UPDATE food_items SET category_id=?,name=?,description=?,price=?,image_path=?,featured=?,available=? WHERE id=?', [category.id,name,description,price,image,featured,available,old.id]);
        return old.id;
      }
      const [insert] = await db.execute('INSERT INTO food_items (category_id,name,description,price,image_path,featured,available) VALUES (?,?,?,?,?,?,?)', [category.id,name,description,price,image,featured,available]);
      return insert.insertId;
    });
    if (oldPath && (newPath || req.body.removeImage === 'true' || req.body.removeImage === true)) await removeUpload(oldPath);
    ok(res, { id: String(result) }, 'Food item saved.', req.params.id ? 200 : 201);
  } catch (error) { if (newPath) await removeUpload(newPath); throw error; }
}
app.post('/api/food-items', upload.single('image'), saveFood);
app.patch('/api/food-items/:id', upload.single('image'), saveFood);
app.delete('/api/food-items/:id/image', async (req, res) => {
  const oldPath = await transaction(async db => {
    const old = await record(db, 'food_items', req.params.id, true);
    await db.execute('UPDATE food_items SET image_path=NULL WHERE id=?', [old.id]);
    return old.image_path;
  });
  await removeUpload(oldPath);
  ok(res, null, 'Image removed.');
});
app.delete('/api/food-items/:id', async (req, res) => {
  const oldPath = await transaction(async db => {
    const old = await record(db, 'food_items', req.params.id, true);
    const [lines] = await db.execute('SELECT id FROM food_order_items WHERE food_item_id=?', [old.id]);
    if (lines.length) fail(409, 'Item has order history. Mark it out of stock instead.');
    await db.execute('DELETE FROM food_items WHERE id=?', [old.id]);
    return old.image_path;
  });
  await removeUpload(oldPath);
  ok(res, null, 'Food item deleted.');
});

app.post('/api/food-orders', async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) fail(400, 'Add 1-100 distinct items.');
  const ids = items.map(item => id(item.foodId, 'foodId'));
  if (new Set(ids).size !== ids.length) fail(400, 'Duplicate cart item.');
  const result = await transaction(async db => {
    const lines = [];
    // Lock menu records in a consistent order.
    const sorted = [...items].sort((a, b) => Number(a.foodId) - Number(b.foodId));
    for (const item of sorted) {
      const food = await record(db, 'food_items', item.foodId, true);
      const category = await record(db, 'categories', food.category_id, true);
      if (!food.available || !category.active) fail(409, `${food.name} is unavailable.`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) fail(400, 'Quantity must be a whole number from 1 to 20.');
      lines.push({ food, quantity: item.quantity, total: round(food.price * item.quantity) });
    }
    const subtotal = round(lines.reduce((sum, line) => sum + line.total, 0));
    const [insert] = await db.execute('INSERT INTO food_orders (created_by,subtotal,total) VALUES (?,?,?)', [req.user.id,subtotal,subtotal]);
    for (const line of lines) await db.execute('INSERT INTO food_order_items (order_id,food_item_id,item_name,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?)', [insert.insertId,line.food.id,line.food.name,line.food.price,line.quantity,line.total]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Food order placed. No payment processed.', 201);
});
app.patch('/api/food-orders/:id/status', async (req, res) => {
  await transaction(async db => {
    const order = await record(db, 'food_orders', req.params.id, true);
    const next = { pending: ['preparing','cancelled'], preparing: ['completed','cancelled'], completed: [], cancelled: [] };
    if (!next[order.status].includes(req.body.status)) fail(409, 'Invalid order status transition.');
    await db.execute('UPDATE food_orders SET status=? WHERE id=?', [req.body.status,order.id]);
  });
  ok(res, null, 'Order status updated.');
});

async function saveUser(req, res) {
  const result = await transaction(async db => {
    const [all] = await db.execute('SELECT id, role, active FROM users ORDER BY id FOR UPDATE');
    const old = req.params.id ? await record(db, 'users', req.params.id) : null;
    const b = req.body;
    const active = Object.hasOwn(b, 'active') ? bool(b.active, 'active') : old ? Boolean(old.active) : true;
    const role = choice(b.role || (old && old.role) || 'staff', 'role', ['admin','staff']);
    if (old && !active && old.id === req.user.id) fail(409, 'You cannot deactivate your own account.');
    if (old && old.active && old.role === 'admin' && (!active || role !== 'admin') && all.filter(u => u.active && u.role === 'admin').length <= 1) fail(409, 'At least one active administrator must remain.');
    if (old && Object.keys(b).length === 1 && Object.hasOwn(b, 'active')) {
      await db.execute('UPDATE users SET active=? WHERE id=?', [active,old.id]);
      return old.id;
    }
    const fullName = text(b.fullName, 'fullName', 60);
    if (fullName.length < 2) fail(400, 'Enter a full name.');
    const username = text(b.username, 'username', 20);
    if (!/^[A-Za-z0-9._-]{3,20}$/.test(username)) fail(400, 'Invalid username.', { username: 'Use 3-20 letters, numbers, dots, dashes or underscores.' });
    const password = old && !b.password ? old.password : text(b.password, 'password', 255);
    if (password.length < 6) fail(400, 'Password needs at least 6 characters.', { password: 'Enter at least 6 characters.' });
    if (old) {
      await db.execute('UPDATE users SET full_name=?,username=?,password=?,role=?,active=? WHERE id=?', [fullName,username,password,role,active,old.id]);
      return old.id;
    }
    const [insert] = await db.execute('INSERT INTO users (full_name,username,password,role,active) VALUES (?,?,?,?,?)', [fullName,username,password,role,active]);
    return insert.insertId;
  });
  ok(res, { id: String(result) }, 'Account saved.', req.params.id ? 200 : 201);
}
app.post('/api/users', admin, saveUser);
app.patch('/api/users/:id', admin, saveUser);

app.get('/api/settings', async (req, res) => ok(res, (await getState(pool, req.user)).settings));
app.patch('/api/settings', admin, async (req, res) => {
  const b = req.body;
  const name = text(b.cafeName, 'cafeName', 60);
  await pool.execute('UPDATE cafe_settings SET cafe_name=?,address=?,contact_number=?,opening_hours=? WHERE id=1', [name,text(b.address,'address',120,false),contact(b.contactNumber),text(b.openingHours,'openingHours',60,false)]);
  ok(res, null, 'Cafe information saved.');
});
app.patch('/api/settings/preferences', async (req, res) => {
  // Preferences are shared shop settings, matching the original frontend.
  const compact = bool(req.body.compactTables, 'compactTables');
  const motion = bool(req.body.reduceMotion, 'reduceMotion');
  await pool.execute('UPDATE cafe_settings SET compact_tables=?,reduce_motion=? WHERE id=1', [compact,motion]);
  ok(res, null, 'Preferences saved.');
});

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found.', errors: {} }));
app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(root, 'index.html')));
for (const folder of ['css','js','assets','uploads']) app.use(`/${folder}`, express.static(path.join(root, folder), { dotfiles: 'deny', index: false }));
app.use((req, res) => res.status(404).send('Not found.'));
app.use((error, req, res, next) => {
  let status = error.status || 500;
  let message = error.message;
  if (error.code === 'ER_DUP_ENTRY') { status = 409; message = 'That name or username already exists.'; }
  if (['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(error.code)) { status = 409; message = 'Record is linked to other records. Keep its history or choose a valid related record.'; }
  if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) { status = 409; message = 'Another operation is using this record. Please retry.'; }
  if (error instanceof multer.MulterError) { status = 400; message = 'Upload one image, maximum 3 MB.'; }
  if (status >= 500) { console.error(error); message = 'Database or server unavailable. Check MySQL and the server terminal.'; }
  res.status(status).json({ success: false, message, errors: error.errors || {} });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '127.0.0.1', error => {
    if (error) { console.error(`Cannot start on port ${port}: ${error.message}`); process.exitCode = 1; return; }
    console.log(`CyberNyte: http://localhost:${port}`);
  });
}
module.exports = app;
