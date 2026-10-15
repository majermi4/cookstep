import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,extname} from 'node:path';
import {zipSync,strToU8} from 'fflate';
let server,origin,version=1,broken=false,privateRequests=0,indexRequests=0;
const frontend=existsSync('dist/client/index.html')?'dist/client':'dist';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
test.beforeAll(async()=>{
  server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    res.setHeader('Cache-Control','no-store');
    // Match production hosting: the canonical app document is /.
    if(url.pathname==='/index.html'){
      indexRequests++;res.writeHead(307,{Location:'/'}).end();return;
    }
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/mcp')||url.pathname.startsWith('/signin')){
      privateRequests++;res.writeHead(401,{'Content-Type':'application/json'}).end('{"error":"Sign in required"}');return;
    }
    try{
      const path=url.pathname==='/'?'/index.html':url.pathname;
      if(broken&&path==='/themes.css'){res.writeHead(503).end();return;}
      let bytes=await readFile(resolve(frontend,'.'+path));
      if(path==='/sw.js')bytes=Buffer.from(bytes.toString().replace(/const VERSION = "([^"]+)";/,`const VERSION = "$1-test${version}";`));
      res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
test.beforeEach(()=>{version=1;broken=false;privateRequests=0;indexRequests=0;});
async function open(page){
  await page.goto(origin);await expect(page.locator('[data-action="example"]')).toBeVisible();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function addRecipe(page){await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();}
async function snapshot(page){return page.evaluate(async()=>{const{read}=await import('/storage.js');return {recipes:await read('recipes'),session:await read('sessions','active'),shopping:await read('shopping')};});}
async function update(page){version++;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});await expect(page.locator('#pwa-status')).toContainText('Update available');}

test('manual update checks install through the canonical app URL when index.html redirects',async({page})=>{
  await open(page);await addRecipe(page);
  const before=await snapshot(page);
  version++;
  await page.locator('.settings-trigger').click();
  await page.locator('#pwa-settings [data-action="check-app-update"]').click();
  await expect(page.locator('#pwa-settings [data-action="update-app"]')).toBeVisible();
  await page.locator('.modal-close').click();
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),page.locator('#pwa-status [data-action="update-app"]').click()]);
  await expect(page.locator('.recipe-card')).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
  expect(indexRequests).toBe(0);
});

test('manifest, offline cooking, recipe images, shopping checks and timers survive a disconnected reload',async({page,context})=>{
  await open(page);
  const manifest=await page.evaluate(()=>fetch('/manifest.webmanifest').then(r=>r.json()));
  expect(manifest.display).toBe('standalone');expect(manifest.icons.map(i=>i.sizes)).toContain('192x192');expect(manifest.icons.map(i=>i.purpose)).toContain('maskable');
  const cdp=await context.newCDPSession(page);expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.filter(error=>error.errorId!=='in-incognito')).toEqual([]);
  const recipe=JSON.parse(await readFile('examples/recipe.json','utf8'));delete recipe.translations;
  recipe.images=[{id:'offline-photo',path:'images/test.png',alt:'Offline food',origin:'user_supplied',kind:'photo'}];recipe.coverImageId='offline-photo';
  const image=await readFile('public/icons/icon-192.png');
  await page.locator('#file-input').setInputFiles({name:'meal.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'recipe.json':strToU8(JSON.stringify(recipe)),'images/test.png':image}))});
  await page.locator('[data-action="save-import"]').click();
  await page.locator('[data-action="shopping"]').click();await page.locator('[data-shopping-check]').first().check();await page.locator('[data-action="shopping-back"]').click();await page.locator('[data-action="start"]').click();
  await page.locator('.task-button[data-id="sauce"]').click();await page.locator('[data-action="start-timer"]').click();await page.locator('[data-ingredient-check]').first().check();
  const before=await snapshot(page);
  await context.setOffline(true);await page.reload();await expect(page.locator('.resume-banner')).toBeVisible();await expect.poll(()=>page.locator('.recipe-card img').evaluate(img=>img.naturalWidth)).toBe(192);await page.locator('[data-action="resume"]').click();await expect(page.locator('.timer-card')).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
  expect(await page.evaluate(async()=>{try{await fetch('/api/library');return false;}catch{return true;}})).toBe(true);
  const keys=await page.evaluate(async()=>{const out=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())out.push(new URL(r.url).pathname);return out;});
  expect(keys).not.toContain('/api/library');expect(keys).not.toContain('/signin-with-chatgpt');expect(keys).toContain('/app.js');
  await page.screenshot({path:'artifacts/pwa-offline-cooking.png'});
});

test('a real waiting update never interrupts a meal and preserves local data after explicit acceptance',async({page})=>{
  await open(page);await addRecipe(page);await page.locator('[data-action="start"]').click();
  const before=await snapshot(page);let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  await update(page);await expect(page.locator('#pwa-status [data-action="update-app"]')).toBeDisabled();expect(navigations).toBe(0);expect(await snapshot(page)).toEqual(before);
  await page.locator('.settings-trigger').click();await page.locator('[data-locale]').selectOption('cs');await expect(page.locator('#pwa-status')).toContainText('Dostupná aktualizace');await page.locator('[data-locale]').selectOption('en');await page.locator('.modal-close').click();
  await page.locator('[data-action="cooking-menu"]').click();await page.locator('[data-action="finish"]').click();await page.locator('[data-action="confirm-finish"]').click();
  await expect(page.locator('#pwa-status [data-action="update-app"]')).toBeEnabled();
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),page.locator('#pwa-status [data-action="update-app"]').click()]);
  await expect(page.locator('.recipe-card')).toHaveCount(1);await expect(page.locator('#pwa-status')).toBeEmpty();
  expect((await snapshot(page)).recipes).toEqual(before.recipes);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).toEqual([expect.stringContaining('test2')]);
});

test('updates are blocked by an unfinished import in another app window',async({page,context})=>{
  await open(page);const other=await context.newPage();await open(other);await other.locator('[data-action="example"]').click();
  await update(page);await page.locator('#pwa-status [data-action="update-app"]').click();await expect(page.locator('#toast')).toContainText('close other Cookstep windows');
  expect(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  await other.close();await page.locator('#pwa-status [data-action="update-app"]').click();await expect(page.locator('#pwa-status')).toBeEmpty();
});

test('a failed update download keeps the previous version usable offline and retries successfully',async({page,context})=>{
  await open(page);broken=true;version++;
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).installing))).toBe(false);
  expect(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(false);
  await context.setOffline(true);await page.reload();await expect(page.locator('[data-action="example"]')).toBeVisible();
  broken=false;await context.setOffline(false);await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await expect(page.locator('#pwa-status')).toContainText('Update available');
  for(const path of ['/api/library','/mcp','/signin-with-chatgpt'])expect(await page.evaluate(async path=>(await fetch(path)).status,path)).toBe(401);
  expect(privateRequests).toBeGreaterThanOrEqual(3);
});

test('install instructions and update controls fit phone/tablet settings in all locales',async({page})=>{
  await open(page);await page.locator('.settings-trigger').click();
  const feedback={en:'No new version available.',es:'No hay una nueva versión disponible.',cs:'Nová verze není dostupná.'};
  for(const locale of ['en','es','cs']){
    await page.locator('[data-locale]').selectOption(locale);
    await page.locator('#pwa-settings [data-action="check-app-update"]').click();
    await expect(page.locator('#modal #pwa-feedback')).toHaveText(feedback[locale]);
    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
      await page.setViewportSize(viewport);await expect(page.locator('#pwa-settings [data-action="install-app"]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.locator('#pwa-feedback').scrollIntoViewIfNeeded();
      expect(await page.locator('#pwa-feedback').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      expect(await page.locator('.pwa-help').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(12);
      await page.screenshot({path:`artifacts/pwa-settings-feedback-${locale}-${viewport.width}.png`});
    }
  }
  await page.locator('[data-locale]').selectOption('en');await page.locator('[data-action="install-app"]').click();await expect(page.locator('#modal')).toContainText('Add to Home Screen');await page.screenshot({path:'artifacts/pwa-install-settings.png'});
});


test('a normal browser profile passes Chrome installation eligibility',async({},testInfo)=>{
  const directory=await mkdtemp(resolve(tmpdir(),'cookstep-install-'));
  const context=await chromium.launchPersistentContext(directory,{headless:true,...testInfo.project.use.launchOptions});
  try{
    const page=await context.newPage();await open(page);
    const cdp=await context.newCDPSession(page);
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  }finally{await context.close();await rm(directory,{recursive:true,force:true});}
});

test('a downloaded version activates automatically after all app windows close',async({page,context})=>{
  await open(page);await update(page);await page.close();
  const reopened=await context.newPage();await open(reopened);await expect(reopened.locator('#pwa-status')).toBeEmpty();
  await expect.poll(()=>reopened.evaluate(()=>caches.keys())).toEqual([expect.stringContaining('test2')]);
});
