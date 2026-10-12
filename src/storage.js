import {cleanRecordTitle} from './model.js';
let db;
export async function database() {
  if (db) return db;
  db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('cookstep',2);
    request.onupgradeneeded = () => { for(const name of ['recipes','sessions','sync']) if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Cookstep tabs and try again.'));
  });
  return db;
}
export async function read(store,key) {
  const databaseInstance = await database();
  return new Promise((resolve,reject) => { const r = databaseInstance.transaction(store).objectStore(store)[key === undefined ? 'getAll' : 'get'](key); r.onsuccess = () => {
    const clean=value=>store==='recipes'?cleanRecordTitle(value):store==='sessions'&&value?.record?{...value,record:cleanRecordTitle(value.record)}:value;
    resolve(Array.isArray(r.result)?r.result.map(clean):clean(r.result));
  }; r.onerror = () => reject(r.error); });
}
export async function write(store,record) {
  if(store==='recipes')return changeRecipe(record);
  const databaseInstance = await database();
  return new Promise((resolve,reject) => {
    const t = databaseInstance.transaction(store,'readwrite');
    if (typeof record === 'string') t.objectStore(store).delete(record); else t.objectStore(store).put(record);
    t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Storage transaction was interrupted.'));
  });
}

// Recipe changes and their upload queue commit together, including deletions.
async function transaction(fn) {
  const instance=await database();
  return new Promise((resolve,reject)=>{
    const t=instance.transaction(['recipes','sync'],'readwrite');
    fn(t.objectStore('recipes'),t.objectStore('sync'));
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Storage transaction was interrupted.'));
  });
}
export function changeRecipe(record) {
  if(typeof record!=='string')record=cleanRecordTitle(record);
  return transaction((recipes,queue)=>{
    const id=typeof record==='string'?record:record.id;
    const request=recipes.get(id);
    request.onsuccess=()=>{
      const previous=request.result;
      const queued=queue.get(id);
      queued.onsuccess=()=>{
        const expectedRevision=previous?.cloudRevision??queued.result?.expectedRevision??null;
        if(typeof record==='string')recipes.delete(id);
        else recipes.put({...record,cloudRevision:expectedRevision});
        queue.put({id,operation:typeof record==='string'?'delete':'put',token:crypto.randomUUID(),expectedRevision});
      };
    };
  });
}
export function confirmUpload(operation,revision) {
  return transaction((recipes,queue)=>{
    const request=queue.get(operation.id);
    request.onsuccess=()=>{
      const current=request.result;
      if(!current)return;
      if(current.token===operation.token){
        queue.delete(operation.id);
        const record=recipes.get(operation.id);
        record.onsuccess=()=>{if(record.result)recipes.put({...record.result,cloudRevision:revision});};
      }else{
        // An import or deletion happened while the previous upload was in flight.
        queue.put({...current,expectedRevision:revision});
        const record=recipes.get(operation.id);
        record.onsuccess=()=>{if(record.result)recipes.put({...record.result,cloudRevision:revision});};
      }
    };
  });
}
export function cacheUpload(operation,key,asset) {
  return transaction((_recipes,queue)=>{
    const request=queue.get(operation.id);
    request.onsuccess=()=>{if(request.result?.token===operation.token)queue.put({...request.result,uploads:{...request.result.uploads,[key]:asset}});};
  });
}
export function applyRemote(meta,record) {
  return transaction((recipes,queue)=>{
    const pending=queue.get(meta.id);
    pending.onsuccess=()=>{if(pending.result)return;
      if(meta.deleted)recipes.delete(meta.id);
      else recipes.put({...record,cloudRevision:meta.revision});
    };
  });
}
export function resolveConflict(operation,copy) {
  return transaction((recipes,queue)=>{
    const pending=queue.get(operation.id);
    pending.onsuccess=()=>{if(pending.result?.token!==operation.token)return;
      queue.delete(operation.id);
      if(copy){recipes.put(copy);queue.put({id:copy.id,operation:'put',token:crypto.randomUUID(),expectedRevision:null});}
    };
  });
}
