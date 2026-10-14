import './local-library-fixture.mjs';
import {test,expect} from '@playwright/test';
import {THEMES} from '../../src/themes.js';
const click=(page,action)=>{
  const names={library:'My recipes',resume:'Resume cooking','close-modal':'Done'};
  return names[action]?page.getByRole('button',{name:names[action],exact:true}).click():page.locator(`[data-action="${action}"]`).click();
};
async function saveExample(page){await page.goto('/');await click(page,'example');await click(page,'save-import');}
async function choose(page,id,cooking=false){
  if(cooking)await click(page,'cooking-menu');
  await click(page,'theme-settings');
  await page.locator(`input[name="theme"][value="${id}"]`).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme',id);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',THEMES.find(t=>t.id===id).tokens.colors.background);
  await click(page,'close-modal');
}
const savedSession=page=>page.evaluate(async()=>{const {read}=await import('/storage.js');return read('sessions','active');});
test('themes remain selected across navigation and reload, and keyboard selection works',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Theme',exact:true}).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await page.getByRole('radio',{name:/Editorial Cookbook/}).focus();await page.keyboard.press('ArrowDown');
  await expect(page.locator('html')).toHaveAttribute('data-theme','kitchen-appliance');
  await expect(page.locator('#theme-persistence')).toContainText('saved on this device');
  await page.keyboard.press('Escape');await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','kitchen-appliance');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content',THEMES[1].tokens.colors.background);
  await click(page,'example');await expect(page.locator('html')).toHaveAttribute('data-theme','kitchen-appliance');
  await click(page,'save-import');await click(page,'library');
  await expect(page.locator('.recipe-card')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme','kitchen-appliance');
});
test('live switches retain the same cooking DOM, recipe snapshot, completion, batches and timer timestamps',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await saveExample(page);await page.locator('#target').fill('4');await page.locator('#target').press('Tab');
  await expect(page.locator('#units')).toHaveCount(0);await click(page,'start');
  await click(page,'next');await page.locator('.task-button[data-id="sauce"]').click();
  await page.getByRole('checkbox',{name:'Chopped tomatoes prepared'}).check();
  await page.locator('.timer-panel-heading').click();await page.locator('#batch-name').fill('First pan');await click(page,'start-timer');
  await page.locator('#batch-name').fill('Second pan');await click(page,'start-timer');
  // Cover running, expired and stopped timers in the same session.
  await page.evaluate(async()=>{const {read,write}=await import('/storage.js');const s=await read('sessions','active');s.timers[0].startedAt=Date.now()-700000;s.timers[1].stoppedAt=Date.now();await write('sessions',s);});
  await page.reload();await click(page,'resume');
  await page.evaluate(()=>{window.retainedStep=document.querySelector('.current-step');});
  const before=await savedSession(page);
  for(const theme of THEMES){
    await choose(page,theme.id,true);
    expect(await savedSession(page)).toEqual(before);
    expect(await page.evaluate(()=>window.retainedStep===document.querySelector('.current-step'))).toBe(true);
    await expect(page.getByRole('checkbox',{name:'Chopped tomatoes prepared'})).toBeChecked();
    await expect(page.locator('.timer-card.expired')).toHaveCount(1);
    await expect(page.locator('.timer-card.stopped')).toHaveCount(1);
    await expect(page.locator('.timer-card').first()).toContainText('overdue');
    await expect(page.locator('.timer-card').first()).toContainText('First pan');
  }
  await page.reload();await click(page,'resume');expect(await savedSession(page)).toEqual(before);expect(errors).toEqual([]);
});
test('themes preserve scrolling view, idle timer collapse and do not start timers',async({page})=>{
  await saveExample(page);await click(page,'start');await click(page,'cooking-menu');
  await page.getByLabel('Cooking view',{exact:true}).selectOption('all');
  for(const theme of THEMES){
    await choose(page,theme.id,true);
    await expect(page.locator('.current-step')).toHaveCount(5);
    await expect(page.locator('.timer-panel')).not.toHaveAttribute('open','');
    await expect(page.locator('.timer-card')).toHaveCount(0);
    expect((await savedSession(page)).cookingView).toBe('all');
  }
});
test('all four themes fit phone, portrait tablet, landscape tablet and desktop',async({page})=>{
  await saveExample(page);await click(page,'library');
  for(const theme of THEMES){
    await choose(page,theme.id);
    for(const size of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}]){
      await page.setViewportSize(size);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await page.locator('.card-click').click();await click(page,'start');
  await page.locator('.task-button[data-id="sauce"]').click();await click(page,'start-timer');
  for(const theme of THEMES){
    await choose(page,theme.id,true);
    for(const size of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}]){
      await page.setViewportSize(size);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator('.step-navigation')).toBeVisible();
      if(size.width===390)await expect(page.locator('.mobile-timer-bar')).toBeVisible();
      if(size.width===1440||size.width===390)await page.screenshot({path:`artifacts/theme-${theme.id}-${size.width}.png`,animations:'disabled',fullPage:true});
    }
  }
});
test('blocked storage still switches themes and reports that saving failed',async({page})=>{
  await page.goto('/');await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Denied','SecurityError');};});
  await click(page,'theme-settings');await page.getByRole('radio',{name:/Cozy Illustrated/}).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','cozy-illustrated');
  await expect(page.locator('#theme-persistence')).toContainText('could not be saved');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','editorial-cookbook');
  await page.evaluate(()=>localStorage.setItem('cookstep.theme','bogus'));await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','editorial-cookbook');
});
test('the prominent dial follows explicit starts, recovered timestamps, expiry and stopping',async({page})=>{
  await saveExample(page);await click(page,'start');await page.locator('.task-button[data-id="sauce"]').click();
  await expect(page.locator('.focus-status')).toHaveText('Ready to start');
  expect((await savedSession(page)).timers).toHaveLength(0);
  await click(page,'start-timer');await expect(page.locator('.focus-status')).toHaveText('Remaining');
  await page.evaluate(async()=>{const {read,write}=await import('/storage.js');const s=await read('sessions','active');s.timers[0].startedAt=Date.now()-300000;await write('sessions',s);});
  await page.reload();await click(page,'resume');await expect(page.locator('.focus-digits')).toContainText('04:');
  const progress=await page.locator('.step-clock').evaluate(el=>parseFloat(el.style.getPropertyValue('--timer-progress')));
  expect(progress).toBeGreaterThan(49);expect(progress).toBeLessThanOrEqual(50);
  const before=await savedSession(page);
  for(const theme of THEMES){await choose(page,theme.id,true);await expect(page.locator('.focus-status')).toHaveText('Remaining');expect(await savedSession(page)).toEqual(before);}
  await page.evaluate(async()=>{const {read,write}=await import('/storage.js');const s=await read('sessions','active');s.timers[0].startedAt=Date.now()-700000;await write('sessions',s);});
  await page.reload();await click(page,'resume');await expect(page.locator('.focus-status')).toHaveText('Overdue · check food');
  await page.locator('.timer-card [data-action="stop-timer"]').click();await expect(page.locator('.focus-status')).toHaveText('Stopped');
  expect((await savedSession(page)).completed).toEqual([]);
});
