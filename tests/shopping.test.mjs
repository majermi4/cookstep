import {test} from 'node:test';
import assert from 'node:assert/strict';
import {peopleForRecipe,createShoppingList,shoppingQuantity,shoppingText,shoppingProgress} from '../src/shopping.js';

test('shopping keeps sizes and rounds fractional whole purchases up without changing cooking amounts',()=>{
  const ingredient={name:'Tortillas',quantity:{text:'3 tortillas, 20 cm each',value:3,unit:'pieces'},notes:'20 cm diameter'};
  const q=shoppingQuantity(ingredient,.5,'metric');
  assert.equal(q.text,'1.5 pieces');
  assert.ok(q.notes.some(n=>n.includes('Buy at least 2 pieces')));
  assert.ok(q.notes.some(n=>n.includes('20 cm')));
  assert.equal(ingredient.quantity.value,3);
  const range=shoppingQuantity({quantity:{text:'100–200 g',range:{min:100,max:200},unit:'g'}},3,'metric');
  assert.equal(range.text,'300–600 g');
  assert.ok(range.notes.some(n=>n.includes('upper end')));
});
test('shopping leaves qualitative, missing and ambiguous quantities explicit',()=>{
  assert.deepEqual(shoppingQuantity({quantity:{text:'to taste'}},2,'metric'),{text:'to taste',notes:['Not scaled']});
  assert.deepEqual(shoppingQuantity({},1,'metric'),{text:'Amount not specified',notes:['Check the source']});
  assert.ok(shoppingQuantity({quantity:{text:'2 cups',value:2,unit:'cup'}},2,'metric').notes.some(n=>n.includes('unknown')));
});
test('people scaling requires an explicit serving relationship and copied lists include optional checks and notes',()=>{
  const recipe={id:'test',title:'Lunch',yield:{quantity:20,unit:'quesadillas'},servings:10,ingredients:[
    {id:'beef',name:'Beef',quantity:{text:'1 kg',value:1,unit:'kg'},notes:'Lean mince'},
    {id:'salt',name:'Salt',quantity:{text:'to taste'},optional:true}
  ]};
  assert.equal(peopleForRecipe(recipe),10);
  assert.equal(peopleForRecipe({...recipe,servings:undefined}),null);
  assert.equal(peopleForRecipe({...recipe,servings:undefined,yield:{quantity:4,unit:'servings'}}),4);
  const list=createShoppingList(recipe,10,'metric');list.checked=['beef'];
  assert.deepEqual(shoppingProgress(list),{done:1,total:1,optional:0});
  assert.match(shoppingText(list),/10 quesadillas · 5 people/);
  assert.match(shoppingText(list),/\[x\] Beef — 500 g · Lean mince/);
  assert.match(shoppingText(list),/\[ \] Salt — to taste \(optional\)/);
  recipe.ingredients[0].quantity.value=9;
  assert.equal(list.recipe.ingredients[0].quantity.value,1);
});
