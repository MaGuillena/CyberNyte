// Real browser + Express + SQL, using a disposable database.
require('dotenv').config({ quiet: true });
const { chromium, expect } = require('@playwright/test');
const mysql = require('mysql2/promise');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const database = `cybernyte_browser_${Date.now()}`;
  const connection = await mysql.createConnection({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USER || 'root',password:process.env.DB_PASSWORD || '',multipleStatements:true});
  let server, browser, pool, created = false;
  const passed = [];
  try {
    await connection.query(`CREATE DATABASE \`${database}\``); created = true;
    await connection.changeUser({database});
    await connection.query("SET time_zone='+08:00'");
    for (const file of ['schema.sql','seed.sql']) await connection.query(await fs.readFile(path.join(__dirname,'../sql',file),'utf8'));
    process.env.DB_NAME=database;
    const app=require('../server/server'); pool=require('../server/db').pool;
    server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
    const base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await fs.mkdir(path.join(__dirname,'../docs/screenshots'),{recursive:true});
    async function nav(hash) {
      await page.locator(`.nav-link[href="#${hash}"]`).click();
      await expect(page.locator('#breadcrumb-page')).toHaveText(hash==='food-availability'?'Food Availability':hash==='food-orders'?'Food Orders':hash==='users'?'User Management':hash==='sessions'?'Gaming Sessions':hash==='payments'?'Billing & Payments':hash==='stations'?'Computer Stations':hash[0].toUpperCase()+hash.slice(1));
    }
    async function submit(name) {
      await page.locator('#modal').getByRole('button',{name,exact:true}).click();
      await expect(page.locator('#modal')).not.toBeVisible();
    }
    async function confirm() {
      await page.locator('#confirm-dialog').getByRole('button').last().click();
      await expect(page.locator('#confirm-dialog')).not.toBeVisible();
    }
    await page.goto(base);
    await page.getByLabel('Username',{exact:true}).fill('admin');
    await page.getByLabel('Password',{exact:true}).fill('admin123');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page.locator('#app-view')).toBeVisible();
    await expect(page.locator('#dash-stats')).toContainText('Total stations');
    passed.push('Admin login and database dashboard');

    await nav('stations');
    await page.getByRole('button',{name:'Add Station',exact:true}).click();
    await page.locator('#f-name').fill('BROWSER-PC');
    await page.locator('#f-specs').fill('Browser test computer');
    await page.locator('#f-hourlyRate').fill('40');
    await submit('Add station');
    await expect(page.locator('#station-grid')).toContainText('BROWSER-PC');
    await page.reload(); await expect(page.locator('#station-grid')).toContainText('BROWSER-PC');
    await page.getByLabel('View details of BROWSER-PC',{exact:true}).click();
    await expect(page.locator('#modal')).toContainText('Browser test computer');
    await page.locator('#modal').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByLabel('Edit BROWSER-PC',{exact:true}).click();
    await page.locator('#f-name').fill('BROWSER-PC-EDIT');
    await submit('Save changes');
    await expect(page.locator('#station-grid')).toContainText('BROWSER-PC-EDIT');
    await page.locator('[data-action="deactivate"][data-id="4"]').click(); await confirm();
    await expect(page.locator('[data-action="reactivate"][data-id="4"]')).toBeVisible();
    await page.locator('[data-action="reactivate"][data-id="4"]').click();
    await expect(page.locator('[data-action="deactivate"][data-id="4"]')).toBeVisible();
    passed.push('Station CRUD/details/deactivation and persistence after reload');

    await nav('customers');
    await page.getByRole('button',{name:'Add Customer',exact:true}).click();
    await page.locator('#f-fullName').fill('Browser Customer');
    await submit('Add customer');
    await page.locator('#customer-search').fill('Browser Customer');
    await expect(page.locator('#customer-table tbody tr')).toHaveCount(1);
    await page.getByLabel('Edit Browser Customer',{exact:true}).click();
    await page.locator('#f-fullName').fill('Browser Customer Edited');
    await submit('Save changes');
    await page.getByLabel('View Browser Customer Edited',{exact:true}).click();
    await expect(page.locator('#modal')).toContainText('Gaming session history');
    await page.locator('#modal').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByLabel('Delete Browser Customer Edited',{exact:true}).click(); await confirm();
    await expect(page.locator('#customer-table')).not.toContainText('Browser Customer Edited');
    passed.push('Customer create/edit/details/search/delete');

    await nav('categories');
    await page.getByRole('button',{name:'Add Category',exact:true}).click();
    await page.locator('#f-name').fill('Browser Desserts');
    await submit('Save');
    await expect(page.locator('#category-table')).toContainText('Browser Desserts');
    await nav('food-availability');
    await page.getByRole('button',{name:'Add Food',exact:true}).click();
    await page.locator('#f-name').fill('Browser Cake');
    await page.locator('#f-categoryId').selectOption({label:'Browser Desserts'});
    await page.locator('#f-price').fill('25');
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV9sAAAAASUVORK5CYII=','base64');
    await page.locator('#f-image').setInputFiles({name:'cake.png',mimeType:'image/png',buffer:png});
    await submit('Save');
    await expect(page.locator('#food-avail-grid')).toContainText('Browser Cake');
    const cake=page.locator('.food-card').filter({has:page.getByRole('heading',{name:'Browser Cake',exact:true})});
    await expect(cake.locator('img')).toHaveJSProperty('naturalWidth',1);
    await cake.getByRole('button',{name:'Edit',exact:true}).click();
    await page.locator('#modal [name=removeImage]').check();
    await submit('Save');
    await expect(cake.locator('img')).not.toBeVisible();
    passed.push('Dynamic category and menu form, image upload and removal');

    await cake.getByRole('button',{name:'Add to Order',exact:true}).click();
    await nav('food-orders');
    await expect(page.locator('#order-cart')).toContainText('Browser Cake');
    await page.locator('#order-cart [data-action="place"]').click();
    await expect(page.locator('#modal')).toContainText('Order placed');
    await page.locator('#modal').getByRole('button',{name:'Close',exact:true}).click();
    await expect(page.locator('#order-history')).toContainText('Pending');
    await page.locator('#order-history [data-action="prepare"]').last().click();
    await expect(page.locator('#order-history [data-action="complete"]')).toHaveCount(2);
    await page.locator('#order-history [data-action="complete"]').last().click();
    passed.push('Food cart, persisted order, and preparation/completion');

    await nav('sessions');
    await page.getByRole('button',{name:'Start Session',exact:true}).click();
    await page.locator('#f-customerId').selectOption('1');
    await page.locator('#f-stationId').selectOption('4');
    await submit('Start session');
    await expect(page.locator('#session-table')).toContainText('Running');
    await connection.execute('UPDATE gaming_sessions SET start_time=DATE_SUB(?, INTERVAL 1 HOUR) WHERE station_id=4 AND status=?',[require('../server/helpers').nowSql(),'active']);
    await page.reload(); await expect(page.locator('#session-table')).toContainText('Running');
    await page.locator('#session-table [data-action="end"]').click();
    await page.locator('#modal').getByRole('button',{name:'End session',exact:true}).click();
    await expect(page.locator('#modal')).toContainText('Record payment');
    await page.locator('#f-amount').fill('10');
    await submit('Record payment');
    await nav('payments'); await expect(page.locator('#page-content')).toContainText('Partial');
    passed.push('Session start/end and partial payment through chained modals');

    await nav('reservations');
    await page.getByRole('button',{name:'Create Reservation',exact:true}).click();
    await page.locator('#f-customerId').selectOption('1');
    await page.locator('#f-stationId').selectOption('4');
    await page.locator('#f-date').fill(new Date(Date.now()+8*3600000+2*86400000).toISOString().slice(0,10));
    await page.locator('#f-startTime').fill('10:00');
    await page.locator('#f-endTime').fill('11:00');
    await submit('Create reservation');
    await expect(page.locator('#resv-table [data-action="cancel"]')).toHaveCount(4);
    passed.push('Reservation create and generated record ID');

    await nav('reports');
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export CSV',exact:true}).click();
    const csv=await download; assert.match(csv.suggestedFilename(),/cybernyte-transactions/);
    await expect(page.locator('#toast-region')).toBeEmpty({timeout:10000});
    await page.screenshot({path:path.join(__dirname,'../docs/screenshots/admin-reports.png'),fullPage:true,animations:'disabled'});
    await nav('users'); await expect(page.locator('#user-table')).toContainText('Alex Rivera');
    passed.push('Admin reports/CSV download and user management');

    await page.locator('#logout-btn').click(); await confirm();
    await page.getByLabel('Username',{exact:true}).fill('staff');
    await page.getByLabel('Password',{exact:true}).fill('staff123');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page.locator('#app-view')).toBeVisible();
    await expect(page.locator('.nav-link[href="#reports"]')).not.toBeVisible();
    await expect(page.locator('.nav-link[href="#users"]')).not.toBeVisible();
    for (const hash of ['reports','users']) {
      await page.goto(base+'/#'+hash);
      await expect(page.locator('#breadcrumb-page')).toHaveText('Dashboard');
    }
    for (const url of ['/api/reports','/api/users']) assert.equal((await context.request.get(base+url)).status(),403);
    await expect(page.locator('#toast-region')).toBeEmpty({timeout:10000});
    await page.screenshot({path:path.join(__dirname,'../docs/screenshots/staff-dashboard.png'),fullPage:true,animations:'disabled'});
    passed.push('Staff sidebar, direct URL restriction and API 403');

    await page.setViewportSize({width:390,height:844});
    await page.locator('#menu-toggle').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await page.locator('#sidebar-overlay').click({position:{x:380,y:100}});
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    await page.screenshot({path:path.join(__dirname,'../docs/screenshots/mobile-dashboard.png'),fullPage:true,animations:'disabled'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    passed.push('Mobile viewport without horizontal overflow');
    assert.deepEqual(errors,[]);
    passed.push('No uncaught browser JavaScript errors');
    await fs.writeFile(path.join(__dirname,'../docs/browser-results.json'),JSON.stringify({date:new Date().toISOString(),database:(await connection.query('SELECT VERSION() version'))[0][0].version,passed},null,2));
    console.log(JSON.stringify({passed},null,2));
  } catch(error) {
    console.error('Completed browser checks:',passed);
    if (browser) for (const ctx of browser.contexts()) for (const page of ctx.pages()) await page.screenshot({path:path.join(__dirname,'../tmp/browser-failure.png'),fullPage:true}).catch(()=>{});
    throw error;
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    if(pool) await pool.end();
    if(created) await connection.query(`DROP DATABASE \`${database}\``);
    await connection.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
