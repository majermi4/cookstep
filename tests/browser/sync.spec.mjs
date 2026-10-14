import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
// Legacy fixtures exercise schema mutations independently of translated overlays.
delete sample.translations;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');
async function signIn(page){await page.goto('/signin-with-chatgpt?return_to=%2F');await expect(page.locator('.sync-control')).toContainText('Recipes synced across devices');}
async function importRecipe(page,recipe,withImage=false){
  await page.locator('#file-input').setInputFiles(withImage?{name:'meal.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'recipe.json':strToU8(JSON.stringify(recipe)),'images/test.png':png}))}:{name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await page.locator('[data-action="save-import"], [data-action="save-replace"]').first().click();
  await page.getByRole('button',{name:'My recipes',exact:true}).click();
}
const card=(page,id)=>page.locator(`.card-click[data-id="${id}"]`);
const synced=page=>expect(page.locator('.sync-control')).toContainText('Recipes synced across devices');
test('recipe and image sync between independent phone/tablet devices, including replace, session snapshot and deletion',async({browser})=>{
  const computer=await browser.newContext({viewport:{width:1360,height:1000}}),tablet=await browser.newContext({viewport:{width:768,height:1024}});
  const a=await computer.newPage(),b=await tablet.newPage();
  const recipe={...structuredClone(sample),id:crypto.randomUUID(),title:'Cloud test '+crypto.randomUUID(),images:[{id:'cloud-photo',path:'images/test.png',alt:'Test image',origin:'user_supplied',kind:'photo'}],coverImageId:'cloud-photo'};
  recipe.steps[0].imageIds=['cloud-photo'];
  await signIn(a);await signIn(b);await importRecipe(a,recipe,true);await synced(a);
  await b.reload();await synced(b);await expect(card(b,recipe.id)).toBeVisible();
  await expect(card(b,recipe.id).locator('img')).toBeVisible();
  expect(await card(b,recipe.id).locator('img').evaluate(img=>img.naturalWidth)).toBe(1);
  await card(b,recipe.id).click();await b.locator('[data-action="start"]').click();
  const before=await b.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});
  recipe.title+=' updated';await importRecipe(a,recipe,true);await synced(a);
  await b.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect.poll(()=>b.evaluate(async id=>{const {read}=await import('/storage.js');return (await read('recipes',id))?.recipe.title;},recipe.id)).toBe(recipe.title);
  const after=await b.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});
  expect(after.record.recipe.title).toBe(before.record.recipe.title);expect(after.timers).toEqual(before.timers);
  await a.locator(`[data-action="delete"][data-id="${recipe.id}"]`).click();await a.locator('[data-action="confirm-delete"]').click();await expect(card(a,recipe.id)).toHaveCount(0);await synced(a);
  await b.reload();await synced(b);await expect(card(b,recipe.id)).toHaveCount(0);
  expect(await b.evaluate(async()=>{const {read}=await import('/storage.js');return Boolean(await read('sessions','active'));})).toBe(true);
  await b.setViewportSize({width:390,height:844});await b.screenshot({path:'artifacts/sync-phone.png'});
  expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await computer.close();await tablet.close();
});
test('failed image upload remains queued across reload and retries successfully',async({browser})=>{
  const context=await browser.newContext();const page=await context.newPage();await signIn(page);
  const recipe={...structuredClone(sample),id:crypto.randomUUID(),title:'Retry test '+crypto.randomUUID(),images:[{id:'test-photo',path:'images/test.png',alt:'Test image',origin:'user_supplied',kind:'photo'}],coverImageId:'test-photo'};
  await page.route('**/api/library/assets',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Temporary upload failure'}}):route.continue());
  await importRecipe(page,recipe,true);await expect(page.locator('.sync-control')).toContainText('waiting to upload');
  await page.reload();await expect(card(page,recipe.id)).toBeVisible();await expect(page.locator('.sync-control')).toContainText('waiting to upload');
  await page.unroute('**/api/library/assets');await page.locator('.local-badge').click();await page.getByRole('button',{name:'Retry sync'}).click();await synced(page);
  const fresh=await browser.newContext(),b=await fresh.newPage();await signIn(b);await expect(card(b,recipe.id)).toBeVisible();
  await page.locator(`[data-action="delete"][data-id="${recipe.id}"]`).click();await page.locator('[data-action="confirm-delete"]').click();await synced(page);
  await fresh.close();await context.close();
});
test('concurrent replacements preserve both versions',async({browser})=>{
  const first=await browser.newContext(),second=await browser.newContext();const a=await first.newPage(),b=await second.newPage();
  const recipe={...structuredClone(sample),id:crypto.randomUUID(),title:'Conflict '+crypto.randomUUID()};
  await signIn(a);await importRecipe(a,recipe);await synced(a);await signIn(b);await expect(card(b,recipe.id)).toBeVisible();
  await b.route('**/api/library**',route=>route.fulfill({status:503,json:{error:'Offline'}}));
  await importRecipe(b,{...recipe,title:recipe.title+' from tablet'});await expect(b.locator('.sync-control')).toContainText('waiting to upload');
  await importRecipe(a,{...recipe,title:recipe.title+' from computer'});await synced(a);
  await b.unroute('**/api/library**');await b.locator('.local-badge').click();await b.getByRole('button',{name:'Retry sync'}).click();await synced(b);
  await expect(card(b,recipe.id)).toContainText('from computer');
  await expect(b.getByRole('heading',{name:recipe.title+' from tablet',exact:true})).toBeVisible();
  await a.reload();await synced(a);await expect(a.getByRole('heading',{name:recipe.title+' from tablet',exact:true})).toBeVisible();
  // Clean up only the records created by this test.
  for(const page of [a]){
    const ids=await page.evaluate(async prefix=>{const {read}=await import('/storage.js');return (await read('recipes')).filter(r=>r.recipe.title.startsWith(prefix)).map(r=>r.id);},recipe.title);
    for(const id of ids){await page.locator(`[data-action="delete"][data-id="${id}"]`).click();await page.locator('[data-action="confirm-delete"]').click();await synced(page);}
  }
  await first.close();await second.close();
});
test('API requires sign-in and validates recipe manifests',async({request,browser})=>{
  expect((await request.get('/api/library')).status()).toBe(401);
  const context=await browser.newContext(),page=await context.newPage();await signIn(page);
  const result=await page.evaluate(async()=>fetch('/api/library/recipes/invalid',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe:{id:'invalid'},mutationId:crypto.randomUUID()})}).then(r=>r.status));
  expect(result).toBe(400);await context.close();
});
test('existing local libraries migrate and a lost save acknowledgement retries without duplicate recipes',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await signIn(page);
  const recipe={...structuredClone(sample),id:crypto.randomUUID(),title:'Migration '+crypto.randomUUID()};
  // Write an old-style local record without a cloud revision or upload queue.
  await page.evaluate(async recipe=>{
    const {database}=await import('/storage.js');const db=await database();
    await new Promise((resolve,reject)=>{const tx=db.transaction('recipes','readwrite');tx.objectStore('recipes').put({id:recipe.id,recipe:{...recipe,title:recipe.title+' (saved from this device)'},assets:{},savedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  },recipe);
  let loseAcknowledgement=true;
  await page.route('**/api/library/recipes/'+recipe.id,async route=>{
    if(route.request().method()==='PUT'&&loseAcknowledgement){loseAcknowledgement=false;await route.fetch();await route.fulfill({status:503,json:{error:'Connection closed after save'}});}
    else await route.continue();
  });
  await page.reload();await expect(card(page,recipe.id)).toBeVisible();await expect(page.locator('.sync-control')).toContainText('waiting to upload');
  await page.locator('.local-badge').click();await page.getByRole('button',{name:'Retry sync'}).click();await synced(page);
  const fresh=await browser.newContext(),b=await fresh.newPage();await signIn(b);
  await expect(b.getByRole('heading',{name:recipe.title,exact:true})).toHaveCount(1);
  await expect(b.getByRole('heading',{name:recipe.title+' (saved from this device)',exact:true})).toHaveCount(0);
  // A deletion made offline survives reload and reaches the second device.
  await page.route('**/api/library**',route=>route.fulfill({status:503,json:{error:'Offline'}}));
  await page.locator(`[data-action="delete"][data-id="${recipe.id}"]`).click();await page.locator('[data-action="confirm-delete"]').click();await expect(page.locator('.sync-control')).toContainText('waiting to upload');
  await page.reload();await expect(card(page,recipe.id)).toHaveCount(0);await expect(page.locator('.sync-control')).toContainText('waiting to upload');
  await page.unroute('**/api/library**');await page.locator('.local-badge').click();await page.getByRole('button',{name:'Retry sync'}).click();await synced(page);
  await b.reload();await synced(b);await expect(card(b,recipe.id)).toHaveCount(0);
  await fresh.close();await context.close();
});
