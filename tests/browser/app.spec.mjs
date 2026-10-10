import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
const click=(page,action)=>action==='library'?page.getByRole('button',{name:'My recipes',exact:true}).click():page.locator(`[data-action="${action}"]`).click();
const upload=(page,recipe)=>page.locator('#file-input').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
async function saveExample(page){await page.goto('/');await click(page,'example');await expect(page.getByText('Package validated.',{exact:false})).toBeVisible();await click(page,'save-import');await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeVisible();}

test('complete example import, scaling, task progress and timestamp recovery',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await saveExample(page);await page.locator('#target').fill('3');await page.locator('#target').press('Tab');await page.locator('#units').selectOption('metric');
  await expect(page.getByText('300 g',{exact:true}).first()).toBeVisible();await expect(page.getByText('22.18 ml',{exact:true}).first()).toBeVisible();
  await click(page,'start');await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.locator('.task-button[data-id="sauce"]').click();await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();await expect(page.locator('.step-ingredient-box')).toContainText('600 g');
  await page.locator('#batch-name').fill('Batch 1');await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(1);await page.locator('#batch-name').fill('Batch 2');await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(2);
  await page.locator('.task-button[data-id="pasta"]').click();await click(page,'next');await expect(page.getByRole('heading',{name:'Cook the pasta',exact:true})).toBeVisible();await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(3);
  await page.reload();await expect(page.getByText('Your kitchen is still open')).toBeVisible();await click(page,'resume');await expect(page.getByRole('heading',{name:'Cook the pasta',exact:true})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(3);await expect(page.locator('.task-button[data-id="pasta"]')).toContainText('1 of 2');
  await page.locator('.timer-card').first().getByRole('button',{name:'View step'}).click();await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();
  await page.screenshot({path:'artifacts/cooking-desktop.png',fullPage:true});
  await click(page,'finish');await expect(page.getByRole('dialog')).toContainText('3 timers are still running');await click(page,'confirm-finish');await expect(page.getByRole('heading',{name:'Your recipes'})).toBeVisible();await page.reload();await expect(page.getByText('Your kitchen is still open')).toHaveCount(0);expect(errors).toEqual([]);
});

test('countdown expires visibly without completing a step and can be acknowledged',async({page})=>{
  const r=structuredClone(sample);r.steps[2].timers[0].durationSeconds=2;await page.goto('/');await upload(page,r);await click(page,'save-import');await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  await expect(page.locator('.expiry-alert')).toContainText('Time to check Tomato sauce',{timeout:5000});await expect(page.locator('.timer-card')).toHaveClass(/expired/);await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('0 of 1');
  await page.locator('.expiry-alert').getByRole('button',{name:'I’ve checked · stop'}).click();await expect(page.locator('.expiry-alert')).toHaveCount(0);await expect(page.locator('.timer-card')).toContainText('Stopped');
  await click(page,'manual');await page.getByLabel('What’s cooking?').fill('Check pan');await page.getByLabel('Timer type').selectOption('elapsed');await page.getByRole('button',{name:'Start timer now'}).click();await expect(page.locator('.timer-card')).toHaveCount(2);await expect(page.locator('.timer-card').last()).toContainText('Elapsed');
});

test('replacement is explicit and active session keeps original title',async({page})=>{
  await saveExample(page);await click(page,'start');const updated=structuredClone(sample);updated.title='Updated tomato pasta';await upload(page,updated);await expect(page.getByText('This recipe ID is already saved.',{exact:false})).toBeVisible();await click(page,'save-replace');await expect(page.getByRole('heading',{name:'Updated tomato pasta'})).toBeVisible();await click(page,'start');await expect(page.locator('.cooking-top h1')).toHaveText('Simple tomato pasta');await click(page,'library');await expect(page.locator('.recipe-card')).toContainText('Updated tomato pasta');await upload(page,updated);await click(page,'save-copy');await expect(page.getByRole('button',{name:'Resume current meal'})).toBeVisible();await click(page,'library');await expect(page.locator('.recipe-card')).toHaveCount(2);
});

test('bad packages remain unsaved; real PNGs persist and display with provenance',async({page})=>{
  await page.goto('/');const invalid=structuredClone(sample);invalid.steps[0].suggestedComponentIds=['does-not-exist'];await upload(page,invalid);await expect(page.locator('.validation-errors')).toContainText('suggestedComponentIds[0]');await click(page,'close-modal');await expect(page.locator('.recipe-card')).toHaveCount(0);
  const r=structuredClone(sample);r.images=[{id:'step-photo',path:'images/step.png',alt:'Test package illustration',kind:'illustration',origin:'ai_generated'}];r.steps[2].imageIds=['step-photo'];
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX9sAAAAASUVORK5CYII=','base64');
  await page.locator('#file-input').setInputFiles({name:'meal.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'recipe.json':strToU8(JSON.stringify(r)),'images/step.png':png}))});
  await expect(page.getByText('AI-generated guidance')).toBeVisible();await click(page,'save-import');await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeVisible();await page.reload();await page.locator('.card-click').click();await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();await expect(page.getByAltText('Test package illustration')).toBeVisible();expect(await page.getByAltText('Test package illustration').evaluate(el=>el.naturalWidth)).toBe(1);await page.reload();await click(page,'resume');await expect(page.getByAltText('Test package illustration')).toBeVisible();
});

test('phone, tablet and desktop layouts stay within their viewports',async({page})=>{
  await page.goto('/');for(const width of [390,768,1024,1440]){await page.setViewportSize({width,height:1000});await expect(page.getByRole('button',{name:'Try the example'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}
  await page.setViewportSize({width:1024,height:768});await page.screenshot({path:'artifacts/library-tablet.png',fullPage:true});await saveExample(page);await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  for(const width of [390,768,1024,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await expect(page.locator('.step-navigation')).toBeVisible();}
  await page.setViewportSize({width:390,height:844});await expect(page.locator('.mobile-timer-bar')).toBeVisible();await expect(page.locator('.mobile-timer-bar')).toContainText('1 timer running');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/cooking-phone.png',animations:'disabled',captureBeyondViewport:false});const strip=await page.locator('.mobile-timer-bar').boundingBox();expect(strip.y+strip.height).toBeLessThanOrEqual(844);await page.locator('.mobile-timer-bar').screenshot({path:'artifacts/mobile-timer-strip.png'});await click(page,'timer-drawer');await expect(page.getByRole('dialog')).toContainText('Tomato sauce');await page.getByRole('dialog').getByRole('button',{name:'Stop timer'}).click();await expect(page.getByRole('dialog')).toContainText('Stopped');await page.getByRole('dialog').getByRole('button',{name:'View step'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('AI guide and contract are readable HTML with working examples and copy prompt',async({page})=>{
  await page.goto('/guide/');await expect(page.getByRole('heading',{name:'Prepare a recipe for Cookstep'})).toBeVisible();await expect(page.getByRole('heading',{name:'Importer limits'})).toBeVisible();await page.getByRole('button',{name:'Copy preparation prompt'}).click();await expect(page.locator('#copy-status')).toContainText(/copied|Copy this text manually/);await page.getByRole('link',{name:'full format contract'}).click();await expect(page.getByRole('heading',{name:'Cookstep recipe package — format 0.2'})).toBeVisible();const response=await page.request.get('/guide/recipe.json');expect(response.ok()).toBe(true);expect((await response.json()).formatVersion).toBe('0.2');
});

test('component-only meal opens overview and never starts timers automatically',async({page})=>{
  const r=structuredClone(sample);r.steps=r.steps.filter(s=>s.componentId);await page.goto('/');await upload(page,r);await click(page,'save-import');await click(page,'start');await expect(page.getByRole('heading',{name:'Make room for the good stuff.'})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(0);await page.locator('.task-button[data-id="sauce"]').click();await expect(page.locator('.timer-card')).toHaveCount(0);await click(page,'next');await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('1 of 1');await page.locator('.task-button[data-id="pasta"]').click();await expect(page.getByRole('heading',{name:'Bring water to a boil'})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(0);
});
