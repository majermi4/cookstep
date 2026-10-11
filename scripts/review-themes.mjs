import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu','--disable-features=CDPScreenshotNewSurface']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.locator('#file-input').setInputFiles(process.argv[2] || 'artifacts/family-lunch-beef-quesadillas-20-corrected.cookstep.zip');
await page.locator('[data-action="save-import"]').click();
await page.locator('[data-action="start"]').click();await page.addStyleTag({content:'#toast{display:none!important}'});
const tasks=await page.locator('.task-button').evaluateAll(els=>els.map(el=>({id:el.dataset.id,text:el.textContent})));console.log(tasks);
await page.locator('.task-button[data-id="main"].active').waitFor();
const steps=await page.locator('.step-track button').evaluateAll(els=>els.map(el=>({index:el.dataset.index,text:el.getAttribute('aria-label')})));console.log(steps);
const index='2';
await page.locator(`.step-track [data-index="${index}"]`).click();await page.locator(`.step-track [data-index="${index}"].current`).waitFor();
await page.locator('[data-action="start-timer"]').first().click();
await mkdir('artifacts/themes-review',{recursive:true});
for(const id of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
  await page.locator('[data-action="cooking-menu"]').click();await page.locator('[data-action="theme-settings"]').click();await page.locator(`input[value="${id}"]`).check();await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const size of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:1440,height:1000}]){
    await page.setViewportSize(size);await page.reload();await page.getByRole('button',{name:'Resume cooking',exact:true}).click();await page.locator('.cooking-page').waitFor();await page.addStyleTag({content:'#toast{display:none!important}'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));
    const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,title:document.querySelector('.step-copy h2').getBoundingClientRect().toJSON(),copy:document.querySelector('.step-copy').getBoundingClientRect().toJSON(),media:document.querySelector('.step-media')?.getBoundingClientRect().toJSON(),support:document.querySelector('.step-support').getBoundingClientRect().toJSON(),clock:document.querySelector('.focus-digits')?.textContent}));
    const dock=await page.locator('.step-navigation').boundingBox();if(dock.y<0||dock.y+dock.height>size.height)throw new Error('Cooking controls outside viewport');console.log(id,size.width,'overflow:',geometry.overflow,'photo:',Boolean(geometry.media),'clock:',geometry.clock,'controls in view:',true);
    await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.screenshot({path:`artifacts/themes-review/${id}-${size.width}.png`,fullPage:false});
  }
}
await page.locator('[data-action="cooking-menu"]').click();await page.locator('[data-action="library"]').click();await page.locator('.library-page').waitFor();
for(const id of ['editorial-cookbook','kitchen-appliance','cozy-illustrated','recipe-studio']){
  await page.getByRole('button',{name:'Theme',exact:true}).click();await page.locator(`input[value="${id}"]`).check();await page.getByRole('button',{name:'Done',exact:true}).click();
  for(const width of [768,1024]){
    await page.setViewportSize({width,height:width===1024?768:1024});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`artifacts/themes-review/${id}-library-${width}.png`,animations:'disabled'});
    await page.locator('.card-click').click();await page.locator('.overview-page').waitFor();await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`artifacts/themes-review/${id}-overview-${width}.png`,animations:'disabled'});
    console.log(id,width,'overview photo decoded:',await page.locator('.overview-heading .cover img').evaluate(el=>el.naturalWidth>0),'overflow:',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    await page.locator('.back-link').click();await page.locator('.library-page').waitFor();
  }
}
console.log('Page errors:',errors);await browser.close();
