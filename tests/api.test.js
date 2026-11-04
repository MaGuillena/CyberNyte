// Integration tests create their own database, never reset the application's DB.
require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');

test('CyberNyte database and REST workflows', async t => {
  const database = `cybernyte_test_${Date.now()}`;
  const connection = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', multipleStatements: true, decimalNumbers: true });
  let created = false, server, pool;
  try {
    assert.match(database, /^cybernyte_test_\d+$/);
    await connection.query(`CREATE DATABASE \`${database}\``);
    created = true;
    await connection.changeUser({ database });
    await connection.query("SET time_zone='+08:00'");
    for (const file of ['schema.sql','seed.sql']) await connection.query(await fs.readFile(path.join(__dirname,'../sql',file),'utf8'));
    process.env.DB_NAME = database;
    const app = require('../server/server');
    pool = require('../server/db').pool;
    server = await new Promise(resolve => { const instance = app.listen(0,'127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const admin = { cookie: '' }, staff = { cookie: '' };
    async function request(url, method = 'GET', body, actor = admin) {
      const headers = {};
      if (actor.cookie) headers.Cookie = actor.cookie;
      const options = { method, headers };
      if (body instanceof FormData) options.body = body;
      else if (body !== undefined) { headers['Content-Type']='application/json'; options.body=JSON.stringify(body); }
      const response = await fetch(base + url,options);
      if (response.headers.get('set-cookie')) actor.cookie=response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, ...(await response.json()) };
    }
    const tomorrow = new Date(Date.now()+8*3600000+86400000).toISOString().slice(0,10);
    let station, customer, category, food, sessionId;

    await t.test('anonymous requests and SQL injection login are rejected', async () => {
      assert.equal((await request('/state')).status,401);
      assert.equal((await request('/auth/login','POST',{username:"' OR 1=1 --",password:'wrong'})).status,401);
      assert.equal((await request('/auth/login','POST',{username:'admin',password:'wrong'})).status,401);
    });
    await t.test('login, session cookie, and seed records from real SQL', async () => {
      const login=await request('/auth/login','POST',{username:'admin',password:'admin123'});
      assert.equal(login.status,200); assert.equal(login.data.role,'admin'); assert.equal(login.data.password,undefined);
      const state=await request('/state');
      for (const key of ['users','customers','stations','sessions','reservations','payments','categories','foodItems','foodOrders']) assert.equal(state.data[key].length,3,key);
      assert.equal(state.data.foodOrders[0].items.length,1);
      assert.equal(state.data.foodItems[0].image,'/assets/images/food/french-fries.jpg');
      assert.equal((await request('/dashboard')).data.totalStations,3);
    });
    await t.test('staff cannot access user management or reports, including direct API calls', async () => {
      assert.equal((await request('/auth/login','POST',{username:'staff',password:'staff123'},staff)).status,200);
      for (const url of ['/users','/users/1','/reports']) assert.equal((await request(url,'GET',undefined,staff)).status,403,url);
      assert.equal((await request('/users','POST',{},staff)).status,403);
      assert.equal((await request('/users/1','PATCH',{role:'staff'},staff)).status,403);
      assert.equal((await request('/settings','PATCH',{},staff)).status,403);
      const state=await request('/state','GET',undefined,staff);
      assert.equal(state.status,200); assert.equal(state.data.users[0].username,undefined);
      assert.equal((await request('/payments','GET',undefined,staff)).status,200);
    });
    await t.test('station create, read/details, search, update, deactivate, reactivate', async () => {
      let result=await request('/stations','POST',{name:'TEST-PC',specs:'16GB RAM',hourlyRate:40,status:'available'});
      assert.equal(result.status,201); station=result.data.id;
      assert.equal((await request('/stations/'+station)).data.name,'TEST-PC');
      assert.equal((await request('/stations?q=TEST-PC')).data.length,1);
      assert.equal((await request('/stations/'+station,'PATCH',{name:'TEST-PC-EDIT',specs:'32GB RAM',hourlyRate:40,status:'available'})).status,200);
      assert.equal((await request('/stations/'+station,'PATCH',{active:false})).status,200);
      assert.equal((await request('/stations/'+station)).data.active,false);
      assert.equal((await request('/stations/'+station,'PATCH',{active:true})).status,200);
      assert.equal((await request('/stations','POST',{name:'TEST-PC-EDIT',specs:'RAM',hourlyRate:40})).status,409);
    });
    await t.test('invalid values, nonexistent records, and FK deletion produce meaningful errors', async () => {
      assert.equal((await request('/stations','POST',{name:'Bad',specs:'RAM',hourlyRate:-1})).status,400);
      assert.equal((await request('/stations/999999')).status,404);
      assert.equal((await request('/stations/nope')).status,400);
      assert.equal((await request('/customers/1','DELETE')).status,409);
      const result=await request('/customers','POST',{fullName:'Test Customer',contactNumber:'bad'});
      assert.equal(result.status,400); assert.ok(result.errors.contactNumber);
    });
    await t.test('customer create/update/details and parameterized literal input', async () => {
      const result=await request('/customers','POST',{fullName:"Robert'); DROP TABLE users;--",contactNumber:''});
      assert.equal(result.status,201); customer=result.data.id;
      assert.equal((await request('/users')).data.length,3);
      assert.equal((await request('/customers/'+customer,'PATCH',{fullName:'Test Customer',contactNumber:'09175550111'})).status,200);
      assert.equal((await request('/customers/'+customer)).data.fullName,'Test Customer');
      const spare=await request('/customers','POST',{fullName:'Delete Me'});
      assert.equal((await request('/customers/'+spare.data.id,'DELETE')).status,200);
      assert.equal((await request('/customers/'+spare.data.id)).status,404);
    });
    await t.test('concurrent session starts allow only one active session per station', async () => {
      const results=await Promise.all([request('/sessions','POST',{customerId:customer,stationId:station}),request('/sessions','POST',{customerId:customer,stationId:station})]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
      sessionId=results.find(r=>r.status===201).data.id;
      assert.equal((await request('/stations/'+station,'PATCH',{active:false})).status,409);
      assert.equal((await request('/payments','POST',{sessionId,amount:1,method:'Cash'})).status,409);
      await connection.execute('UPDATE gaming_sessions SET start_time=DATE_SUB(?, INTERVAL 1 HOUR) WHERE id=?',[require('../server/helpers').nowSql(),sessionId]);
    });
    await t.test('session end computes server charge and preserves rate snapshot', async () => {
      assert.equal((await request('/stations/'+station,'PATCH',{name:'TEST-PC-EDIT',specs:'RAM',hourlyRate:80,status:'available'})).status,200);
      const result=await request('/sessions/'+sessionId+'/end','PATCH');
      assert.equal(result.status,200); assert.ok(result.data.charge>=40 && result.data.charge<40.1);
      assert.equal((await request('/sessions/'+sessionId+'/end','PATCH')).status,409);
      assert.equal((await request('/sessions/'+sessionId)).data.hourlyRate,40);
    });
    await t.test('concurrent payments cannot exceed the remaining balance', async () => {
      const results=await Promise.all([request('/payments','POST',{sessionId,amount:25,method:'Cash'}),request('/payments','POST',{sessionId,amount:25,method:'Cash'})]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
      const [rows]=await connection.execute('SELECT SUM(amount) paid FROM payments WHERE session_id=?',[sessionId]);
      assert.equal(Number(rows[0].paid),25);
    });
    await t.test('reservations persist IDs, reject overlaps and invalid dates, update and cancel', async () => {
      const body={customerId:customer,stationId:station,date:tomorrow,startTime:'10:00',endTime:'11:00'};
      const result=await request('/reservations','POST',body);
      assert.equal(result.status,201); assert.match(result.data.id,/^\d+$/);
      assert.equal((await request('/reservations','POST',body)).status,409);
      assert.equal((await request('/reservations','POST',{...body,date:'2026-02-30'})).status,400);
      assert.equal((await request('/reservations/'+result.data.id,'PATCH',{...body,startTime:'11:00',endTime:'12:00'})).status,200);
      assert.equal((await request('/reservations/'+result.data.id)).data.startTime,'11:00');
      assert.equal((await request('/reservations/'+result.data.id,'PATCH',{status:'cancelled'})).status,200);
    });
    await t.test('categories support create/edit/deactivate and protect linked records', async () => {
      const result=await request('/categories','POST',{name:'Desserts'}); category=result.data.id;
      assert.equal(result.status,201);
      assert.equal((await request('/categories','POST',{name:'Desserts'})).status,409);
      assert.equal((await request('/categories/'+category,'PATCH',{name:'Sweet Desserts'})).status,200);
      assert.equal((await request('/categories/1','DELETE')).status,409);
      const empty=await request('/categories','POST',{name:'Empty Category'});
      assert.equal((await request('/categories/'+empty.data.id,'DELETE')).status,200);
    });
    await t.test('food/image upload, binary retrieval, replace and image removal', async () => {
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV9sAAAAASUVORK5CYII=','base64');
      function form() { const f=new FormData(); for (const [k,v] of Object.entries({name:'Test Cake',categoryId:category,description:'Cake',price:'25',available:'true',featured:'false'})) f.append(k,v); f.append('image',new Blob([png],{type:'image/png'}),'cake.png'); return f; }
      const result=await request('/food-items','POST',form()); assert.equal(result.status,201); food=result.data.id;
      const first=(await request('/food-items/'+food)).data.image;
      assert.match(first,/^\/uploads\/food\/.+\.png$/);
      assert.equal((await fetch(base.replace('/api','')+first)).status,200);
      assert.equal((await request('/food-items/'+food,'PATCH',form())).status,200);
      await assert.rejects(fs.access(path.join(__dirname,'..',first)));
      const second=(await request('/food-items/'+food)).data.image;
      assert.notEqual(first,second);
      assert.equal((await request('/food-items/'+food+'/image','DELETE')).status,200);
      await assert.rejects(fs.access(path.join(__dirname,'..',second)));
      assert.equal((await request('/food-items/'+food)).data.image,'');
    });
    await t.test('invalid image files are rejected without creating records', async () => {
      const form=new FormData(); form.append('image',new Blob(['not an image'],{type:'image/png'}),'fake.png');
      assert.equal((await request('/food-items','POST',form)).status,400);
    });
    await t.test('orders use server prices, persist detail lines, and enforce state transitions', async () => {
      assert.equal((await request('/food-orders','POST',{items:[{foodId:food,quantity:0}]})).status,400);
      const result=await request('/food-orders','POST',{items:[{foodId:food,quantity:2}],total:1});
      assert.equal(result.status,201);
      const order=(await request('/food-orders/'+result.data.id)).data;
      assert.equal(order.total,50); assert.equal(order.items[0].lineTotal,50);
      assert.equal((await request('/food-orders/'+order.id+'/status','PATCH',{status:'completed'})).status,409);
      assert.equal((await request('/food-orders/'+order.id+'/status','PATCH',{status:'preparing'})).status,200);
      assert.equal((await request('/food-orders/'+order.id+'/status','PATCH',{status:'completed'})).status,200);
      assert.equal((await request('/food-orders/'+order.id+'/status','PATCH',{status:'cancelled'})).status,409);
      assert.equal((await request('/food-items/'+food,'DELETE')).status,409);
      await request('/categories/'+category,'PATCH',{active:false});
      assert.equal((await request('/food-orders','POST',{items:[{foodId:food,quantity:1}]})).status,409);
    });
    await t.test('unreferenced food can be deleted; availability is editable', async () => {
      const result=await request('/food-items','POST',{name:'Temporary Food',categoryId:'1',price:10});
      assert.equal(result.status,201);
      assert.equal((await request('/food-items/'+result.data.id,'PATCH',{available:false})).status,200);
      assert.equal((await request('/food-items/'+result.data.id,'DELETE')).status,200);
    });
    await t.test('admin accounts, last-admin guard, and shared preferences', async () => {
      assert.equal((await request('/users/1','PATCH',{fullName:'Alex Rivera',username:'admin',role:'staff',password:''})).status,409);
      assert.equal((await request('/users/1','PATCH',{active:false})).status,409);
      const added=await request('/users','POST',{fullName:'Test Staff',username:'test.staff',password:'test123',role:'staff'});
      assert.equal(added.status,201);
      assert.equal((await request('/users/'+added.data.id,'PATCH',{active:false})).status,200);
      assert.equal((await request('/auth/login','POST',{username:'test.staff',password:'test123'},{cookie:''})).status,403);
      assert.equal((await request('/settings/preferences','PATCH',{compactTables:true,reduceMotion:false},staff)).status,200);
      assert.equal((await request('/settings')).data.prefs.compactTables,true);
    });
    await t.test('reports match persisted payments and source files are not public', async () => {
      const report=await request('/reports'); assert.equal(report.status,200);
      const [rows]=await connection.query('SELECT SUM(amount) total FROM payments');
      assert.equal(report.data.revenue,Number(rows[0].total));
      const [dbRows]=await connection.query('SELECT VERSION() AS version');
      console.log('Database verified:',dbRows[0].version);
      for (const resource of ['/.env','/sql/seed.sql','/server/server.js']) assert.equal((await fetch(base.replace('/api','')+resource)).status,404);
    });
    await t.test('logout invalidates the authenticated session', async () => {
      assert.equal((await request('/auth/logout','POST')).status,200);
      assert.equal((await request('/state')).status,401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (created) await connection.query(`DROP DATABASE \`${database}\``);
    await connection.end();
  }
});
