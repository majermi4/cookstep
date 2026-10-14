export const RECIPE_LOCALES = ['en','es','cs'];
const fields = new Set(['title','description','name','instruction','completionCue','label','startLabel','alt','caption','text']);

// Text-only overlays share IDs with the canonical recipe. Quantities, references,
// provenance and source quotations are never duplicated or translated.
export function recipeText(recipe) {
  function collect(value,key='') {
    if(typeof value==='string')return fields.has(key)||['equipment','notes'].includes(key)?value:undefined;
    if(Array.isArray(value))return ['equipment','notes','ingredients','steps','components','images','sources','timers','ingredientUses'].includes(key)?value.map(v=>collect(v,key)):undefined;
    if(!value||typeof value!=='object')return undefined;
    const out={};
    if(key&&typeof value.id==='string')out.id=value.id;
    for(const [k,v] of Object.entries(value)) {
      if(['translations','id','language'].includes(k))continue;
      if(k==='unit') {if(key==='yield')out.unit=v;continue;}
      const text=collect(v,k);
      if(text!==undefined)out[k]=text;
    }
    // ingredientUses carry references rather than an id of their own.
    if(value.ingredientId)out.ingredientId=value.ingredientId;
    return Object.keys(out).length?out:undefined;
  }
  return collect(recipe);
}

export function validateTranslations(recipe) {
  if(recipe.translations===undefined)return []; // Legacy format 0.2 imports remain readable.
  const errors=[],base=recipeText(recipe);
  function check(expected,actual,path) {
    if(typeof expected==='string') {
      if(typeof actual!=='string'||!actual.trim())errors.push(`${path}: requires translated text`);
    } else if(Array.isArray(expected)) {
      if(!Array.isArray(actual)||actual.length!==expected.length){errors.push(`${path}: must cover all entries`);return;}
      expected.forEach((v,i)=>check(v,actual[i],`${path}[${i}]`));
    } else {
      if(!actual||typeof actual!=='object'||Array.isArray(actual)){errors.push(`${path}: requires a text overlay`);return;}
      for(const [k,v] of Object.entries(expected)) {
        if(['id','ingredientId'].includes(k)) {if(actual[k]!==v)errors.push(`${path}.${k}: must preserve the canonical ID`);}
        else check(v,actual[k],`${path}.${k}`);
      }
      for(const k of Object.keys(actual))if(!Object.hasOwn(expected,k))errors.push(`${path}.${k}: only translatable text is allowed`);
    }
  }
  if(!recipe.translations||typeof recipe.translations!=='object'||Array.isArray(recipe.translations))return ['translations: requires en, es and cs text overlays'];
  for(const locale of RECIPE_LOCALES)check(base,recipe.translations[locale],`translations.${locale}`);
  for(const locale of Object.keys(recipe.translations))if(!RECIPE_LOCALES.includes(locale))errors.push(`translations.${locale}: unsupported locale (use cs for Czech)`);
  return errors;
}

export function localizeRecipe(recipe,locale) {
  const overlay=recipe.translations?.[locale==='cz'?'cs':locale];
  if(!overlay)return recipe;
  function apply(base,text) {
    if(typeof base==='string')return typeof text==='string'?text:base;
    if(Array.isArray(base))return base.map((v,i)=>{
      const entry=v?.id?text?.find?.(o=>o?.id===v.id):v?.ingredientId?text?.find?.(o=>o?.ingredientId===v.ingredientId):text?.[i];
      return apply(v,entry);
    });
    if(!base||typeof base!=='object'||!text||typeof text!=='object')return base;
    return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,['translations','id','ingredientId'].includes(k)?v:apply(v,text[k])]));
  }
  return apply(recipe,overlay);
}
