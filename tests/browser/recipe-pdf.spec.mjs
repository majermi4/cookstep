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
    const blob=await (await fetch('/icons/icon-192.png')).blob();
    const {write}=await import('/storage.js');await write('recipes',{id:recipe.id,recipe,assets:{cover:blob}});
  });
  await page.reload();await page.locator('.card-click').click();await choose(page,'cs');
  await exportPdf(page,'artifacts/pdf/long-recipe-cs.pdf');
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
