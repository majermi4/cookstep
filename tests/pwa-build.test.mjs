import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPwa} from '../scripts/build-pwa.mjs';

test('offline versions are deterministic and detect CSS, module and nested asset changes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cookstep-pwa-'));
  try{
    await mkdir(directory+'/fonts');await mkdir(directory+'/guide');
    await writeFile(directory+'/index.html','<html>Cookstep</html>');await writeFile(directory+'/app.js','import "./model.js"');await writeFile(directory+'/model.js','export const a=1');await writeFile(directory+'/styles.css','body{}');await writeFile(directory+'/fonts/a.woff2','font');await writeFile(directory+'/guide/index.html','guide');
    const build=async()=>{await buildPwa(directory);return readFile(directory+'/sw.js','utf8');};
    let previous=await build();assert.equal(await build(),previous);assert.ok(previous.includes('/fonts/a.woff2'));assert.ok(!previous.includes('/guide/index.html'));assert.ok(!previous.includes('"/sw.js"'));
    for(const path of ['styles.css','model.js','fonts/a.woff2']){
      await writeFile(directory+'/'+path,'changed');const next=await build();assert.notEqual(next.match(/const VERSION = (.*);/)[1],previous.match(/const VERSION = (.*);/)[1]);previous=next;
    }
    await writeFile(directory+'/guide/index.html','new guide');assert.equal(await build(),previous);
  }finally{await rm(directory,{recursive:true,force:true});}
});
