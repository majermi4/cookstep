import {metricRecipe,metricQuantity} from './metric.js';
import {t,ui,getLocale} from './i18n.js';
import {localizeRecipe} from './recipe-locales.js';
import {formatQuantity,number} from './model.js';

export function peopleForRecipe(recipe) {
  return recipe.servings || (/^(servings?|people|persons?|portions?)$/i.test(recipe.yield.unit.trim()) ? recipe.yield.quantity : null);
}

// A list stores recipe data only; it never shares cooking checkboxes or images.
export function createShoppingList(recipe,target=recipe.yield.quantity) {
  return {id:recipe.id,recipe:structuredClone(metricRecipe(recipe)),target,checked:[],updatedAt:Date.now()};
}
export function shoppingRecipeKey(recipe) {
  return JSON.stringify([recipe.yield,recipe.servings,recipe.ingredients,recipe.components]);
}
export function shoppingProgress(list) {
  const checked=new Set(list.checked),required=list.recipe.ingredients.filter(i=>!i.optional);
  return {total:required.length,done:required.filter(i=>checked.has(i.id)).length,
    optional:list.recipe.ingredients.filter(i=>i.optional&&checked.has(i.id)).length};
}

const wholeUnits=new Set(['piece','pieces','item','items','count','whole','egg','eggs','clove','cloves','tortilla','tortillas','can','cans','tin','tins','bottle','bottles','packet','packets','pack','packs','bunch','bunches','slice','slices','head','heads']);
export function shoppingQuantity(ingredient,factor) {
  const q=metricQuantity(ingredient.quantity,{},false),result=formatQuantity(q,factor);
  const notes=[result.note];
  // Keep source wording: it can specify sizes (e.g. 20 cm tortillas or 400 g tins).
  if(q?.text&&result.text!==q.text)notes.push(ui`Original amount: ${q.text}`);
  if(q?.range)notes.push(t('Buy enough for the upper end of the range.'));
  const amount=(q?.range?.max??q?.value)*factor;
  if(wholeUnits.has(q?.unit?.toLowerCase())&&Number.isFinite(amount)&&Math.abs(amount-Math.round(amount))>1e-9)
    notes.push(ui`Buy at least ${number(Math.ceil(amount))} ${t(q.unit)}; the recipe uses a partial amount.`);
  return {text:result.text,notes:notes.filter(Boolean)};
}

export function shoppingText(list) {
  const r=localizeRecipe(list.recipe,getLocale()),factor=list.target/r.yield.quantity,people=peopleForRecipe(list.recipe);
  return [ui`${r.title} — shopping list`,`${number(list.target)} ${r.yield.unit}${people?ui` · ${number(people*factor)} people`:''}`,
    ...r.ingredients.map(i=>{
      const q=shoppingQuantity(i,factor);
      return `${list.checked.includes(i.id)?'[x]':'[ ]'} ${i.name} — ${q.text}${i.optional?t(' (optional)'):''}${i.notes?` · ${i.notes}`:''}${q.notes.length?` · ${q.notes.join(' · ')}`:''}`;
    })].join('\n');
}
