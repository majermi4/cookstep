import {formatQuantity,formatTemperature,number,taskSteps,createSession,startTimer,timerState,clockText,safeUrl} from './model.js';
import {read,write,changeRecipes} from './storage.js';
import {createLibrarySync} from './sync.js';
import {importRecipes,exportRecipes} from './recipe-archive.js';
import {THEMES,loadTheme,applyTheme,saveTheme} from './themes.js';

let activeTheme = applyTheme(loadTheme().id);

const app = document.querySelector('#app'), modal = document.querySelector('#modal');
const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  palette:'<circle cx="12" cy="12" r="9"/><path d="M13 21c-2-3 5-4 3-7-1-2-4 1-5-1s3-5 1-10"/><path d="M7 8h.01M6 13h.01M9 17h.01"/>',
  book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-3H4z"/><path d="M13 7a3 3 0 0 1 3-3h5v13h-4a4 4 0 0 0-4 3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', left:'<path d="m14 6-6 6 6 6"/>', chevron:'<path d="m9 6 6 6-6 6"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', minimize:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>', check:'<path d="m5 12 4 4L19 6"/>',
  pot:'<path d="M5 10h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM2 11h3m14 0h3M4 7h16M10 3h4"/>',
  leaf:'<path d="M20 4C7 2 2 9 6 16c8 5 15-1 14-12ZM5 21 15 10"/>', grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>', more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', sound:'<path d="m10 5-5 4H2v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  screen:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>', search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.pot}</svg>`;
const button = (label,action,attrs='',style='secondary',symbol='') => `<button class="btn ${style}" data-action="${action}" ${attrs}>${symbol ? icon(symbol) : ''}${label}</button>`;
let pendingLibrary=null;
let batchName = '', idleTimerPanelOpen = false, actionQueue = Promise.resolve();
let library = [], session = null, selected = null, view = 'library', search = '', target = 1, units = 'original', pending = null, importing = false;
let wakeLock = null, wakeStatus = 'Screen wake not active', audio = null, audioReady = false, storageError = '', sessionSaved = true, sessionSaveRevision = 0;
const sounded = new Set(), imageUrls = new WeakMap();
let syncStatus={state:'syncing',message:'Loading synced recipes…'};
const cloud=createLibrarySync({
  changed:async()=>{const next=await read('recipes');const differs=JSON.stringify(next.map(r=>[r.id,r.cloudRevision,r.savedAt]))!==JSON.stringify(library.map(r=>[r.id,r.cloudRevision,r.savedAt]));library=next;if(!differs)return;if(view==='overview'&&selected){const latest=library.find(r=>r.id===selected.id);if(latest)selected=latest;else{selected=null;view='library';}}if(view!=='cooking')render();},
  status:value=>{syncStatus=value;updateSyncStatus();},
  notice:message=>toast(message),
});
function syncLabel(){return syncStatus.state==='synced'?'Recipes synced':syncStatus.state==='syncing'?'Syncing recipes…':syncStatus.state==='signin'?'Sign in to sync':'Sync pending';}
function syncMenu(){return `<p class="sync-message" role="status">${esc(syncStatus.message)}</p>${syncStatus.detail?`<p class="sync-detail">${esc(syncStatus.detail)}</p>`:''}${syncStatus.state==='signin'?'<a class="btn secondary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>':button(syncStatus.state==='error'||syncStatus.state==='pending'?'Retry sync':'Sync now','sync-library','','secondary')}`;}
function syncControl(){return `<details class="sync-control" data-state="${esc(syncStatus.state)}"><summary class="local-badge" aria-label="Recipe sync status"><i></i><span class="sync-mobile-icon" aria-hidden="true">${icon('upload')}</span><span class="sync-label">${esc(syncLabel())}</span></summary><div class="sync-popover">${syncMenu()}</div></details>`;}
function updateSyncStatus(){
  const control=document.querySelector('.sync-control');if(!control)return;
  control.dataset.state=syncStatus.state;
  control.querySelector('.sync-label').textContent=syncLabel();
  const panel=control.querySelector('.sync-popover');
  // Keep the focused action mounted while sync status changes.
  const message=panel.querySelector('.sync-message');if(message)message.textContent=syncStatus.message;
  const detail=panel.querySelector('.sync-detail');if(detail)detail.remove();
  if(syncStatus.detail){const p=document.createElement('p');p.className='sync-detail';p.textContent=syncStatus.detail;panel.querySelector('.sync-message').after(p);}
  const action=panel.querySelector('.btn');
  if((syncStatus.state==='signin')!==Boolean(action?.matches('a')))panel.innerHTML=syncMenu();
  else if(action?.matches('button'))action.textContent=syncStatus.state==='error'||syncStatus.state==='pending'?'Retry sync':'Sync now';
}
const GUIDE_URL = 'https://cookstep-recipe-guide.alightslug4.chatgpt.site';
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('show'),4200); }
function storageFailure(e) { storageError = `Could not save on this device: ${e.message || 'storage unavailable'}. Free browser space and retry; keep this tab open until saved.`; render(); }
async function saveSession() { if (!session) return; const revision=++sessionSaveRevision;sessionSaved=false;try { await write('sessions',session); if(revision===sessionSaveRevision)sessionSaved = true; } catch(e) { sessionSaved = false; storageFailure(e); } }
function image(record,id,cover=false) {
  const im = record.recipe.images?.find(i => i.id === id), blob = record.assets?.[id];
  if (!im || !blob) return '';
  if (!imageUrls.has(blob)) imageUrls.set(blob,URL.createObjectURL(blob));
  return `<figure class="${cover ? 'cover' : 'step-image'}"><img src="${imageUrls.get(blob)}" alt="${esc(im.alt)}" ${cover ? 'loading="lazy"' : ''}></figure>`;
}
const illustration = (type='pasta') => `<div class="dish-art ${type}" aria-hidden="true"><span class="plate"><span class="noodle n1"></span><span class="noodle n2"></span><span class="noodle n3"></span><span class="tomato t1"></span><span class="tomato t2"></span><span class="basil b1"></span><span class="basil b2"></span></span><span class="fork"></span><span class="art-note">A little calm in the kitchen.</span></div>`;
const botanical = () => '<img class="botanical-art" src="./art/botanicals.svg" alt="" aria-hidden="true">';
const cozyArt = () => '<img class="cozy-art" src="./art/cozy-kitchen.png" alt="" aria-hidden="true">';
function thumbnail(record,step) {
  const id=step.imageIds?.find(id=>record.assets?.[id]);
  return id?image(record,id,true).replace(/alt="[^"]*"/,'alt=""'):`<span class="rail-placeholder">${icon('pot')}</span>`;
}
function stepRail(steps,position) {
  return `<nav class="step-track" aria-label="Recipe steps">${steps.map((step,index)=>`<button class="${index===position?'current':''} ${session.completed.includes(step.id)?'complete':''}" data-action="jump" data-index="${index}" aria-label="Step ${index+1}: ${esc(step.title)}${session.completed.includes(step.id)?' (completed)':''}" aria-current="${index===position?'step':'false'}"><span class="rail-number">${index+1}${session.completed.includes(step.id)?`<span class="rail-check" aria-hidden="true">${icon('check')}</span>`:''}</span><span class="rail-image" aria-hidden="true">${thumbnail(session.record,step)}</span><span class="rail-copy">${esc(step.title)}</span></button>`).join('')}</nav>`;
}
function focusClock(step) {
  const template=step.timers?.[0];
  if(!template)return '';
  return `<div class="step-clock" data-focus-step="${esc(step.id)}"><div class="focus-dial"><small class="focus-title">${template.mode==='elapsed'?'TRACK TIME':'COOK FOR'}</small><strong class="focus-digits">${template.mode==='elapsed'?'0:00':clockText(template.durationSeconds)}</strong><span class="focus-status">Ready to start</span></div><p class="focus-label">${esc(template.label)}</p></div>`;
}
function header() {
  return `<header class="header"><button class="brand" data-action="library" aria-label="Cookstep home"><span class="brand-icon">${icon('pot')}</span>cookstep<span class="brand-dot">.</span></button><nav aria-label="Main navigation"><button class="nav-link ${view === 'library' ? 'selected' : ''}" data-action="library">${icon('book')}<span>My recipes</span></button><button class="nav-link" data-action="chatgpt">${icon('leaf')}<span>ChatGPT</span></button><button class="nav-link theme-setting" data-action="theme-settings" aria-label="Theme" aria-haspopup="dialog">${icon('palette')}<span>Theme</span></button></nav>${syncControl()}</header>`;
}
function themeSettings() {
  showModal(`<div class="theme-dialog"><h2>Theme</h2><p class="muted">Choose the feel of your kitchen.</p><fieldset class="theme-options"><legend>Appearance</legend>${THEMES.map(theme=>`<label class="theme-choice"><input type="radio" name="theme" value="${theme.id}" ${activeTheme.id===theme.id?'checked':''}><span class="theme-swatch" data-theme="${theme.id}" aria-hidden="true"></span><span><strong>${theme.name}</strong><small>${theme.description}</small></span></label>`).join('')}</fieldset><p class="theme-persistence" id="theme-persistence" role="status">Saved on this device. You can change it while cooking.</p>${button('Done','close-modal','','primary full')}</div>`);
}
function yieldLabel(recipe) { return `${number(recipe.yield.quantity)} ${esc(recipe.yield.unit)}`; }
function recipeCard(record) {
  const r = record.recipe;
  return `<article class="recipe-card"><button class="card-click" data-action="overview" data-id="${esc(record.id)}" aria-label="Open ${esc(r.title)}">${r.coverImageId ? image(record,r.coverImageId,true) : `<div class="card-art">${illustration()}</div>`}<div class="card-content"><div class="eyebrow">${r.components?.length ? 'A whole meal' : 'From your kitchen'}</div><h3>${esc(r.title)}</h3><p>${esc(r.description || 'Your ingredients. Your pace.')}</p><div class="card-meta"><span>${icon('pot')} ${yieldLabel(r)}</span><span>${r.steps.length} steps</span><span class="card-arrow">${icon('arrow')}</span></div></div></button><button class="delete-recipe" data-action="delete" data-id="${esc(record.id)}" aria-label="Remove ${esc(r.title)}">${icon('trash')}</button></article>`;
}
function libraryScreen() {
  const heroRecipe = library.find(record=>record.recipe.coverImageId&&record.assets?.[record.recipe.coverImageId]);
  const filtered = library.filter(r => r.recipe.title.toLowerCase().includes(search.toLowerCase()));
  return `<main class="library-page"><section class="page-heading"><div><div class="eyebrow">YOUR PERSONAL RECIPE BOOK</div><h1>Good food.<br><span>A clearer head.</span></h1><p>Keep your recipes together. Take cooking one step at a time.</p></div><div class="library-art">${heroRecipe?`<div class="library-photo">${image(heroRecipe,heroRecipe.recipe.coverImageId,true)}</div>`:''}${botanical()}${cozyArt()}</div></section>
  ${session ? `<section class="resume-banner"><span class="resume-icon">${icon('pot')}</span><div><strong>Your kitchen is still open</strong><p>${esc(session.record.recipe.title)} · ${session.timers.filter(t => !t.stoppedAt).length} active timers</p></div>${button('Resume cooking','resume','','dark','arrow')}</section>` : ''}
  <div class="section-heading"><div class="library-heading"><h2>Your recipes <span class="count">${library.length}</span></h2>${button('','library-options','aria-label="Recipe library options" aria-haspopup="dialog"','quiet-options','more')}</div>${library.length ? `<label class="search">${icon('search')}<input id="search" type="search" placeholder="Find a recipe…" value="${esc(search)}" aria-label="Find a recipe"></label>` : ''}</div>
  ${library.length ? `<section class="recipe-grid">${filtered.length ? filtered.map(recipeCard).join('') : '<p class="muted">No recipes match your search.</p>'}</section>` : `<section class="empty-library"><div class="empty-copy"><span class="pill">A place for your favourites</span><h2>Your next good meal<br>starts here.</h2><p>Bring a recipe you love. We’ll keep the ingredients, steps and timers within easy reach.</p><div class="button-row">${button('Add with ChatGPT','chatgpt','','primary','leaf')}${button('Try the example','example','','secondary','arrow')}</div><small>Have a recipe link or photo? <a href="${GUIDE_URL}/" target="_blank">Let your AI prepare it ${icon('arrow')}</a></small></div>${illustration()}<div class="empty-theme-art">${botanical()}${cozyArt()}</div></section>`}
  <section class="how-it-works"><div><span class="mini-icon">${icon('upload')}</span><h3>Bring your own recipes</h3><p>Ask ChatGPT to add or update recipes directly.</p></div><div><span class="mini-icon">${icon('grid')}</span><h3>One meal, a few moving parts</h3><p>Switch between the main dish and sides. Each remembers your place.</p></div><div><span class="mini-icon">${icon('clock')}</span><h3>A timer for every pan</h3><p>Start when you’re ready. Keep every cooking time in sight.</p></div></section><footer><span>Made for a quieter kind of cooking.</span><a href="${GUIDE_URL}/">Recipe preparation guide ${icon('arrow')}</a></footer></main>`;
}
function quantityHtml(q,factor,system) { const result = formatQuantity(q,factor,system); return `<strong>${esc(result.text)}</strong>${result.note ? `<small class="quantity-note">${esc(result.note)}</small>` : ''}`; }
function ingredientsHtml(record,factor,system) {
  const r = record.recipe;
  const groups = [{id:undefined,title:r.components?.length ? 'Main guide & shared ingredients' : 'Ingredients'},...(r.components || [])];
  return groups.map(g => { const ingredients = r.ingredients.filter(i => i.componentId === g.id); return ingredients.length ? `<div class="ingredient-group"><h3>${esc(g.title)}</h3>${ingredients.map(i => `<div class="ingredient-row"><div>${esc(i.name)}${i.optional ? ' <span class="optional">optional</span>' : ''}${i.notes ? `<small>${esc(i.notes)}</small>` : ''}</div><div class="amount">${quantityHtml(i.quantity,factor,system)}</div></div>`).join('')}</div>` : ''; }).join('') || '<p class="muted">No ingredients specified in this package.</p>';
}
function sourceHtml(r) {
  return (r.sources || []).map(s => `<div class="source"><strong>${s.url && safeUrl(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>` : esc(s.title)}</strong>${s.author ? `<p>${esc(s.author)}</p>` : ''}${s.originalText ? `<details><summary>Original source text</summary><p class="pre-wrap">${esc(s.originalText)}</p></details>` : ''}</div>`).join('');
}
function stepPreview(record,step,factor,system,index) {
  const r = record.recipe;
  return `<article class="preview-step"><span class="step-number">${index+1}</span><div><h3>${esc(step.title)}</h3><p class="pre-wrap">${esc(step.instruction)}</p>${step.temperature ? `<span class="pill">${formatTemperature(step.temperature,system)}</span>` : ''}${step.ingredientUses?.length ? `<ul class="step-ingredients">${step.ingredientUses.map(u => `<li>${esc(r.ingredients.find(i => i.id === u.ingredientId)?.name)} <span>${u.quantity ? quantityHtml(u.quantity,factor,system) : '<small>Amount not specified for this step</small>'}</span></li>`).join('')}</ul>` : ''}${(step.timers || []).map(t => `<span class="timer-chip">${icon('clock')}${esc(t.label)} · ${t.mode === 'elapsed' ? 'Elapsed tracking' : clockText(t.durationSeconds)} · Start: ${esc(t.startLabel)}</span>`).join('')}${(step.imageIds || []).map(id => image(record,id)).join('')}${step.sourceIds?.length ? `<small class="muted">Sources: ${step.sourceIds.map(id => esc(r.sources.find(s => s.id === id)?.title)).join(', ')}</small>` : ''}${step.suggestedComponentIds?.length ? `<small class="muted">Suggested tasks: ${step.suggestedComponentIds.map(id => esc(r.components.find(c => c.id === id)?.title)).join(', ')}</small>` : ''}</div></article>`;
}
function stepsHtml(record,factor,system) {
  const groups = [{id:'main',title:'Main guide'},...(record.recipe.components || [])];
  return groups.map(g => { const steps = taskSteps(record.recipe,g.id); return steps.length ? `<section><h3 class="task-heading">${esc(g.title)} <span>${steps.length} steps</span></h3>${steps.map((s,i) => stepPreview(record,s,factor,system,i)).join('')}</section>` : ''; }).join('');
}
function overviewScreen(record,isImport=false) {
  const r = record.recipe, factor = isImport ? 1 : target/r.yield.quantity, system = isImport ? 'original' : units;
  return `<main class="overview-page"><div class="overview-toolbar"><button class="back-link" data-action="library">${icon('left')} Back to recipes</button>${!isImport?button('','recipe-options','aria-label="Recipe options" aria-haspopup="dialog"','quiet-options','more'):''}</div><div class="overview-heading ${r.coverImageId&&record.assets?.[r.coverImageId]?'has-cover':''}"><div class="overview-title"><div class="eyebrow">${isImport ? 'IMPORT PREVIEW · FORMAT 0.2' : 'LET’S GET EVERYTHING READY'}</div><h1>${esc(r.title)}</h1><p>${esc(r.description || 'A good meal starts with a little preparation.')}</p><div class="overview-facts">${icon('pot')} ${yieldLabel(r)} <span>·</span> ${r.steps.length} steps</div></div>${r.coverImageId?image(record,r.coverImageId,true):''}${botanical()}${cozyArt()}</div>
  ${isImport ? '<div class="notice">Package validated. Review the ingredients, steps, images and timer suggestions before saving.</div>' : ''}
  <div class="overview-grid"><div><section class="panel"><div class="section-heading"><h2>On the counter</h2><span class="pill">${r.ingredients.length} ingredients</span></div>${ingredientsHtml(record,factor,system)}</section><details class="panel steps-details" ${isImport ? 'open' : ''}><summary>Read through the steps <span>${r.steps.length} steps ${icon('chevron')}</span></summary>${stepsHtml(record,factor,system)}</details>${r.notes?.length ? `<section class="panel notes"><h2>Recipe notes</h2>${r.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</section>` : ''}${r.sources?.length ? `<details class="panel"><summary>Sources & original text</summary>${sourceHtml(r)}</details>` : ''}</div>
  <aside class="prep-sidebar"><section class="panel yield-panel"><h2>${isImport ? 'Recipe yield' : 'Make it your own'}</h2>${isImport ? `<p class="yield-value">${yieldLabel(r)}</p>` : `<label class="field-label" for="target">How many ${esc(r.yield.unit)}?</label><div class="yield-control">${button('−','yield-minus','aria-label="Decrease yield"','icon-button')}<input id="target" type="number" min="0.01" max="100000" step="any" value="${target}" inputmode="decimal">${button('+','yield-plus','aria-label="Increase yield"','icon-button')}</div><p class="muted small">Original recipe: ${yieldLabel(r)}${r.servings && r.yield.unit !== 'servings' ? ` · ${r.servings} people` : ''}</p><label class="field-label" for="units">Display measurements</label><select id="units"><option value="original" ${units==='original'?'selected':''}>As written</option><option value="metric" ${units==='metric'?'selected':''}>Metric</option><option value="imperial" ${units==='imperial'?'selected':''}>Imperial (US volume)</option></select><p class="muted small">Amounts scale. Cooking times stay the same.<br>Keep batch sizes and doneness cues in mind.</p>`}
  ${isImport ? `<div class="button-stack">${library.some(x=>x.id===record.id) ? `<p class="notice">This recipe ID is already saved. Choose how to save it.</p>${button('Replace saved recipe','save-replace','','primary','check')}${button('Save a separate copy','save-copy')}` : button('Save to my recipes','save-import','','primary','check')}${button('Cancel import','cancel-import')}</div>` : button(session ? 'Resume current meal' : 'Start cooking','start','','primary full','arrow')+`<div class="button-stack">${button('Edit with ChatGPT','chatgpt','','secondary','leaf')}</div>`}${session && !isImport ? '<p class="muted small">Finish the current session to start another meal.</p>' : ''}</section>
  ${r.equipment?.length ? `<section class="panel"><h2>You’ll need</h2><ul class="equipment">${r.equipment.map(e=>`<li>${icon('check')}${esc(e)}</li>`).join('')}</ul></section>` : ''}
  ${r.components?.length ? `<section class="panel"><h2>Parts of the meal</h2><p class="muted small">Open each task when it suits you.</p>${r.components.map(c=>`<div class="component-preview">${icon('pot')}<div><strong>${esc(c.title)}</strong>${c.description?`<small>${esc(c.description)}</small>`:''}<small>${taskSteps(r,c.id).length} steps</small></div></div>`).join('')}</section>` : ''}</aside></div></main>`;
}
function taskTitle(id) { return id === 'main' ? 'Main guide' : session.record.recipe.components?.find(c=>c.id===id)?.title || 'Task'; }
function taskSwitcher() {
  const r = session.record.recipe;
  return `<nav class="tasks panel" aria-label="Cooking tasks">${[{id:'main',title:'Main guide'},...(r.components||[])].map(c=>{
    const steps = taskSteps(r,c.id), completed = steps.filter(s=>session.completed.includes(s.id)).length;
    return `<button class="task-button ${session.activeTask===c.id?'active':''}" data-action="task" data-id="${esc(c.id)}"><span class="task-icon">${icon(completed===steps.length && steps.length?'check':c.id==='main'?'book':'pot')}</span><span><strong>${esc(c.title)}</strong><small>${steps.length ? `${completed} of ${steps.length} steps done` : 'Meal overview'}</small><span class="task-progress"><i style="width:${steps.length?completed/steps.length*100:0}%"></i></span></span>${icon('chevron')}</button>`;
  }).join('')}</nav>`;
}
function timerCards() {
  return session.timers.length ? session.timers.map(t=>{
    const state=timerState(t), running=!t.stoppedAt;
    return `<article class="timer-card ${state.expired && running?'expired':''} ${!running?'stopped':''}" data-timer="${t.instanceId}"><div class="timer-card-heading"><strong>${esc(t.label)}</strong><span>${t.batch?esc(t.batch):t.mode==='elapsed'?'Elapsed':'Countdown'}</span></div><p class="timer-context">${esc(taskTitle(t.task))}${t.stepId ? ` · ${esc(session.record.recipe.steps.find(s=>s.id===t.stepId)?.title || "")}` : ""}</p><div class="timer-face"><div class="timer-digits" data-digits="${t.instanceId}">${clockText(state.remaining===null?state.elapsed:Math.abs(state.remaining))}</div></div><p class="timer-sub" data-sub="${t.instanceId}">${timerSubtitle(t,state)}</p><div class="timer-actions">${button('View step','timer-jump',`data-id="${t.instanceId}"`,'text-button')}${running?button(state.expired?'Checked · stop':'Stop timer','stop-timer',`data-id="${t.instanceId}"`,'text-button'):button('Dismiss','dismiss-timer',`data-id="${t.instanceId}"`,'text-button')}</div></article>`;
  }).join('') : '<div class="no-timers">'+icon('clock')+'<p>No timers running.<br>Start one when the food goes on.</p></div>';
}
function timerSubtitle(t,state) { return t.stoppedAt ? `Stopped · ${clockText(state.elapsed)} elapsed` : state.expired ? `${clockText(state.overdue)} overdue · ${clockText(state.elapsed)} elapsed` : t.mode==='elapsed' ? 'Since you started cooking' : `${clockText(state.elapsed)} elapsed`; }
function fullscreenActive(){return Boolean(document.fullscreenElement || document.webkitFullscreenElement);}
function fullscreenButton(){const active=fullscreenActive(),label=active?'Exit fullscreen':'Enter fullscreen';return button('','fullscreen',`aria-label="${label}" title="${label}" aria-pressed="${active}"`,'secondary cooking-menu',active?'minimize':'fullscreen');}
async function toggleFullscreen(){
  try {
    if(fullscreenActive()){
      const exit=document.exitFullscreen || document.webkitExitFullscreen;
      await exit.call(document);
    }else{
      const enter=document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if(!enter)throw new Error('Fullscreen unavailable');
      await enter.call(document.documentElement);
    }
  }catch{toast('Fullscreen isn’t available here. Try opening Cookstep in a separate browser tab.');}
}
function updateFullscreenButton(){const el=document.querySelector('[data-action="fullscreen"]');if(el){const active=fullscreenActive(),label=active?'Exit fullscreen':'Enter fullscreen';el.innerHTML=icon(active?'minimize':'fullscreen');el.setAttribute('aria-label',label);el.title=label;el.setAttribute('aria-pressed',String(active));}}
function ingredientChecks(step){
  const r=session.record.recipe,factor=session.target/r.yield.quantity;
  return step.ingredientUses?.length ? `<div class="step-ingredient-box"><h3>For this step</h3>${step.ingredientUses.map((u,index)=>{
    const ingredient=r.ingredients.find(i=>i.id===u.ingredientId),key=JSON.stringify([step.id,index]),checked=session.preparedIngredients?.includes(key);
    return `<label class="ingredient-row ingredient-check ${checked?'prepared':''}"><input type="checkbox" data-ingredient-check data-step-id="${esc(step.id)}" data-use-index="${index}" ${checked?'checked':''} aria-label="${esc(ingredient.name)} prepared"><span class="ingredient-name">${esc(ingredient.name)}${ingredient.optional?'<small>Optional</small>':''}</span><span class="amount">${u.quantity?quantityHtml(u.quantity,factor,session.units):'<small>Amount not specified for this step</small>'}</span></label>`;
  }).join('')}</div>` : '';
}
function cookingStep(step,position,steps,scroll=false){
  const done=session.completed.includes(step.id),task=step.componentId || 'main';
  const media=(step.imageIds||[]).map(id=>image(session.record,id)).filter(Boolean).join('');
  return `<article class="current-step panel ${media?'has-media':'no-media'} ${step.timers?.length?'has-clock':''} ${scroll?'scroll-step':''}" id="cooking-step-${esc(encodeURIComponent(step.id))}" data-step-id="${esc(step.id)}">
  <div class="step-top"><span class="eyebrow">${esc(taskTitle(task))}</span><span class="pill">STEP ${position+1} / ${steps.length}</span></div>
  ${scroll?'':stepRail(steps,position)}
  <div class="step-copy"><h2>${esc(step.title)}</h2><p class="instruction pre-wrap">${esc(step.instruction)}</p>${step.temperature?`<div class="temperature">Setting: <strong>${formatTemperature(step.temperature,session.units)}</strong></div>`:''}</div>
  ${media?`<div class="step-media">${media}</div>`:''}
  <div class="step-support">${focusClock(step)}
  ${step.timers?.length?`<div class="step-timers"><h3>When you’re ready</h3>${step.timers.map(t=>`<button class="timer-start" data-action="start-timer" data-id="${esc(t.id)}" data-step-id="${esc(step.id)}"><span class="timer-start-icon">${icon('clock')}</span><span><strong>${esc(t.startLabel)}</strong><small>${t.mode==='elapsed'?'Start elapsed tracking':`Start ${clockText(t.durationSeconds)} countdown`} · ${esc(t.label)}</small></span>${icon('plus')}</button>`).join('')}<p class="small muted">Each start creates a separate timer. Add a batch name in the timer panel.</p></div>`:''}</div>
  <div class="step-details">${ingredientChecks(step)}
  ${step.suggestedComponentIds?.length?`<div class="suggested"><h3>Something to do alongside</h3><div class="button-row">${step.suggestedComponentIds.map(id=>button(esc(taskTitle(id)),'task',`data-id="${esc(id)}"`,'secondary','arrow')).join('')}</div></div>`:''}</div>
  <div class="step-footer">${scroll?`<div class="scroll-step-actions">${button(done?'Step complete':'Mark step done','complete-step',`data-id="${esc(step.id)}" ${done?'disabled':''}`,'primary','check')}</div>`:`<div class="step-navigation">${button('Previous','previous',`${position===0?'disabled':''} aria-keyshortcuts="ArrowLeft"`,'secondary','left')}${button('Next','forward',`${position===steps.length-1?'disabled':''} aria-keyshortcuts="ArrowRight"`,'secondary','chevron')}${button(position===steps.length-1?(done?'Step complete':'Mark step done'):'Done · next step','next',`${position===steps.length-1&&done?'disabled':''}`,'primary step-complete','check')}</div>`}${done?'<p class="completed-label">'+icon('check')+' You’ve completed this step</p>':''}</div>
  <div class="step-decoration">${botanical()}</div></article>`;
}
function cookingSteps(){
  const r=session.record.recipe;
  if(session.cookingView==='all')return `<section class="cooking-steps" aria-label="All cooking steps">${['main',...(r.components||[]).map(c=>c.id)].map(task=>{const steps=taskSteps(r,task);return steps.map((s,i)=>cookingStep(s,i,steps,true)).join('');}).join('')}</section>`;
  const steps=taskSteps(r,session.activeTask),position=session.positions[session.activeTask]||0,step=steps[position];
  return step?cookingStep(step,position,steps):`<section class="current-step panel"><div class="meal-overview"><div class="eyebrow">YOUR MEAL AT A GLANCE</div><h2>Make room for the good stuff.</h2><p>Open a task to start cooking. Each one keeps its own place, and all your timers stay in sight.</p>${(r.components||[]).map(c=>button(esc(c.title),'task',`data-id="${esc(c.id)}"`,'secondary','arrow')).join('')}</div></section>`;
}
function cookingScreen() {
  const r=session.record.recipe;
  return `<main class="cooking-page ${session.cookingView==='all'?'all-steps-view':''}"><div class="cooking-top"><h1 title="${esc(r.title)}">${esc(r.title)}</h1><div class="cooking-header-actions">${fullscreenButton()}${button('','cooking-menu','aria-label="Cooking options" aria-haspopup="dialog"','secondary cooking-menu','more')}</div></div><div id="timer-alerts" role="alert"></div>
  <div class="cooking-grid"><aside class="cooking-left">${taskSwitcher()}</aside>${cookingSteps()}
  <details class="timer-panel" ${session.timers.some(t=>!t.stoppedAt)||idleTimerPanelOpen?'open':''}><summary class="timer-panel-heading"><h2>${icon('clock')} On the go</h2><span id="running-count">${session.timers.filter(t=>!t.stoppedAt).length}</span>${icon('chevron')}</summary><div id="timer-list">${timerCards()}</div>${button('Add a timer','manual','','timer-add','plus')}<label class="batch-label" for="batch-name">Name your next batch <small>(optional)</small></label><input id="batch-name" placeholder="e.g. Batch 2" maxlength="80" value="${esc(batchName)}"><p class="timer-help">Timers are reminders to check your food. They never complete a step for you.</p></details></div><button class="mobile-timer-bar" data-action="timer-drawer">${icon("clock")}<span id="mobile-timer-summary">Timers within reach</span>${icon("chevron")}</button></main>`;
}
function render() {
  const focus=document.activeElement?.id, caret=document.activeElement?.selectionStart;
  app.innerHTML=(view==='cooking'&&session?'':header())+(storageError?`<div class="storage-error" role="alert">${esc(storageError)} ${button('Retry saving','retry-save','','secondary')}</div>`:'')+(view==='cooking'&&session?cookingScreen():view==='overview'&&selected?overviewScreen(selected):view==='import'&&pending?overviewScreen(pending,true):libraryScreen());
  if (focus && ['search','target','batch-name'].includes(focus)) { const el=document.getElementById(focus); if(el){el.focus();if(el.type==='search')el.setSelectionRange(caret,caret);} }
  if(modal.open && modal.dataset.timers) modal.querySelector(".drawer-timers").innerHTML=timerCards();
  updateTimers();
}
function showModal(content) { delete modal.dataset.timers; modal.innerHTML=`<button class="modal-close" data-action="close-modal" aria-label="Close">${icon('close')}</button>${content}`; modal.showModal(); }
async function activateAudio(test=false) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.onstatechange=()=>{audioReady=audio.state==='running';const b=document.querySelector('.sound-status');if(b)b.innerHTML=`${icon('sound')} ${audioReady?'Sound on':'Enable sound'}`;};
    await audio.resume(); audioReady=audio.state==='running';
    if(test&&audioReady) beep();
  } catch { audioReady=false; }
}
function beep() {
  if(!audioReady||audio?.state!=='running')return;
  try { [0,.22,.44].forEach((delay)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(0,audio.currentTime+delay);g.gain.linearRampToValueAtTime(.22,audio.currentTime+delay+.015);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+delay+.18);o.connect(g);g.connect(audio.destination);o.start(audio.currentTime+delay);o.stop(audio.currentTime+delay+.2);}); }catch{} }
async function releaseWake() { if(wakeLock){try{await wakeLock.release();}catch{}wakeLock=null;} wakeStatus='Screen wake not active'; }
async function requestWake() {
  if(view!=='cooking'||!session||document.visibilityState!=='visible')return;
  if(!navigator.wakeLock){wakeStatus='Screen wake unavailable · check auto-lock';return;}
  try { wakeLock=await navigator.wakeLock.request('screen'); wakeStatus='Keeping screen awake';wakeLock.addEventListener('release',()=>{wakeLock=null;wakeStatus='Screen wake released';const el=document.querySelector('#wake-status');if(el)el.textContent=wakeStatus;}); }
  catch {wakeStatus='Screen wake unavailable · check auto-lock';}
  const el=document.querySelector('#wake-status');if(el)el.innerHTML=`${icon('screen')} ${esc(wakeStatus)}`;
}
function updateTimers() {
  if(!session)return;
  const due=session.timers.filter(t=>!t.stoppedAt&&timerState(t).expired);
  session.timers.forEach(t=>{
    const state=timerState(t);
    document.querySelectorAll(`[data-timer="${t.instanceId}"]`).forEach(el=>{el.classList.toggle('expired',state.expired&&!t.stoppedAt);el.querySelector('[data-digits]').textContent=clockText(state.remaining===null?state.elapsed:Math.abs(state.remaining));el.querySelector('[data-sub]').textContent=timerSubtitle(t,state);el.style.setProperty('--timer-progress',`${t.mode==='countdown'?Math.max(0,Math.min(100,state.remaining/t.durationSeconds*100)):100}%`);const stop=el.querySelector('[data-action="stop-timer"]');if(stop)stop.textContent=state.expired?'Checked · stop':'Stop timer';});
    if(state.expired&&!t.stoppedAt&&!sounded.has(t.instanceId)&&audioReady){beep();sounded.add(t.instanceId);}
  });
  document.querySelectorAll('[data-focus-step]').forEach(el=>{
    const step=session.record.recipe.steps.find(s=>s.id===el.dataset.focusStep),template=step?.timers?.[0];
    if(!template)return;
    const t=session.timers.filter(t=>t.stepId===step.id&&t.templateId===template.id).at(-1);
    const state=t?timerState(t):null;
    el.classList.toggle('expired',Boolean(state?.expired&&!t.stoppedAt));
    el.querySelector('.focus-digits').textContent=state?clockText(state.remaining===null?state.elapsed:Math.abs(state.remaining)):template.mode==='elapsed'?'0:00':clockText(template.durationSeconds);
    el.querySelector('.focus-status').textContent=!t?'Ready to start':t.stoppedAt?'Stopped':state.expired?'Overdue · check food':template.mode==='elapsed'?'Elapsed':'Remaining';
    el.style.setProperty('--timer-progress',`${state&&template.mode==='countdown'?Math.max(0,Math.min(100,state.remaining/template.durationSeconds*100)):100}%`);
  });
  const mobile=document.querySelector('#mobile-timer-summary');
  if(mobile){const running=session.timers.filter(t=>!t.stoppedAt),next=running.filter(t=>t.mode==='countdown').sort((a,b)=>timerState(a).remaining-timerState(b).remaining)[0];mobile.textContent=due.length?`${due.length} ready to check`:`${running.length} timer${running.length===1?'':'s'} running${next?` · ${clockText(Math.abs(timerState(next).remaining))}`:''}`;mobile.closest('button').classList.toggle('due',due.length>0);}
  const alerts=document.querySelector('#timer-alerts');
  if(alerts){const key=due.map(t=>t.instanceId).join();if(alerts.dataset.key!==key){alerts.dataset.key=key;alerts.innerHTML=due.map(t=>`<div class="expiry-alert"><span>${icon('clock')}<strong>Time to check ${esc(t.label)}${t.batch?` · ${esc(t.batch)}`:''}</strong></span>${button('I’ve checked · stop','stop-timer',`data-id="${t.instanceId}"`,'dark')}${button('Go to step','timer-jump',`data-id="${t.instanceId}"`,'secondary')}</div>`).join('');}}
  if(view!=='cooking'&&due.length){const el=document.querySelector('#global-timer-alert');if(!el){const banner=document.createElement('div');banner.id='global-timer-alert';banner.className='expiry-alert global';banner.innerHTML=`<strong>${due.length} timer${due.length>1?'s':''} ready to check</strong>${button('Return to cooking','resume','','dark','arrow')}`;app.insertBefore(banner,app.children[1]);}else el.querySelector('strong').textContent=`${due.length} timer${due.length>1?'s':''} ready to check`;} else document.querySelector('#global-timer-alert')?.remove();
}
function currentStep(){return taskSteps(session.record.recipe,session.activeTask)[session.positions[session.activeTask]||0];}
function selectCookingStep(step){const task=step.componentId||'main';session.activeTask=task;session.positions[task]=taskSteps(session.record.recipe,task).findIndex(s=>s.id===step.id);if(!session.opened.includes(task))session.opened.push(task);}
function scrollToStep(step){if(step)document.getElementById(`cooking-step-${encodeURIComponent(step.id)}`)?.scrollIntoView({block:'start'});}
async function browseStep(direction) {
  const steps=taskSteps(session.record.recipe,session.activeTask);
  if(!steps.length)return;
  const position=session.positions[session.activeTask]||0;
  const nextPosition=Math.max(0,Math.min(steps.length-1,position+direction));
  if(nextPosition===position)return;
  session.positions[session.activeTask]=nextPosition;
  await saveSession();render();
  if(session.cookingView==='all')scrollToStep(currentStep());
}
async function cook() { view='cooking'; await activateAudio();render();await requestWake(); }
function chatGPTPrompt(){return selected?`Use Cookstep to read my recipe "${selected.recipe.title}" (ID: ${selected.id}). Apply the changes I describe, preserve its other content and images, and save it directly to my library. My changes: `:'Use Cookstep to add a recipe directly to my library. Read the recipe format, prepare faithful ingredients, steps, quantities and timer suggestions from the source I provide, then save it. My recipe: ';}
function chatGPTSettings(){
  showModal(`<h2>Recipes, straight from ChatGPT</h2><p>Connect the private Cookstep plugin in ChatGPT, then ask it to add a recipe or change one you already saved.</p><ol><li>Open Plugins → Created by you → Cookstep and choose Install or Connect.</li><li>Select Cookstep in your chat and provide a recipe link, text or photos.</li><li>Ask ChatGPT to save your recipe. Return here and use Sync now to see the changes.</li></ol><p class="notice">Updates apply to future cooking sessions. A meal already underway keeps its ingredients, progress and timers.</p><label class="field-label" for="chatgpt-prompt">A prompt to get started</label><textarea id="chatgpt-prompt" rows="5" readonly>${esc(chatGPTPrompt())}</textarea><div class="button-row">${button('Copy prompt','copy-chatgpt-prompt','','primary')}<a class="btn secondary" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a></div><p class="muted small">ZIP import and export include ingredients, instructions and all bundled images.</p><a href="./guide/index.html" target="_blank">Recipe preparation guide</a>`);
}
async function downloadRecipes(records,wholeLibrary){
  toast('Preparing your ZIP…');try{const blob=await exportRecipes(records,wholeLibrary),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=wholeLibrary?'cookstep-library.zip':(records[0].recipe.title.replace(/[^a-z0-9]+/gi,'-').slice(0,80)||'recipe')+'.cookstep.zip';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('ZIP ready. Keep it as a backup or import it into Cookstep.');}catch(error){showModal(`<h2>Couldn’t export recipes</h2><p>${esc(error.message)}</p>${button('Close','close-modal','','primary')}`);}
}
function libraryImportPreview(){
  const matches=pendingLibrary.filter(record=>library.some(r=>r.id===record.id)).length;
  showModal(`<h2>Import ${pendingLibrary.length} recipes</h2><p>Review each recipe before saving. ${matches?`${matches} saved recipe${matches===1?'':'s'} share these IDs. Choose whether to replace them or keep copies.`:'These recipes will be added to your library.'}</p>${pendingLibrary.map(record=>`<details class="panel"><summary>${esc(record.recipe.title)} · ${record.recipe.steps.length} steps</summary>${ingredientsHtml(record,1,'original')}${stepsHtml(record,1,'original')}</details>`).join('')}<div class="button-stack">${button(matches?'Import and replace matching recipes':'Save recipes','save-library','','primary')}${matches?button('Import and keep separate copies','copy-library'):''}${button('Cancel import','cancel-library')}</div>`);
}
async function importFile(file){if(!file||importing)return;importing=true;toast('Checking your recipe package…');try{const records=await importRecipes(file);if(records.length>1){pendingLibrary=records;libraryImportPreview();return;}pending=records[0];view='import';await releaseWake();render();window.scrollTo(0,0);}catch(e){showModal(`<div class="eyebrow">PACKAGE NEEDS A LITTLE WORK</div><h2>Couldn’t import this recipe</h2><p>${esc(e.message)}</p>${e.details?`<ul class="validation-errors">${e.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p class="muted">Correct the package with your AI preparer, then try again. Nothing has been saved.</p>${button('Choose another file','import','','primary','upload')}`);}finally{importing=false;document.querySelector('#file-input').value='';}}
async function handleAction(el){
  const action=el.dataset.action,id=el.dataset.id;
  if(action==='chatgpt'){chatGPTSettings();return;}
  if(action==='export-library'||action==='export-recipe'){if(modal.open)modal.close();await downloadRecipes(action==='export-library'?library:[selected],action==='export-library');return;}
  if(action==='save-library'||action==='copy-library'){let records=pendingLibrary;if(!records)return;if(action==='copy-library')records=records.map(record=>{if(!library.some(r=>r.id===record.id))return record;const id=crypto.randomUUID();return {...record,id,recipe:{...record.recipe,id}};});await changeRecipes(records);pendingLibrary=null;library=await read('recipes');view='library';modal.close();render();toast('Library saved. Syncing recipes…');void cloud.sync();return;}
  if(action==='cancel-library'){pendingLibrary=null;modal.close();return;}
  if(action==='copy-chatgpt-prompt'){try{await navigator.clipboard.writeText(document.querySelector('#chatgpt-prompt').value);toast('Prompt copied. Paste it into ChatGPT with Cookstep selected.');}catch{toast('Select and copy the prompt shown in this window.');}return;}
  if(action==='library-options'){showModal(`<h2>Library options</h2><div class="button-stack">${button('Import recipes','import','','secondary','upload')}${button('Export library ZIP','export-library',library.length?'':'disabled','secondary','book')}</div>`);return;}
  if(action==='recipe-options'){showModal(`<h2>Recipe options</h2><div class="button-stack">${button('Export recipe ZIP','export-recipe','','secondary','upload')}</div>`);return;}
  if(action==='sync-library'){void cloud.sync();return;}
  if(action==='theme-settings'){themeSettings();return;}
  if(action==='close-modal'){pendingLibrary=null;modal.close();return;}
  if(action==='import'){if(modal.open)modal.close();document.querySelector('#file-input').click();return;}
  if(action==='example'){const data=await fetch('./examples/recipe.json').then(r=>r.text());await importFile(new File([data],'recipe.json',{type:'application/json'}));return;}
  if(action==='library'){if(modal.open)modal.close();await releaseWake();view='library';render();window.scrollTo(0,0);return;}
  if(action==='overview'){selected=library.find(r=>r.id===id);target=selected.recipe.yield.quantity;units='original';view='overview';render();window.scrollTo(0,0);return;}
  if(action==='delete'){selected=library.find(r=>r.id===id);showModal(`<h2>Remove this recipe?</h2><p>${esc(selected.recipe.title)} will be removed from your synced library on all devices. You can import it again.${session?.record.id===id?' Your active cooking session will keep its own copy.':''}</p>${button('Remove recipe','confirm-delete',`data-id="${esc(id)}"`,'danger')}${button('Keep recipe','close-modal')}`);return;}
  if(action==='confirm-delete'){await write('recipes',id);library=library.filter(r=>r.id!==id);modal.close();render();toast('Recipe removed. Syncing the change…');void cloud.sync();return;}
  if(action.startsWith('save-')&&pending){let record=pending;if(action==='save-copy')record={...pending,id:crypto.randomUUID(),recipe:{...pending.recipe,id:crypto.randomUUID()}};record.recipe.id=record.id;await write('recipes',record);library=await read('recipes');pending=null;selected=record;target=record.recipe.yield.quantity;units='original';view='overview';render();toast('Recipe saved on this device. Uploading to your library…');void cloud.sync();return;}
  if(action==='cancel-import'){pending=null;view='library';render();return;}
  if(action==='yield-minus'||action==='yield-plus'){target=Math.min(100000,Math.max(.01,target+(action==='yield-plus'?1:-1)));render();return;}
  if(action==='start'){await activateAudio();if(!session){session=createSession(selected,target,units);await saveSession();}await cook();return;}
  if(action==='resume'){await cook();return;}
  if(action==='sound'){await activateAudio(true);render();toast(audioReady?'Sound enabled. You’ll hear a chime when a timer finishes.':'Sound could not start. Use visual alerts and check your device sound settings.');return;}
  if(action==='retry-save'){storageError='';await databaseRetry();return;}
  if(!session)return;
  if(action==='cooking-menu'){showModal(`<h2>Cooking options</h2><label class="field-label" for="cooking-view">Cooking view</label><select id="cooking-view"><option value="steps" ${session.cookingView!=='all'?'selected':''}>Step by step</option><option value="all" ${session.cookingView==='all'?'selected':''}>All steps · scroll</option></select><div class="session-meta"><span>${icon('pot')} ${number(session.target)} ${esc(session.record.recipe.yield.unit)} · ${session.units==='original'?'As written':session.units==='metric'?'Metric':'Imperial'}</span><span id="wake-status">${icon('screen')} ${esc(wakeStatus)}</span><button class="sound-status" data-action="sound">${icon('sound')} ${audioReady?'Sound on':'Enable sound'}</button></div><div class="button-stack cooking-menu-actions">${button('Theme','theme-settings','','secondary','palette')}${button('Overview','session-overview','','secondary','book')}${button('My recipes','library','','secondary','left')}${button('Finish cooking','finish','','secondary','check')}</div>`);return;}
  if(action==='task'){session.activeTask=id;session.positions[id]??=0;if(!session.opened.includes(id))session.opened.push(id);await saveSession();render();if(session.cookingView==='all')scrollToStep(currentStep());return;}
  if(action==='previous'||action==='forward'){await browseStep(action==='previous'?-1:1);return;}
  if(action==='next'){const step=currentStep();if(!step)return;if(!session.completed.includes(step.id))session.completed.push(step.id);const steps=taskSteps(session.record.recipe,session.activeTask);session.positions[session.activeTask]=Math.min(steps.length-1,(session.positions[session.activeTask]||0)+1);await saveSession();render();if(steps.every(s=>session.completed.includes(s.id)))toast(`${taskTitle(session.activeTask)} complete. Your timers are still running.`);return;}
  if(action==='complete-step'){const step=session.record.recipe.steps.find(s=>s.id===id);if(!step)return;selectCookingStep(step);if(!session.completed.includes(id))session.completed.push(id);await saveSession();render();return;}
  if(action==='jump'){session.positions[session.activeTask]=Number(el.dataset.index);await saveSession();render();return;}
  if(action==='start-timer'){await activateAudio();const step=session.record.recipe.steps.find(s=>s.id===el.dataset.stepId)||currentStep(),template=step.timers.find(t=>t.id===id);selectCookingStep(step);session.timers.push(startTimer(session,template,step,Date.now(),document.querySelector('#batch-name')?.value||''));await saveSession();render();toast('Timer started. You can switch tasks while it runs.');return;}
  if(action==='timer-jump'){if(modal.open)modal.close();const t=session.timers.find(t=>t.instanceId===id);session.activeTask=t.task;session.positions[t.task]=Math.max(0,taskSteps(session.record.recipe,t.task).findIndex(s=>s.id===t.stepId));if(!session.opened.includes(t.task))session.opened.push(t.task);await saveSession();view='cooking';render();if(session.cookingView==='all')scrollToStep(currentStep());await requestWake();return;}
  if(action==='stop-timer'){const t=session.timers.find(t=>t.instanceId===id);t.stoppedAt=Date.now();t.acknowledgedAt=t.stoppedAt;if(!session.timers.some(t=>!t.stoppedAt))idleTimerPanelOpen=false;await saveSession();render();return;}
  if(action==='dismiss-timer'){session.timers=session.timers.filter(t=>t.instanceId!==id);await saveSession();render();return;}
  if(action==='timer-drawer'){showModal(`<div class="eyebrow">YOUR TIMERS KEEP GOING</div><h2>On the go</h2><div class="drawer-timers">${timerCards()}</div>${button('Add a timer','manual','','primary','plus')}`);modal.dataset.timers='true';return;}
  if(action==='manual'){showModal(`<div class="eyebrow">YOUR KITCHEN, YOUR TIMING</div><h2>Add a timer</h2><form id="manual-form"><label class="field-label" for="timer-name">What’s cooking?</label><input id="timer-name" name="label" required maxlength="100" placeholder="e.g. Tortillas in the pan"><label class="field-label" for="timer-mode">Timer type</label><select id="timer-mode" name="mode"><option value="countdown">Countdown</option><option value="elapsed">Elapsed tracking</option></select><div id="duration-field"><label class="field-label" for="timer-minutes">Minutes</label><input id="timer-minutes" name="minutes" type="number" min="0.016667" max="10080" step="any" value="5" required></div><label class="field-label" for="timer-batch">Batch name (optional)</label><input id="timer-batch" name="batch" maxlength="80"><button class="btn primary full" type="submit">${icon('clock')} Start timer now</button></form>`);return;}
  if(action==='session-overview'){showModal(`<div class="eyebrow">${number(session.target)} ${esc(session.record.recipe.yield.unit)} · ${esc(session.units)}</div><h2>${esc(session.record.recipe.title)}</h2><p class="muted">Quantities are locked for this cooking session.</p><details open><summary>Ingredients</summary>${ingredientsHtml(session.record,session.target/session.record.recipe.yield.quantity,session.units)}</details><details><summary>Equipment</summary><p>${(session.record.recipe.equipment||[]).map(esc).join(' · ')||'Not specified'}</p></details><details><summary>All steps</summary>${stepsHtml(session.record,session.target/session.record.recipe.yield.quantity,session.units)}</details>${session.record.recipe.sources?.length?`<details><summary>Sources & original text</summary>${sourceHtml(session.record.recipe)}</details>`:''}`);return;}
  if(action==='finish'){const running=session.timers.filter(t=>!t.stoppedAt).length;showModal(`<div class="finish-icon">${icon('leaf')}</div><h2>Ready to call it a meal?</h2><p>${running?`${running} timer${running>1?'s are':' is'} still running. Finishing will stop all timers and clear this session.`:'Your recipe will stay in your library for next time.'}</p><div class="button-row">${button('Finish cooking','confirm-finish','','primary','check')}${button('Keep cooking','close-modal')}</div>`);return;}
  if(action==='confirm-finish'){await write('sessions','active');session=null;modal.close();await releaseWake();view='library';render();toast('Kitchen closed. Enjoy your meal.');return;}
}
async function databaseRetry(){try{if(session)await write('sessions',session);if(pending)toast('Storage available. Save the import when ready.');library=await read('recipes');storageError='';sessionSaved=true;render();}catch(e){storageFailure(e);}}
function enqueue(fn){actionQueue=actionQueue.then(fn).catch(e=>{if(e.name==='QuotaExceededError'||e.name==='UnknownError')storageFailure(e);else toast(e.message||'Something went wrong. Please try again.');});}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled){if(el.dataset.action==='fullscreen'){toggleFullscreen();return;}if(['start','resume','sound','start-timer'].includes(el.dataset.action))activateAudio();enqueue(()=>handleAction(el));}});
document.addEventListener('pointerover',e=>{const control=e.target.closest('.sync-control');if(control){control.dataset.pointer=e.pointerType;if(e.pointerType==='mouse'){delete control.dataset.dismissed;control.open=true;}}});
document.addEventListener('pointerout',e=>{const control=e.target.closest('.sync-control');if(control&&e.pointerType==='mouse'&&!control.contains(e.relatedTarget)&&!control.querySelector(':focus-visible'))control.open=false;});
document.addEventListener('focusin',e=>{const control=e.target.closest('.sync-control');if(control&&!control.dataset.dismissed&&e.target.matches(':focus-visible'))control.open=true;});
document.addEventListener('focusout',e=>{const control=e.target.closest('.sync-control');if(control&&!control.contains(e.relatedTarget)){delete control.dataset.dismissed;if(!control.matches(':hover'))control.open=false;}});
document.addEventListener('click',e=>{const summary=e.target.closest('.sync-control summary');if(summary&&e.detail>0&&summary.parentElement.dataset.pointer!=='touch'){e.preventDefault();summary.parentElement.open=true;}if(!e.target.closest('.sync-control'))document.querySelectorAll('.sync-control[open]').forEach(control=>control.open=false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const control=document.querySelector('.sync-control[open]');if(control){control.dataset.dismissed='true';control.open=false;if(control.contains(document.activeElement))control.querySelector('summary').focus();}}});
document.addEventListener('fullscreenchange',updateFullscreenButton);
document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
document.addEventListener('change',e=>{
  if(e.target.matches('input[name="theme"]')){
    activeTheme=applyTheme(e.target.value);
    const saved=saveTheme(activeTheme.id);
    document.querySelector('#theme-persistence').textContent=saved?`${activeTheme.name} saved on this device.`:'Theme applied for this visit. Browser storage is unavailable, so this preference could not be saved.';
  }
  if(e.target.matches('[data-ingredient-check]')&&session){
    const key=JSON.stringify([e.target.dataset.stepId,Number(e.target.dataset.useIndex)]),checked=e.target.checked;
    e.target.closest('.ingredient-check').classList.toggle('prepared',checked);
    session.preparedIngredients??=[];session.preparedIngredients=session.preparedIngredients.filter(k=>k!==key);if(checked)session.preparedIngredients.push(key);
    sessionSaved=false;
    enqueue(()=>saveSession());
  }
  if(e.target.id==='cooking-view'&&session){const mode=e.target.value;enqueue(async()=>{session.cookingView=mode==='all'?'all':'steps';await saveSession();modal.close();render();if(session.cookingView==='all')scrollToStep(currentStep());else window.scrollTo(0,0);});}
});
document.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key)||e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  if(view!=='cooking'||!session||modal.open||e.target.closest('input,textarea,select,[role="textbox"]')||e.target.isContentEditable)return;
  e.preventDefault();
  enqueue(async()=>{if(view==='cooking'&&session&&!modal.open)await browseStep(e.key==='ArrowLeft'?-1:1);});
});
document.addEventListener('toggle',e=>{if(e.target.matches('.timer-panel')&&!session?.timers.some(t=>!t.stoppedAt))idleTimerPanelOpen=e.target.open;},true);
document.addEventListener('change',e=>{if(e.target.id==='file-input'){const file=e.target.files[0];enqueue(()=>importFile(file));}if(e.target.id==='target'){const n=Number(e.target.value);if(n>0&&n<=100000){target=n;render();}else{toast('Choose a yield between 0.01 and 100,000.');e.target.value=target;}}if(e.target.id==='units'){units=e.target.value;render();}if(e.target.id==='timer-mode'){const elapsed=e.target.value==='elapsed';document.querySelector('#duration-field').hidden=elapsed;document.querySelector('#timer-minutes').required=!elapsed;}});
document.addEventListener('input',e=>{if(e.target.id==='batch-name')batchName=e.target.value;if(e.target.id==='search'){search=e.target.value;render();}});
document.addEventListener('submit',async e=>{if(e.target.id!=='manual-form')return;e.preventDefault();const fields=new FormData(e.target),mode=fields.get('mode'),durationSeconds=Math.round(Number(fields.get('minutes'))*60);if(mode==='countdown'&&(!Number.isSafeInteger(durationSeconds)||durationSeconds<1)){toast('Choose a countdown of at least one second.');return;}await activateAudio();const t={id:'manual',label:fields.get('label').trim(),mode,...(mode==='countdown'?{durationSeconds}:{})};session.timers.push(startTimer(session,t,currentStep(),Date.now(),fields.get('batch')));await saveSession();modal.close();render();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateTimers();if(view==='cooking')requestWake();}else releaseWake();});
window.addEventListener('pagehide',()=>{if(session)saveSession();});
window.addEventListener('beforeunload',e=>{if(!sessionSaved){e.preventDefault();e.returnValue='';}});
setInterval(updateTimers,500);
async function init(){try{library=await read('recipes');session=await read('sessions','active')||null;}catch(e){storageError=`Browser storage is unavailable: ${e.message}. Enable storage for this site to keep recipes and cooking progress.`;}render();void cloud.sync();}
window.addEventListener('online',()=>void cloud.sync());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void cloud.sync();});
setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)void cloud.sync();},60000);
init();
