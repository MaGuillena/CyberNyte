const { mapRow, fail } = require('./helpers');

async function getState(db, user) {
  const tables = {
    customers: 'customers', stations: 'stations', sessions: 'gaming_sessions',
    reservations: 'reservations', categories: 'categories', foodItems: 'food_items',
    foodOrders: 'food_orders'
  };
  const data = {};
  for (const [key, table] of Object.entries(tables)) {
    const [rows] = await db.execute(`SELECT * FROM ${table} ORDER BY id`);
    data[key] = rows.map(mapRow);
  }
  const [users] = await db.execute(user.role === 'admin'
    ? 'SELECT id, full_name, username, role, active FROM users ORDER BY id'
    : 'SELECT id, full_name FROM users ORDER BY id');
  data.users = users.map(mapRow);
  const [payments] = await db.execute(
    'SELECT p.*, s.customer_id FROM payments p JOIN gaming_sessions s ON s.id = p.session_id ORDER BY p.id');
  data.payments = payments.map(mapRow);
  const [lines] = await db.execute('SELECT * FROM food_order_items ORDER BY id');
  for (const order of data.foodOrders) order.items = lines.filter(line => String(line.order_id) === order.id).map(mapRow);
  const [settings] = await db.execute('SELECT * FROM cafe_settings WHERE id = 1');
  if (!settings.length) fail(503, 'Cafe settings are missing. Import sql/seed.sql into a fresh database.');
  data.settings = mapRow(settings[0]);
  data.settings.prefs = { compactTables: data.settings.compactTables, reduceMotion: data.settings.reduceMotion };
  return data;
}

function summary(data) {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return {
    totalStations: data.stations.filter(s => s.active).length,
    activeSessions: data.sessions.filter(s => s.status === 'active').length,
    customers: data.customers.length,
    todayRevenue: data.payments.filter(p => p.date && new Date(new Date(p.date).getTime() + 8 * 3600000)
      .toISOString().slice(0, 10) === today).reduce((total, p) => total + p.amount, 0)
  };
}

module.exports = { getState, summary };
