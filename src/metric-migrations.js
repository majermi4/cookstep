// Repairs for legacy library entries checked against the publisher's metric
// toggle on 2026-10-14. Apply only while the original measurement is present.
// https://www.cooklikeczechs.com/bramboracka-czech-potato-soup/
// https://www.cooklikeczechs.com/chicken-breast-paprikash/
// https://www.cooklikeczechs.com/houskove-knedliky-czech-bread-dumplings/
// https://www.cooklikeczechs.com/conversion-charts/
export function repairLegacyMeasurements(recipe){
  if(!['bramboracka-czech-potato-soup','cooklikeczechs-chicken-breast-paprikash','cooklikeczechs-czech-beef-goulash-3910','cooklikeczechs-czech-bread-dumplings','e0b8a34c-83ae-4f8f-9cfb-33bff01b595b'].includes(recipe.id))return recipe;
  recipe=structuredClone(recipe);
  const metricNotes={en:'Measurements use metric amounts; volume is not converted to mass without source data.',es:'Las medidas usan unidades métricas; el volumen no se convierte en masa sin datos de la fuente.',cs:'Množství jsou v metrických jednotkách; objem se bez údajů ze zdroje nepřevádí na hmotnost.'};
  const groups=[[recipe,recipe.language||'en'],...Object.entries(recipe.translations||{}).map(([locale,overlay])=>[overlay,locale])];
  for(const [text,locale] of groups){
    const note=metricNotes[locale]||metricNotes.en;
    if(text.notes)text.notes=text.notes.map(n=>/US form|published US|visible source measurements|metric quantities are preserved|source metric quantities|measuring spoons|source.*butter.*stick|retrieved recipe text|source page exposes|source.*conversion guide|source.*7\/8|poslední.*vývaru|última adición de caldo|medidas estadounidenses|americké míry|metrické hodnoty ze zdroje|viditelné zdrojové|Viditelné míry ze zdroje|původní.*americk|medidas.*publicadas|forma estadounidense|máslo.*kostky|mantequilla.*barra|barra de mantequilla|cantidades métricas|odměrné lžíce mají|spoons are encoded|Cups of cilantro|cucharas se codifican|Lžíce jsou podle/i.test(n)?note:n);
    for(const ingredient of text.ingredients||[]){
      if(recipe.id!=='e0b8a34c-83ae-4f8f-9cfb-33bff01b595b')continue;
      const replacements={
        'quesadilla-cilantro':{en:'Approximate; about 1 large or 2 small bunches.',es:'Aproximado; alrededor de 1 manojo grande o 2 pequeños.',cs:'Přibližně; asi 1 velký nebo 2 malé svazky.'},
        'sauce-cilantro':{en:'Measure the chopped herbs packed into the container.',es:'Mide las hierbas picadas compactadas en el recipiente.',cs:'Nasekané bylinky při odměřování upěchuj.'},
        'filling-oil':{en:'Approximate.',es:'Aproximado.',cs:'Přibližně.'},
        'sauce-oil':{en:'Choose within the range.',es:'Elige dentro del rango.',cs:'Vyber množství v uvedeném rozmezí.'},
        'tomato-paste':{en:'Use the stated range in grams.',es:'Usa el rango indicado en gramos.',cs:'Použij uvedené rozmezí v gramech.'},
        'filling-pepper':{en:'Approximate; use the nominal amount.',es:'Aproximado; usa la cantidad nominal.',cs:'Přibližně; použij uvedené množství.'},
      }[ingredient.id];
      if(replacements&&ingredient.notes&&/cup|tablespoon|tbsp|teaspoon|tsp|taza|cuchara|hrnk|hrnek|lžíc|lžic|lžič/i.test(ingredient.notes))ingredient.notes=replacements[locale]||replacements.en;
    }
    if(recipe.id==='e0b8a34c-83ae-4f8f-9cfb-33bff01b595b')for(const source of text.sources||[])if(source.id==='source-spoon-conventions'||/tablespoon|cucharadas|míry lžic/i.test(source.title||''))source.title={en:'Author’s measurement conventions',es:'Convenciones de medida de la autora',cs:'Autorkou používané měrné jednotky'}[locale]||'Author’s measurement conventions';
    if(text.equipment)text.equipment=text.equipment.map(e=>e==='Odměrné lžíce'?'Malá odměrka':e==='Odměrné lžíce a váha'?'Malá odměrka a váha':e);
  }

  const fixes={
    'bramboracka-czech-potato-soup':{celeriac:[100,'g',3.5],butter:[85,'g'],flour:[40,'g',1/3],'mushroom-water':[300,'ml',1.25],'cooking-liquid':[1200,'ml',5],'reserved-mushroom-stock':[240,'ml',1]},
    'cooklikeczechs-chicken-breast-paprikash':{'chicken-breast':[680,'g',1.5],'chicken-broth':[600,'ml',2.5]},
    'cooklikeczechs-czech-bread-dumplings':{flour:[480,'g',11/3],milk:[300,'ml',1.25]},
  }[recipe.id];
  if(recipe.id==='e0b8a34c-83ae-4f8f-9cfb-33bff01b595b'){
    const result=structuredClone(recipe);
    for(const ingredient of result.ingredients||[])if(ingredient.id==='sauce-dairy'&&ingredient.quantity?.unit==='ml'&&ingredient.quantity.value===160&&/cup|taza|hrnk/i.test(ingredient.quantity.text))ingredient.quantity.text='about 160 ml';
    for(const step of result.steps||[])for(const use of step.ingredientUses||[])if(use.ingredientId==='sauce-dairy'&&use.quantity?.unit==='ml'&&use.quantity.value===160&&/cup|taza|hrnk/i.test(use.quantity.text))use.quantity.text='about 160 ml';
    return result;
  }
  if(!fixes)return recipe;
  const result=structuredClone(recipe);
  for(const ingredient of result.ingredients||[]){
    const fix=fixes[ingredient.id],old=ingredient.quantity;
    if(!fix||!old||!['cup_us','lb','oz'].includes(old.unit)&&!(ingredient.id==='butter'&&/stick/.test(old.text)))continue;
    if(fix[2]!==undefined&&(!Number.isFinite(old.value)||Math.abs(old.value-fix[2])>1e-8))continue;
    const expectedUnit=ingredient.id==='celeriac'?'oz':ingredient.id==='chicken-breast'?'lb':'cup_us';
    if(ingredient.id!=='butter'&&old.unit!==expectedUnit)continue;
    if(ingredient.id==='butter'&&old.text!=='¾ stick')continue;
    ingredient.quantity={text:`${fix[0]} ${fix[1]}`,value:fix[0],unit:fix[1]};
    for(const step of result.steps||[])for(const use of step.ingredientUses||[]){
      if(use.ingredientId!==ingredient.id||!use.quantity)continue;
      const q=use.quantity;if(q.unit!==old.unit)continue;
      // Split broth uses sometimes use a different source volume unit; those
      // use the publisher's documented factors during normal conversion.
      const ratio=old.value?q.value/old.value:1;
      if(!Number.isFinite(ratio))continue;
      use.quantity={text:`${fix[0]*ratio} ${fix[1]}`,value:fix[0]*ratio,unit:fix[1]};
    }
  }
  return result;
}
