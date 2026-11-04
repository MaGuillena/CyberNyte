function fail(status, message, errors = {}) {
  const error = new Error(message);
  error.status = status;
  error.errors = errors;
  throw error;
}

function text(value, field, max, required = true) {
  if (value != null && typeof value !== 'string') fail(400, 'Invalid input.', { [field]: 'Enter text.' });
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) {
    fail(400, 'Please check your input.', { [field]: `Enter ${required ? '1' : '0'}-${max} characters.` });
  }
  return result;
}

function id(value, field = 'id') {
  if (!/^\d+$/.test(String(value)) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) {
    fail(400, 'Invalid record ID.', { [field]: 'Choose a valid record.' });
  }
  return Number(value);
}

function money(value, field, max = 9999999999.99) {
  const number = Number(value);
  if (value === '' || value == null || typeof value === 'boolean' || !Number.isFinite(number) || number <= 0 || number > max) {
    fail(400, 'Invalid amount.', { [field]: `Enter an amount greater than zero, up to ${max}.` });
  }
  const rounded = Math.round((number + Number.EPSILON) * 100) / 100;
  if (rounded <= 0) fail(400, 'Amount is too small.', { [field]: 'Minimum amount is 0.01.' });
  return rounded;
}

function choice(value, field, choices) {
  if (!choices.includes(value)) fail(400, 'Invalid option.', { [field]: 'Choose a valid option.' });
  return value;
}

function bool(value, field) {
  if (![true, false, 1, 0, 'true', 'false', '1', '0'].includes(value)) fail(400, 'Invalid option.', { [field]: 'Choose yes or no.' });
  return [true, 1, 'true', '1'].includes(value);
}

const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const nowSql = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
const iso = value => value == null ? null : new Date(String(value).replace(' ', 'T') + '+08:00').toISOString();

function mapRow(row) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const field = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === 'password') continue;
    if (key === 'id' || key.endsWith('_id') || ['started_by', 'created_by', 'recorded_by'].includes(key)) {
      result[field] = value == null ? null : String(value);
    } else if (['active', 'available', 'featured', 'compact_tables', 'reduce_motion'].includes(key)) {
      result[field] = Boolean(value);
    } else if (['created_at', 'registered_at', 'paid_at'].includes(key) ||
        (['start_time', 'end_time'].includes(key) && String(value).includes('-'))) {
      result[field] = iso(value);
    } else { result[field] = value; }
  }
  if ('reservationDate' in result) {
    result.date = result.reservationDate;
    result.startTime = result.startTime.slice(0, 5);
    result.endTime = result.endTime.slice(0, 5);
    delete result.reservationDate;
  }
  if ('paidAt' in result) { result.date = result.paidAt; delete result.paidAt; }
  if ('imagePath' in result) result.image = result.imagePath || '';
  if ('categoryId' in result) result.category = result.categoryId;
  if ('itemName' in result) result.name = result.itemName;
  if ('foodItemId' in result) result.foodId = result.foodItemId;
  return result;
}

async function record(db, table, value, lock = false) {
  // table names below come from source code, never from user input.
  const [rows] = await db.execute(`SELECT * FROM ${table} WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id(value)]);
  if (!rows.length) fail(404, 'Record not found.');
  return rows[0];
}

function contact(value) {
  const result = text(value, 'contactNumber', 20, false);
  if (result && (!/^[0-9+\-\s()]+$/.test(result) || !/^\d{7,15}$/.test(result.replace(/\D/g, '')))) {
    fail(400, 'Invalid contact number.', { contactNumber: 'Enter 7-15 digits, or leave blank.' });
  }
  return result || null;
}

module.exports = { fail, text, id, money, choice, bool, round, nowSql, iso, mapRow, record, contact };
