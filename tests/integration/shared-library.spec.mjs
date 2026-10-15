import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {recipeText} from '../../src/recipe-locales.js';

const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
const originalOwner='FXp39bXKdHB4CkblZ0XDfiK4RrfCVnyMnX8R6lzZrvEv55sh6mLdFv';
const identity=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@sites.test`});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==','base64');

async function rpc(client,name,args={}){
  const response=await client.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});
  expect(response.status()).toBe(200);
  return (await response.json()).result;
}
async function synced(page){
  await page.locator('.settings-trigger').click();
  await expect(page.locator('.sync-control')).toContainText('Recipes synced across devices');
  await page.locator('.modal-close').click();
}

test('different invited identities share browser and MCP recipes, images, revisions and deletions while cooking stays local',async({browser,playwright,baseURL})=>{
  // These headers simulate identities already authorized by Sites dispatch.
  // Production access rejection happens before requests reach the Worker.
  const first=await browser.newContext({baseURL,extraHTTPHeaders:identity(originalOwner)});
  const second=await browser.newContext({baseURL,extraHTTPHeaders:identity('invited-spouse')});
  const visitor=await playwright.request.newContext({baseURL,extraHTTPHeaders:identity('another-invited-visitor')});
  const a=await first.newPage(),b=await second.newPage();
  const id=crypto.randomUUID();
  const recipe={...structuredClone(sample),id,title:'Shared recipe '+id,images:[{id:'photo',path:'images/shared.png',alt:'Shared photo',origin:'user_supplied',kind:'photo'}],coverImageId:'photo'};
  delete recipe.translations;
  const text=recipeText(recipe);recipe.translations={en:text,es:structuredClone(text),cs:structuredClone(text)};
  let currentRevision;
  try{
    const upload=await first.request.post('/api/library/assets',{headers:{'Content-Type':'image/png'},data:png});
    expect(upload.status()).toBe(200);const asset=await upload.json();
    expect(asset.key).toMatch(new RegExp(`^recipes/${originalOwner}/`));
    currentRevision=crypto.randomUUID();
    const saved=await first.request.put('/api/library/recipes/'+id,{data:{recipe,assets:{photo:asset},expectedRevision:null,mutationId:currentRevision}});
    expect(saved.status()).toBe(200);

    const listed=await rpc(second.request,'list_recipes',{query:recipe.title});
    expect(listed.structuredContent.recipes.map(r=>r.id)).toContain(id);
    const fetched=await rpc(second.request,'get_recipe',{id});
    expect(fetched.structuredContent.revision).toBe(currentRevision);
    expect(fetched.structuredContent.assets.photo.key).toBe(asset.key);
    const image=await second.request.get('/api/library/assets',{params:{key:asset.key}});
    expect(image.status()).toBe(200);expect(await image.body()).toEqual(png);
    expect((await second.request.get('/api/library/assets',{params:{key:'recipes/unrelated-private-scope/image'}})).status()).toBe(404);
    expect((await rpc(visitor,'get_recipe',{id})).structuredContent.recipe.id).toBe(id);

    await a.goto('/');await synced(a);await b.goto('/');await synced(b);
    const card=page=>page.locator(`.card-click[data-id="${id}"]`);
    await expect(card(a)).toBeVisible();await expect(card(b)).toBeVisible();
    expect(await card(b).locator('img').evaluate(img=>img.naturalWidth)).toBe(1);
    await card(b).click();await b.locator('[data-action="start"]').click();
    const snapshot=await b.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});
    expect(snapshot.record.id).toBe(id);
    expect(await a.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');})).toBeUndefined();

    const spouseUpload=await rpc(second.request,'upload_recipe_image',{base64:png.toString('base64')});
    expect(spouseUpload.structuredContent.key).toMatch(new RegExp(`^recipes/${originalOwner}/`));
    const edited=structuredClone(recipe);edited.title+=' updated by spouse';
    for(const locale of Object.keys(edited.translations))edited.translations[locale].title=edited.title;
    const previousRevision=currentRevision;currentRevision=crypto.randomUUID();
    const update=await rpc(second.request,'save_recipe',{recipe:edited,expectedRevision:previousRevision,mutationId:currentRevision});
    expect(update.isError).toBeUndefined();expect(update.structuredContent.revision).toBe(currentRevision);
    const stale=await first.request.put('/api/library/recipes/'+id,{data:{recipe,assets:{photo:asset},expectedRevision:previousRevision,mutationId:crypto.randomUUID()}});
    expect(stale.status()).toBe(409);
    const retained=await first.request.get('/api/library/recipes/'+id);
    expect((await retained.json()).assets.photo.key).toBe(asset.key);
    await a.reload();await synced(a);await expect(card(a)).toContainText(edited.title);
    await b.evaluate(()=>window.dispatchEvent(new Event('online')));
    await expect.poll(()=>b.evaluate(async id=>{const {read}=await import('/storage.js');return (await read('recipes',id))?.recipe.title;},id)).toBe(edited.title);
    expect(await b.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');})).toEqual(snapshot);

    const removed=await second.request.delete('/api/library/recipes/'+id,{data:{expectedRevision:currentRevision,mutationId:crypto.randomUUID()}});
    expect(removed.status()).toBe(200);currentRevision=null;
    await a.reload();await synced(a);await expect(card(a)).toHaveCount(0);
    await b.reload();await synced(b);
    expect(await b.evaluate(async id=>{const {read}=await import('/storage.js');return read('recipes',id);},id)).toBeUndefined();
    expect(await b.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');})).toEqual(snapshot);
    expect((await rpc(first.request,'get_recipe',{id})).isError).toBe(true);
  }finally{
    if(currentRevision)await first.request.delete('/api/library/recipes/'+id,{data:{expectedRevision:currentRevision,mutationId:crypto.randomUUID()}});
    await first.close();await second.close();await visitor.dispose();
  }
});

test('shared collection still requires complete trusted identity on every data path',async({request,playwright,baseURL})=>{
  for(const headers of [{},{'oai-authenticated-user-id':'id-without-email'},{'oai-authenticated-user-email':'email-without-id@sites.test'}]){
    const client=await playwright.request.newContext({baseURL,extraHTTPHeaders:headers});
    expect((await client.get('/api/library')).status()).toBe(401);
    expect((await client.get('/api/library/recipes/any')).status()).toBe(401);
    expect((await client.put('/api/library/recipes/any',{data:{}})).status()).toBe(401);
    expect((await client.delete('/api/library/recipes/any',{data:{}})).status()).toBe(401);
    expect((await client.get('/api/library/assets',{params:{key:`recipes/${originalOwner}/image`}})).status()).toBe(401);
    expect((await client.post('/api/library/assets',{data:png})).status()).toBe(401);
    const denied=await client.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_recipes',arguments:{}}}});
    expect(denied.status()).toBe(401);await client.dispose();
  }
  const discovery=await request.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/list'}});
  expect(discovery.status()).toBe(200);expect((await discovery.json()).result.tools.length).toBeGreaterThan(0);
});
