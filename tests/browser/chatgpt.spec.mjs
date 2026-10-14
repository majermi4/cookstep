import {test,expect} from '@playwright/test';
async function expectSync(page,text){if(!await page.locator('.settings-dialog').isVisible())await page.locator('.settings-trigger').click();await expect(page.locator('.sync-control')).toContainText(text);await page.locator('.modal-close').click();}
import {readFile} from 'node:fs/promises';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
// Legacy fixtures exercise schema mutations independently of translated overlays.
delete sample.translations;
import {recipeText} from '../../src/recipe-locales.js';
const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSAAAAABJRU5ErkJggg==';
async function rpc(page,name,args={}){if(name==='save_recipe'&&args.recipe){const text=recipeText(args.recipe);args={...args,recipe:{...args.recipe,translations:{en:text,es:structuredClone(text),cs:structuredClone(text)}}};}return page.evaluate(async({name,args})=>{const response=await fetch('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return {status:response.status,data:await response.json()};},{name,args});}
test('ChatGPT recipe tools save to the browser library, preserve images and sessions, and reject stale edits',async({page,request})=>{
  const discovery=await request.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'server/discover'}});expect((await discovery.json()).result.supportedVersions).toContain('2026-07-28');
  const list=await request.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/list'}});const tools=(await list.json()).result.tools;expect(tools.map(t=>t.name)).toEqual(expect.arrayContaining(['save_recipe','import_recipe_image']));expect(tools.find(t=>t.name==='get_recipe_format').description).toContain('complete');
  const noAuth=await request.post('/mcp',{data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_recipes',arguments:{}}}});expect(noAuth.status()).toBe(401);
  await page.goto('/signin-with-chatgpt?return_to=%2F');await expectSync(page,'Recipes synced across devices');
  const format=await rpc(page,'get_recipe_format');expect(format.data.result.structuredContent.example.formatVersion).toBe('0.2');
  const guide=await readFile(new URL('../../AI_RECIPE_GUIDE.md',import.meta.url),'utf8');expect(format.data.result.structuredContent.preparationGuide).toBe(guide);
  for(const url of ['https://127.0.0.1/private','https://localhost/private','file:///private'])expect((await rpc(page,'import_recipe_image',{url})).data.result.isError).toBe(true);
  const uploaded=await rpc(page,'upload_recipe_image',{base64});const asset=uploaded.data.result.structuredContent;
  const recipe={...structuredClone(sample),id:crypto.randomUUID(),title:'ChatGPT test '+crypto.randomUUID(),images:[{id:'photo',path:'images/test.png',alt:'Test image',origin:'user_supplied',kind:'photo'}],coverImageId:'photo'};
  const mutationId=crypto.randomUUID();
  const added=await rpc(page,'save_recipe',{recipe,expectedRevision:null,mutationId,assets:{photo:asset}});expect(added.data.result.isError).toBeUndefined();
  expect((await rpc(page,'save_recipe',{recipe,expectedRevision:null,mutationId})).data.result.structuredContent.revision).toBe(mutationId);
  await page.reload();await expect(page.locator(`.card-click[data-id="${recipe.id}"]`)).toBeVisible();
  await page.locator(`.card-click[data-id="${recipe.id}"]`).click();await page.locator('[data-action="start"]').click();
  const before=await page.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});
  const current=(await rpc(page,'get_recipe',{id:recipe.id})).data.result.structuredContent;
  recipe.title+=' updated';const updated=await rpc(page,'save_recipe',{recipe,expectedRevision:current.revision,mutationId:crypto.randomUUID()});expect(updated.data.result.isError).toBeUndefined();
  const stale=await rpc(page,'save_recipe',{recipe:{...recipe,title:'Stale overwrite'},expectedRevision:current.revision,mutationId:crypto.randomUUID()});expect(stale.data.result.isError).toBe(true);
  const newCurrent=(await rpc(page,'get_recipe',{id:recipe.id})).data.result.structuredContent;expect(newCurrent.assets.photo.key).toBe(asset.key);expect(newCurrent.recipe.title).toBe(recipe.title);
  const foreign=await rpc(page,'save_recipe',{recipe,expectedRevision:newCurrent.revision,mutationId:crypto.randomUUID(),assets:{photo:{key:'recipes/another-user/image'}}});expect(foreign.data.result.isError).toBe(true);
  const invalid=await rpc(page,'save_recipe',{recipe:{...recipe,steps:[]},expectedRevision:newCurrent.revision,mutationId:crypto.randomUUID()});expect(invalid.data.result.isError).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect.poll(()=>page.evaluate(async id=>{const {read}=await import('/storage.js');return (await read('recipes',id))?.recipe.title;},recipe.id)).toBe(recipe.title);
  const after=await page.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});expect(after).toEqual(before);
  await page.locator('[data-action="cooking-menu"]').click();
  // Return through the existing cooking options menu to inspect the updated library.
  await page.locator('[data-action="library"]').last().click();
  await page.locator(`.card-click[data-id="${recipe.id}"]`).click();
  expect(await page.locator('.cover img').first().evaluate(img=>img.naturalWidth)).toBe(1);
  await page.locator('.settings-trigger').click();await page.getByRole('button',{name:'ChatGPT',exact:true}).click();const editPrompt=await page.locator('#chatgpt-prompt').inputValue();expect(editPrompt).toContain(`ID: ${recipe.id}`);expect(editPrompt).toContain('My changes:');expect(editPrompt).toContain(guide.split('\n').find(line=>line.startsWith('> ')).slice(2));await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Recipe options',exact:true}).click();const download=page.waitForEvent('download');await page.locator('[data-action="export-recipe"]').click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.cookstep\.zip$/);
  await page.getByRole('button',{name:'Cookstep home',exact:true}).click();await page.locator(`[data-action="delete"][data-id="${recipe.id}"]`).click();await page.locator('[data-action="confirm-delete"]').click();await expectSync(page,'Recipes synced across devices');
});
test('whole-library ZIP preview supports copies and works on tablet and phone',async({page})=>{
  await page.route('**/api/library**',route=>route.fulfill({status:503,json:{error:'Isolated local library test'}}));
  await page.goto('/');
  await page.evaluate(async sample=>{const {changeRecipes}=await import('/storage.js');await changeRecipes(['local-one','local-two'].map(id=>({id,recipe:{...sample,id,title:id},assets:{},savedAt:Date.now()})));},sample);
  await page.reload();await expect(page.locator('.add-card,.page-heading [data-action="import"],[data-action="export-library"]')).toHaveCount(0);await page.getByRole('button',{name:'Recipe library options',exact:true}).click();const download=page.waitForEvent('download');await page.locator('[data-action="export-library"]').click();const file=await download;const path=await file.path();
  await page.getByRole('button',{name:'Recipe library options',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import recipes',exact:true}).click();await (await chooser).setFiles({name:'cookstep-library.zip',mimeType:'application/zip',buffer:await readFile(path)});await expect(page.getByRole('heading',{name:'Import 2 recipes',exact:true})).toBeVisible();
  await page.locator('[data-action="copy-library"]').click();await expect(page.locator('.recipe-card')).toHaveCount(4);
  await page.locator('.settings-trigger').click();await page.getByRole('button',{name:'ChatGPT',exact:true}).click();const prompt=await page.locator('#chatgpt-prompt').inputValue();
  const guide=await readFile(new URL('../../AI_RECIPE_GUIDE.md',import.meta.url),'utf8');expect(prompt).toContain(guide.split('\n').find(line=>line.startsWith('> ')).slice(2));expect(prompt).toContain('import_recipe_image');expect(prompt).toContain('preparationGuide');expect(prompt).toContain('expectedRevision');
  for(const viewport of [{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/chatgpt-${viewport.width}.png`});}
});
