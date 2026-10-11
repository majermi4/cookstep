import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,DEFAULT_THEME,THEME_STORAGE_KEY,getTheme,loadTheme,saveTheme,themeStyles} from '../src/themes.js';
test('unknown, corrupt or inaccessible preferences recover to a complete default theme',()=>{
  assert.equal(getTheme('unknown').id,DEFAULT_THEME);
  assert.equal(loadTheme({getItem:()=>'{broken'}).id,DEFAULT_THEME);
  assert.equal(loadTheme({getItem:()=>{throw new Error('Denied');}}).id,DEFAULT_THEME);
  assert.equal(saveTheme(THEMES[1].id,{setItem:()=>{throw new Error('Full');}}),false);
});
test('theme preference uses its own storage key and every theme satisfies the shared token contract',()=>{
  let saved;
  assert.equal(saveTheme(THEMES[2].id,{setItem:(...args)=>saved=args}),true);
  assert.deepEqual(saved,[THEME_STORAGE_KEY,THEMES[2].id]);
  assert.equal(loadTheme({getItem:()=>saved[1]}).id,THEMES[2].id);
  const keys=t=>Object.entries(t.tokens).flatMap(([group,values])=>Object.keys(values).map(k=>group+'.'+k)).sort();
  for(const t of THEMES)assert.deepEqual(keys(t),keys(THEMES[0]));
  assert.equal(new Set(THEMES.map(t=>t.id)).size,4);
  assert.ok(themeStyles().includes(':root,'));
});
