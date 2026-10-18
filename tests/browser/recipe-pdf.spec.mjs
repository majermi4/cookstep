import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

const choose=async(page,locale)=>{await page.locator('.settings-trigger').click();await page.locator('[data-locale]').selectOption(locale);await page.locator('.modal-close').click();};
const exportPdf=async(page,path)=>{
  await page.locator('[data-action="recipe-options"]').click();
  const ready=page.waitForEvent('download');await page.locator('[data-action="export-recipe-pdf"]').click();
  const download=await ready;await download.saveAs(path);
  const bytes=await readFile(path);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.length).toBeGreaterThan(15000);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);return download;
};

test('PDF downloads in every locale at phone and desktop sizes without changing cooking state',async({page})=>{
  await mkdir('artifacts/pdf',{recursive:true});
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await page.locator('[data-action="start"]').click();await page.locator('[data-action="cooking-menu"]').click();await page.locator('#modal [data-action="library"]').click();await page.locator('.card-click').click();
  await page.locator('#target').fill('4');await page.locator('#target').dispatchEvent('change');
  const snapshot=()=>page.evaluate(async()=>{const {read}=await import('/storage.js');return {recipes:await read('recipes'),session:await read('sessions','active')};});
  const before=await snapshot();
  for(const [locale,label] of [['en','Export recipe PDF'],['es','Exportar receta en PDF'],['cs','Exportovat recept do PDF']]){
    await choose(page,locale);
    for(const width of [390,1360]){
      await page.setViewportSize({width,height:900});await page.locator('[data-action="recipe-options"]').click();
      await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();await expect(page.locator('[data-action="export-recipe"]')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(width===390)await page.screenshot({path:`artifacts/pdf/menu-${locale}.png`});
      await page.locator('.modal-close').click();await exportPdf(page,`artifacts/pdf/recipe-${locale}-${width}.pdf`);
      await expect(page.locator('#target')).toHaveValue('4');expect(await snapshot()).toEqual(before);
    }
  }
});

test('PDF includes photos and long recipes paginate, including a long source URL',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();delete recipe.translations;
    recipe.title='Kuřecí paprikáš · Příprava a vaření';recipe.language='cs';
    recipe.ingredients[0].name='Žluté těstoviny';recipe.ingredients[0].notes='Uchovávejte v suchu.';
    recipe.steps[0].instruction=Array(45).fill('Připrav všechny suroviny, promíchej omáčku a vař na mírném ohni.').join('\n');
    recipe.notes=['Podávej horké.'];recipe.sources=[{id:'web',title:'Původní recept',author:'Test kitchen',url:'https://example.com/'+('recipe-'.repeat(65))}];
    recipe.images=[{id:'cover',path:'images/cover.png',caption:'Čerstvě uvařené jídlo'}];recipe.coverImageId='cover';
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1200;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#d7bb85';ctx.fillRect(0,0,1800,1200);ctx.fillStyle='#718267';ctx.fillRect(100,100,1600,1000);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{cover:blob}});
  });
  await page.reload();await page.locator('.card-click').click();await choose(page,'cs');
  await exportPdf(page,'artifacts/pdf/long-recipe-cs.pdf');
});

test('cover and step photos retain original pixels, aspect ratios and recipe placement',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();delete recipe.translations;delete recipe.components;
    recipe.title='Illustrated recipe';recipe.steps=recipe.steps.slice(0,2).map((step,index)=>({...step,componentId:undefined,suggestedComponentIds:undefined,imageIds:[index?'portrait':'landscape']}));
    recipe.coverImageId='cover';const assets={};recipe.images=[];
    for(const [id,w,h,type,color] of [['cover',1800,1200,'image/jpeg','#935c36'],['landscape',2000,1000,'image/png','#55806a'],['portrait',800,1200,'image/webp','#627b99']]){
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
      ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w/4,h/4);
      assets[id]=await new Promise(resolve=>canvas.toBlob(resolve,type));recipe.images.push({id,path:`images/${id}.${type.split('/')[1]}`,caption:`${id} original picture`});
    }
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets});
  });
  await page.reload();await page.locator('.card-click').click();await exportPdf(page,'artifacts/pdf/original-images.pdf');
  const pdf=(await readFile('artifacts/pdf/original-images.pdf')).toString('latin1');
  const dimensions=[...pdf.matchAll(/\/Subtype \/Image\s*\/Width (\d+)\s*\/Height (\d+)/g)].map(match=>[Number(match[1]),Number(match[2])]);
  expect(dimensions).toEqual([[1800,1200],[2000,1000],[800,1200]]);
  expect(pdf).not.toContain('/Creator (Cookstep)');
});

test.describe('Export errors',()=>{
test.use({serviceWorkers:'block'});
test('failed font loading reports an error and allows retry',async({page})=>{
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await page.route('**/fonts/typeface-5.ttf',route=>route.abort());
  await page.locator('[data-action="recipe-options"]').click();await page.locator('[data-action="export-recipe-pdf"]').click();
  await expect(page.locator('#modal h2')).toHaveText('Couldn’t export PDF');await page.locator('.modal-close').click();
  await page.unroute('**/fonts/typeface-5.ttf');await exportPdf(page,'artifacts/pdf/retry.pdf');
});
test('a missing or broken recipe photo blocks export with a useful error',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const recipe=await (await fetch('/examples/recipe.json')).json();recipe.coverImageId='missing';
    recipe.images=[{id:'missing',path:'images/missing.png'}];
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{}});
  });
  await page.reload();await page.locator('.card-click').click();
  await page.locator('[data-action="recipe-options"]').click();await page.locator('[data-action="export-recipe-pdf"]').click();
  await expect(page.locator('#modal h2')).toHaveText('Couldn’t export PDF');
  await expect(page.locator('#modal')).toContainText('A recipe image could not be loaded. Sync your recipes and try again.');
});
});

test('PDF downloads offline once the installed app has cached its tools',async({page,context})=>{
  await page.goto('/');await page.locator('[data-action="example"]').click();await page.locator('[data-action="save-import"]').click();
  await expect(page.locator('[data-action="recipe-options"]')).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.locator('.card-click').click();
  await context.setOffline(true);
  await exportPdf(page,'artifacts/pdf/offline.pdf');
  await context.setOffline(false);
});
