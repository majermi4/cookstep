import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
const sample=JSON.parse(await readFile(new URL('../../examples/recipe.json',import.meta.url),'utf8'));
const click=async(page,action)=>{
  if(['library','finish'].includes(action)&&await page.locator('.cooking-page').count()&&!await page.getByRole('dialog').isVisible())await page.getByRole('button',{name:'Cooking options',exact:true}).click();
  return action==='library'?page.getByRole('button',{name:'My recipes',exact:true}).click():page.locator(`[data-action="${action}"]`).click();
};
const upload=(page,recipe)=>page.locator('#file-input').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
async function saveExample(page){await page.goto('/');await click(page,'example');await expect(page.getByText('Package validated.',{exact:false})).toBeVisible();await click(page,'save-import');await expect(page.getByRole('button',{name:'Start cooking',exact:true})).toBeVisible();}
async function cookingView(page,mode){await click(page,'cooking-menu');await page.getByLabel('Cooking view',{exact:true}).selectOption(mode);await expect(page.getByRole('dialog')).not.toBeVisible();}
const stepCard=(page,id)=>page.locator(`.current-step[data-step-id="${id}"]`);

test('fullscreen icon enters, exits and follows browser fullscreen changes',async({page})=>{
  await saveExample(page);await click(page,'start');
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole('button',{name:'Exit fullscreen',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('heading',{name:'Combine and serve'})).toBeVisible();
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
  await page.evaluate(()=>document.exitFullscreen());
  await expect(page.getByRole('button',{name:'Enter fullscreen',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('0 of 2');
  await expect(page.locator('.timer-card')).toHaveCount(0);
});

test('unavailable fullscreen gives feedback without disrupting cooking',async({page})=>{
  await saveExample(page);await click(page,'start');
  await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('Blocked'));});
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('Fullscreen isn’t available here');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enter fullscreen',exact:true})).toHaveAttribute('aria-pressed','false');
});

test('all steps scroll preserves timers, independent completion and the selected step',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await saveExample(page);await click(page,'start');await cookingView(page,'all');
  await expect(page.locator('.current-step')).toHaveCount(sample.steps.length);
  await expect(page.locator('.current-step h2')).toHaveText(['Prepare sauce and pasta','Combine and serve','Simmer the sauce','Bring water to a boil','Cook the pasta']);
  await expect(page.locator('.timer-card')).toHaveCount(0);
  await stepCard(page,'simmer-sauce').getByRole('button',{name:'Sauce is simmering',exact:false}).click();
  await stepCard(page,'cook-pasta').getByRole('button',{name:'Pasta is in the water',exact:false}).click();
  await expect(page.locator('.timer-card')).toHaveCount(2);
  const timers=await page.evaluate(async()=>{const {read}=await import('/storage.js');return (await read('sessions','active')).timers.map(t=>({task:t.task,step:t.stepId}));});
  expect(timers).toEqual([{task:'sauce',step:'simmer-sauce'},{task:'pasta',step:'cook-pasta'}]);
  await stepCard(page,'cook-pasta').getByRole('button',{name:'Mark step done',exact:true}).click();
  await expect(page.locator('.task-button[data-id="pasta"]')).toContainText('1 of 2');
  await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('0 of 1');
  await page.reload();await click(page,'resume');await expect(page.locator('.current-step')).toHaveCount(5);
  await expect(stepCard(page,'cook-pasta').getByRole('button',{name:'Step complete',exact:true})).toBeDisabled();
  await page.locator('.task-button[data-id="pasta"]').click();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async()=>{const rect=await stepCard(page,'boil-water').boundingBox();return rect.y;}).toBeGreaterThanOrEqual(70);
  await page.locator('.timer-card').first().getByRole('button',{name:'View step',exact:true}).click();
  await expect.poll(async()=>{const rect=await stepCard(page,'simmer-sauce').boundingBox();return rect.y;}).toBeLessThan(200);
  await cookingView(page,'steps');await expect(page.locator('.current-step')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();
  await expect(page.locator('.timer-card')).toHaveCount(2);expect(errors).toEqual([]);
});

test('large ingredient checkboxes persist per step across tasks, views and reloads',async({page})=>{
  const recipe=structuredClone(sample);recipe.steps.at(-1).ingredientUses=[{ingredientId:'tomatoes',quantity:{text:'100 g',value:100,unit:'g'}}];
  await page.goto('/');await upload(page,recipe);await click(page,'save-import');
  await page.locator('#target').fill('4');await page.locator('#target').press('Tab');await page.locator('#units').selectOption('metric');await click(page,'start');
  await page.locator('.task-button[data-id="sauce"]').click();
  const tomatoes=page.getByRole('checkbox',{name:'Chopped tomatoes prepared',exact:true}),oil=page.getByRole('checkbox',{name:'Olive oil prepared',exact:true});
  await expect(page.locator('.step-ingredient-box')).toContainText('800 g');
  await page.getByText('Chopped tomatoes',{exact:true}).click();await expect(tomatoes).toBeChecked();
  await oil.focus();await page.keyboard.press('Space');await expect(oil).toBeChecked();
  const size=await tomatoes.boundingBox();expect(size.width).toBeGreaterThanOrEqual(32);expect(size.height).toBeGreaterThanOrEqual(32);
  await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('0 of 1');await expect(page.locator('.timer-card')).toHaveCount(0);
  await page.locator('.task-button[data-id="main"]').click();await click(page,'forward');await expect(tomatoes).not.toBeChecked();
  await cookingView(page,'all');
  await expect(stepCard(page,'simmer-sauce').getByRole('checkbox',{name:'Chopped tomatoes prepared'})).toBeChecked();
  await expect(stepCard(page,'combine').getByRole('checkbox',{name:'Chopped tomatoes prepared'})).not.toBeChecked();
  await stepCard(page,'combine').getByRole('checkbox',{name:'Chopped tomatoes prepared'}).check();
  const sauceOil=stepCard(page,'simmer-sauce').getByRole('checkbox',{name:'Olive oil prepared'});await sauceOil.uncheck();
  await expect.poll(()=>page.evaluate(async()=>{const {read}=await import('/storage.js');return (await read('sessions','active')).preparedIngredients.includes(JSON.stringify(['simmer-sauce',0]));})).toBe(false);
  await page.reload();await click(page,'resume');await expect(page.locator('.current-step')).toHaveCount(5);
  await expect(stepCard(page,'simmer-sauce').getByRole('checkbox',{name:'Chopped tomatoes prepared'})).toBeChecked();
  await expect(sauceOil).not.toBeChecked();await expect(stepCard(page,'combine').getByRole('checkbox',{name:'Chopped tomatoes prepared'})).toBeChecked();
  for(const width of [390,768,1024,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}
  await page.setViewportSize({width:390,height:844});await page.reload();await click(page,'resume');await page.locator('.task-button[data-id="sauce"]').click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'artifacts/cooking-checklist-phone.png',animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});await page.reload();await click(page,'resume');
  await page.evaluate(()=>{window.scrollTo(0,0);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  await page.screenshot({path:'artifacts/cooking-all-steps.png',fullPage:true,animations:'disabled'});
  await cookingView(page,'steps');await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();await expect(tomatoes).toBeChecked();
});

test('existing sessions without view or ingredient fields still resume normally',async({page})=>{
  await saveExample(page);await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();
  await page.evaluate(async()=>{const {read,write}=await import('/storage.js');const s=await read('sessions','active');delete s.cookingView;delete s.preparedIngredients;await write('sessions',s);});
  await page.reload();await click(page,'resume');await expect(page.locator('.current-step')).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Olive oil prepared'}).check();await cookingView(page,'all');
  await expect(stepCard(page,'simmer-sauce').getByRole('checkbox',{name:'Olive oil prepared'})).toBeChecked();
});

test('compact cooking header keeps instructions near the top and options remain usable',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await saveExample(page);await click(page,'start');
  await expect(page.locator('.header')).toHaveCount(0);
  await expect(page.locator('.cooking-page .session-meta')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Finish cooking',exact:true})).toHaveCount(0);
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:844});
    const header=await page.locator('.cooking-top').boundingBox(),step=await page.locator('.current-step').boundingBox(),instruction=await page.locator('.instruction').boundingBox();
    expect(header.height).toBeLessThanOrEqual(48);expect(step.y).toBeLessThan(200);expect(instruction.y).toBeLessThan(400);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/cooking-minimal-phone.png',animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});await page.reload();await click(page,'resume');await expect(page.locator('.cooking-top')).toHaveCount(1);await page.screenshot({path:'artifacts/cooking-minimal-desktop.png',fullPage:true});
  await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  await click(page,'cooking-menu');
  await expect(page.getByRole('dialog')).toContainText('2 servings · As written');
  await expect(page.locator('#wake-status')).toBeVisible();await expect(page.locator('.sound-status')).toBeVisible();
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();
  await click(page,'sound');await expect(page.getByRole('dialog')).toBeVisible();
  await click(page,'session-overview');await expect(page.getByRole('dialog')).toContainText('Quantities are locked');
  await click(page,'close-modal');await click(page,'finish');
  await expect(page.getByRole('dialog')).toContainText('1 timer is still running');
  await page.getByRole('button',{name:'Keep cooking',exact:true}).click();
  await click(page,'library');await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.header')).toBeVisible();await click(page,'resume');
  await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();
  await expect(page.locator('.timer-card')).toHaveCount(1);
  await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('0 of 1');
  expect(errors).toEqual([]);
});

test('browsing ahead preserves completion, task positions and saved progress',async({page})=>{
  await saveExample(page);await click(page,'start');
  await expect(page.getByRole('button',{name:'Previous',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Combine and serve'})).toBeVisible();
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('0 of 2');
  await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Mark step done',exact:true}).click();
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('1 of 2');
  await expect(page.locator('#toast')).not.toContainText('Main guide complete');
  await click(page,'previous');await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.locator('.task-button[data-id="pasta"]').click();await click(page,'forward');
  await page.locator('.task-button[data-id="main"]').click();
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.reload();await click(page,'resume');
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('1 of 2');
  await page.locator('.task-button[data-id="pasta"]').click();
  await expect(page.getByRole('heading',{name:'Cook the pasta',exact:true})).toBeVisible();
  await expect(page.locator('.task-button[data-id="pasta"]')).toContainText('0 of 2');
  await expect(page.locator('.timer-card')).toHaveCount(0);
});

test('keyboard arrows browse without completion and leave typing and dialogs alone',async({page})=>{
  await saveExample(page);await click(page,'start');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading',{name:'Combine and serve'})).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.step-top .pill')).toHaveText('STEP 2 / 2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.locator('.timer-panel-heading').click();
  await page.locator('#batch-name').fill('Batch 1');await page.locator('#batch-name').press('ArrowRight');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await click(page,'manual');await page.getByLabel('What’s cooking?').fill('Pan');
  await page.getByLabel('What’s cooking?').press('ArrowRight');
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('0 of 2');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading',{name:'Combine and serve'})).toBeVisible();
  await expect(page.locator('.task-button[data-id="main"]')).toContainText('0 of 2');
  await expect(page.locator('.timer-card')).toHaveCount(0);
});

test('idle timers collapse, remain accessible and expand automatically for active timers',async({page})=>{
  await saveExample(page);await click(page,'start');
  const panel=page.locator('.timer-panel'),heading=page.locator('.timer-panel-heading');
  await expect(panel).not.toHaveAttribute('open','');
  await expect(heading).toBeVisible();await expect(page.locator('#batch-name')).not.toBeVisible();
  await heading.click();await expect(page.locator('#batch-name')).toBeVisible();
  await click(page,'forward');await expect(page.locator('#batch-name')).toBeVisible();
  await heading.click();await expect(page.locator('#batch-name')).not.toBeVisible();
  await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  await expect(panel).toHaveAttribute('open','');await expect(page.locator('.timer-card')).toBeVisible();
  await click(page,'stop-timer');await expect(panel).not.toHaveAttribute('open','');
  await heading.click();await expect(page.locator('.timer-card')).toContainText('Stopped');
  await click(page,'dismiss-timer');await expect(page.locator('.timer-card')).toHaveCount(0);
  await heading.click();await expect(panel).not.toHaveAttribute('open','');
  await page.setViewportSize({width:390,height:844});
  await expect(heading).toBeVisible();await click(page,'timer-drawer');
  await page.getByRole('dialog').getByRole('button',{name:'Add a timer',exact:true}).click();
  await page.getByLabel('What’s cooking?').fill('Pan');await page.getByRole('button',{name:'Start timer now'}).click();
  await expect(panel).toHaveAttribute('open','');await expect(page.locator('.mobile-timer-bar')).toContainText('1 timer running');
});

test('complete example import, scaling, task progress and timestamp recovery',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await saveExample(page);await page.locator('#target').fill('3');await page.locator('#target').press('Tab');await page.locator('#units').selectOption('metric');
  await expect(page.getByText('300 g',{exact:true}).first()).toBeVisible();await expect(page.getByText('22.18 ml',{exact:true}).first()).toBeVisible();
  await click(page,'start');await expect(page.getByRole('heading',{name:'Prepare sauce and pasta'})).toBeVisible();
  await page.locator('.task-button[data-id="sauce"]').click();await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();await expect(page.locator('.step-ingredient-box')).toContainText('600 g');
  await page.locator('.timer-panel-heading').click();await page.locator('#batch-name').fill('Batch 1');await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(1);await page.locator('#batch-name').fill('Batch 2');await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(2);
  await page.locator('.task-button[data-id="pasta"]').click();await click(page,'next');await expect(page.getByRole('heading',{name:'Cook the pasta',exact:true})).toBeVisible();await click(page,'start-timer');await expect(page.locator('.timer-card')).toHaveCount(3);
  await page.reload();await expect(page.getByText('Your kitchen is still open')).toBeVisible();await click(page,'resume');await expect(page.getByRole('heading',{name:'Cook the pasta',exact:true})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(3);await expect(page.locator('.task-button[data-id="pasta"]')).toContainText('1 of 2');
  await page.locator('.timer-card').first().getByRole('button',{name:'View step'}).click();await expect(page.getByRole('heading',{name:'Simmer the sauce'})).toBeVisible();
  await page.screenshot({path:'artifacts/cooking-desktop.png',fullPage:true});
  await click(page,'finish');await expect(page.getByRole('dialog')).toContainText('3 timers are still running');await click(page,'confirm-finish');await expect(page.getByRole('heading',{name:'Your recipes'})).toBeVisible();await page.reload();await expect(page.getByText('Your kitchen is still open')).toHaveCount(0);expect(errors).toEqual([]);
});

test('countdown expires visibly without completing a step and can be acknowledged',async({page})=>{
  const r=structuredClone(sample);r.steps[2].timers[0].durationSeconds=2;await page.goto('/');await upload(page,r);await click(page,'save-import');await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  await expect(page.locator('.expiry-alert')).toContainText('Time to check Tomato sauce',{timeout:5000});await expect(page.locator('.timer-card')).toHaveClass(/expired/);await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('0 of 1');
  await page.locator('.expiry-alert').getByRole('button',{name:'I’ve checked · stop'}).click();await expect(page.locator('.expiry-alert')).toHaveCount(0);await expect(page.locator('.timer-panel')).not.toHaveAttribute('open','');await page.locator('.timer-panel-heading').click();await expect(page.locator('.timer-card')).toContainText('Stopped');
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
  const r=structuredClone(sample);r.steps=r.steps.filter(s=>s.componentId);await page.goto('/');await upload(page,r);await click(page,'save-import');await click(page,'start');await expect(page.getByRole('heading',{name:'Make room for the good stuff.'})).toBeVisible();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await expect(page.getByRole('heading',{name:'Make room for the good stuff.'})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(0);await page.locator('.task-button[data-id="sauce"]').click();await expect(page.locator('.timer-card')).toHaveCount(0);await click(page,'next');await expect(page.locator('.task-button[data-id="sauce"]')).toContainText('1 of 1');await page.locator('.task-button[data-id="pasta"]').click();await expect(page.getByRole('heading',{name:'Bring water to a boil'})).toBeVisible();await expect(page.locator('.timer-card')).toHaveCount(0);
});
