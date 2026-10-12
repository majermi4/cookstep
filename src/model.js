export const FORMAT_VERSION = '0.2';
export const LIMITS = { package: 25 * 1024 ** 2, expanded: 80 * 1024 ** 2, image: 10 * 1024 ** 2, json: 2 * 1024 ** 2, files: 500 };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const safePath = p => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.includes(':') && !p.split('/').some(s => s === '..' || s === '.');
export const safeUrl = url => { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } };

/** Validate the complete manifest without coercing source data. Returns field-specific errors.
 * @param {any} r
 * @param {Set<string> | null} [files]
 */
export function validateRecipe(r, files = null) {
  const errors = [];
  const fail = (p, m) => errors.push(`${p}: ${m}`);
  const str = (v, p) => { if (typeof v !== 'string' || !v.trim()) fail(p, 'must be a nonempty string'); };
  const optString = (o, key, p) => { if (o[key] !== undefined) str(o[key], `${p}.${key}`); };
  const strings = (v, p) => { if (!Array.isArray(v)) fail(p, 'must be an array of strings'); else v.forEach((s,i) => str(s, `${p}[${i}]`)); };
  const list = (key, required = false) => {
    if (r[key] === undefined && !required) return [];
    if (!Array.isArray(r[key])) { fail(key, 'must be an array'); return []; }
    if (r[key].length > 2000) { fail(key, 'must contain at most 2,000 entries'); return []; }
    return r[key];
  };
  const namespace = (entries, key, fields) => {
    const ids = new Set();
    entries.forEach((o,i) => {
      const p = `${key}[${i}]`;
      if (!object(o)) { fail(p, 'must be an object'); return; }
      fields.forEach(k => str(o[k], `${p}.${k}`));
      if (typeof o.id === 'string') { if (['__proto__','prototype','constructor'].includes(o.id) || (key === 'components' && o.id === 'main')) fail(`${p}.id`, 'this identifier is reserved'); if (ids.has(o.id)) fail(`${p}.id`, `duplicate identifier “${o.id}”`); ids.add(o.id); }
    });
    return ids;
  };
  const ref = (v, ids, p) => { if (typeof v !== 'string' || !ids.has(v)) fail(p, `reference “${String(v)}” does not exist`); };
  const refs = (v, ids, p) => { if (v === undefined) return; if (!Array.isArray(v)) fail(p, 'must be an array'); else v.forEach((x,i) => ref(x, ids, `${p}[${i}]`)); };
  const quantity = (q,p) => {
    if (!object(q)) { fail(p, 'must be a quantity object'); return; }
    str(q.text, `${p}.text`);
    if (q.value !== undefined && q.range !== undefined) fail(p, 'value and range are mutually exclusive');
    if (q.value !== undefined && !positive(q.value)) fail(`${p}.value`, 'must be a positive finite number');
    if (q.range !== undefined && (!object(q.range) || !positive(q.range.min) || !positive(q.range.max) || q.range.min > q.range.max)) fail(`${p}.range`, 'requires positive min and max, with min ≤ max');
    if (q.value !== undefined || q.range !== undefined) str(q.unit, `${p}.unit`);
    else if (q.unit !== undefined) str(q.unit, `${p}.unit`);
  };
  if (!object(r)) return ['recipe: must be a JSON object'];
  if (r.formatVersion !== FORMAT_VERSION) fail('formatVersion', 'must be "0.2"; re-prepare older packages using the current guide');
  str(r.id, 'id'); str(r.title, 'title');
  if (!object(r.yield)) fail('yield', 'requires quantity and unit');
  else { if (!positive(r.yield.quantity)) fail('yield.quantity', 'must be a positive finite number'); str(r.yield.unit, 'yield.unit'); }
  if (r.servings !== undefined && !positive(r.servings)) fail('servings', 'must be a positive finite number of people');
  ['description','language'].forEach(k => optString(r, k, 'recipe'));
  ['equipment','notes'].forEach(k => { if (r[k] !== undefined) strings(r[k], k); });
  const ingredients = list('ingredients', true), steps = list('steps', true), components = list('components'), sources = list('sources'), images = list('images');
  if (!steps.length) fail('steps', 'at least one cooking step is required');
  const ingredientIds = namespace(ingredients,'ingredients',['id','name']);
  const componentIds = namespace(components,'components',['id','title']);
  const sourceIds = namespace(sources,'sources',['id','title']);
  const imageIds = namespace(images,'images',['id','path','alt','kind','origin']);
  namespace(steps,'steps',['id','title','instruction']);
  components.forEach((c,i) => { if (object(c)) { optString(c,'description',`components[${i}]`); if (!steps.some(s => s?.componentId === c.id)) fail(`components[${i}]`, 'must have at least one step'); } });
  sources.forEach((s,i) => { if (object(s)) { ['url','author','originalText'].forEach(k => optString(s,k,`sources[${i}]`)); if (s.url !== undefined && !safeUrl(s.url)) fail(`sources[${i}].url`,'must be an HTTP or HTTPS URL'); } });
  ingredients.forEach((o,i) => {
    if (!object(o)) return;
    const p = `ingredients[${i}]`;
    if (o.quantity !== undefined) quantity(o.quantity,`${p}.quantity`);
    if (o.componentId !== undefined) ref(o.componentId,componentIds,`${p}.componentId`);
    refs(o.sourceIds,sourceIds,`${p}.sourceIds`); optString(o,'notes',p);
    if (o.optional !== undefined && typeof o.optional !== 'boolean') fail(`${p}.optional`,'must be a boolean');
  });
  const timerIds = new Set();
  steps.forEach((s,i) => {
    if (!object(s)) return;
    const p = `steps[${i}]`;
    if (s.componentId !== undefined) ref(s.componentId,componentIds,`${p}.componentId`);
    refs(s.sourceIds,sourceIds,`${p}.sourceIds`); refs(s.imageIds,imageIds,`${p}.imageIds`); refs(s.suggestedComponentIds,componentIds,`${p}.suggestedComponentIds`);
    optString(s,'completionCue',p);
    if (s.notes !== undefined) strings(s.notes,`${p}.notes`);
    if (s.ingredientUses !== undefined) {
      if (!Array.isArray(s.ingredientUses)) fail(`${p}.ingredientUses`,'must be an array');
      else s.ingredientUses.forEach((u,j) => { const up = `${p}.ingredientUses[${j}]`; if (!object(u)) fail(up,'must be an object'); else { ref(u.ingredientId,ingredientIds,`${up}.ingredientId`); if (u.quantity !== undefined) quantity(u.quantity,`${up}.quantity`); } });
    }
    if (s.temperature !== undefined && (!object(s.temperature) || !Number.isFinite(s.temperature.value) || !['C','F'].includes(s.temperature.unit))) fail(`${p}.temperature`,'requires a finite value and unit C or F');
    if (s.timers !== undefined) {
      if (!Array.isArray(s.timers)) fail(`${p}.timers`,'must be an array');
      else s.timers.forEach((t,j) => {
        const tp = `${p}.timers[${j}]`;
        if (!object(t)) { fail(tp,'must be an object'); return; }
        ['id','label','startLabel'].forEach(k => str(t[k],`${tp}.${k}`));
        if (timerIds.has(t.id)) fail(`${tp}.id`,'must be unique across the recipe'); timerIds.add(t.id);
        if (!['countdown','elapsed'].includes(t.mode)) fail(`${tp}.mode`,'must be countdown or elapsed');
        if (t.mode === 'countdown' && (!Number.isSafeInteger(t.durationSeconds) || t.durationSeconds <= 0)) fail(`${tp}.durationSeconds`,'must be a positive safe integer');
        if (t.mode === 'elapsed' && t.durationSeconds !== undefined) fail(`${tp}.durationSeconds`,'must be omitted for elapsed timers');
      });
    }
  });
  images.forEach((im,i) => {
    if (!object(im)) return;
    const p = `images[${i}]`;
    if (!safePath(im.path) || !/^images\/.+\.(jpe?g|png|webp)$/i.test(im.path)) fail(`${p}.path`,'must be a safe relative JPEG, PNG or WebP path under images/');
    if (!['photo','illustration'].includes(im.kind)) fail(`${p}.kind`,'must be photo or illustration');
    if (!['recipe_source','user_supplied','ai_generated'].includes(im.origin)) fail(`${p}.origin`,'must be recipe_source, user_supplied or ai_generated');
    ['caption','sourceUrl'].forEach(k => optString(im,k,p));
    if (im.sourceUrl !== undefined && !safeUrl(im.sourceUrl)) fail(`${p}.sourceUrl`,'must be an HTTP or HTTPS URL');
    if (!files) fail(`${p}.path`,'standalone JSON cannot include images; bundle the file in a ZIP');
    else if (!files.has(im.path)) fail(`${p}.path`, `missing bundled file “${im.path}”`);
  });
  if (r.coverImageId !== undefined) ref(r.coverImageId,imageIds,'coverImageId');
  return errors;
}

export const UNITS = {
  g: ['mass',1,'g'], kg: ['mass',1000,'kg'], oz: ['mass',28.349523125,'oz'], lb: ['mass',453.59237,'lb'],
  ml: ['volume',1,'ml'], l: ['volume',1000,'l'], fl_oz_us: ['volume',29.5735295625,'US fl oz'], fl_oz_uk: ['volume',28.4130625,'UK fl oz'],
  cup_us: ['volume',236.5882365,'US cups'], cup_metric: ['volume',250,'metric cups'],
  tbsp_us: ['volume',14.78676478125,'US tbsp'], tbsp_metric: ['volume',15,'metric tbsp'], tbsp_au: ['volume',20,'Australian tbsp'],
  tsp_us: ['volume',4.92892159375,'US tsp'], tsp_metric: ['volume',5,'metric tsp'],
};
export const number = n => new Intl.NumberFormat('en', {maximumFractionDigits: n < 1 ? 3 : 2}).format(n);
export function formatQuantity(q, factor = 1, system = 'original') {
  if (!q) return {text:'Amount not specified',note:'Check the source'};
  if (q.value === undefined && !q.range) return {text:q.text,note:factor !== 1 ? 'Not scaled' : ''};
  let values = q.range ? [q.range.min * factor,q.range.max * factor] : [q.value * factor];
  if (values.some(v => !Number.isFinite(v))) return {text:q.text,note:'Quantity exceeds supported range'};
  const source = UNITS[q.unit]; let unit = source?.[2] || q.unit;
  if (source && system !== 'original') {
    const base = values.map(v => v * source[1]);
    const max = Math.max(...base);
    const target = system === 'metric' ? (source[0] === 'mass' ? (max >= 1000 ? 'kg' : 'g') : (max >= 1000 ? 'l' : 'ml')) : (source[0] === 'mass' ? (max >= 453.59237 ? 'lb' : 'oz') : (max >= 236.5882365 ? 'cup_us' : 'fl_oz_us'));
    values = base.map(v => v / UNITS[target][1]); unit = UNITS[target][2];
  }
  const note = !source && system !== 'original' && ['cup','tbsp','tsp','fl_oz','fluid ounce'].includes(q.unit) ? 'Unit convention unknown · not converted' : '';
  if (factor === 1 && (system === 'original' || !source)) return {text:q.text,note};
  return {text: `${values.map(number).join('–')} ${unit}`,note};
}
export function formatTemperature(t, system) {
  const unit = system === 'metric' ? 'C' : system === 'imperial' ? 'F' : t.unit;
  const value = unit === t.unit ? t.value : unit === 'F' ? t.value * 9 / 5 + 32 : (t.value - 32) * 5 / 9;
  return `${number(value)} °${unit}`;
}
export function taskSteps(recipe, task) { return recipe.steps.filter(s => (s.componentId || 'main') === task); }
export function createSession(record, target, units) {
  return {id:'active',record:structuredClone(record),target,units,activeTask:'main',opened:['main'],positions:{main:0},completed:[],preparedIngredients:[],cookingView:'steps',timers:[],startedAt:Date.now()};
}
export function startTimer(session, template, step, now = Date.now(), batch = '') {
  return {instanceId:crypto.randomUUID(),templateId:template.id,label:template.label,mode:template.mode,durationSeconds:template.durationSeconds,stepId:step?.id,task:step?.componentId || session.activeTask,startedAt:now,batch:batch.trim()};
}
export function timerState(timer, now = Date.now()) {
  const elapsed = Math.max(0,Math.floor(((timer.stoppedAt ?? now) - timer.startedAt) / 1000));
  const remaining = timer.mode === 'countdown' ? timer.durationSeconds - elapsed : null;
  return {elapsed,remaining,expired:remaining !== null && remaining <= 0,overdue:Math.max(0,-(remaining ?? 0))};
}
export function clockText(seconds) {
  const s = Math.max(0,Math.floor(seconds));
  return `${s >= 3600 ? `${Math.floor(s/3600)}:` : ''}${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
