let db;
export async function database() {
  if (db) return db;
  db = await new Promise((resolve,reject) => {
    const request = indexedDB.open('cookstep',1);
    request.onupgradeneeded = () => { request.result.createObjectStore('recipes',{keyPath:'id'}); request.result.createObjectStore('sessions',{keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Cookstep tabs and try again.'));
  });
  return db;
}
export async function read(store,key) {
  const databaseInstance = await database();
  return new Promise((resolve,reject) => { const r = databaseInstance.transaction(store).objectStore(store)[key === undefined ? 'getAll' : 'get'](key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function write(store,record) {
  const databaseInstance = await database();
  return new Promise((resolve,reject) => {
    const t = databaseInstance.transaction(store,'readwrite');
    if (typeof record === 'string') t.objectStore(store).delete(record); else t.objectStore(store).put(record);
    t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Storage transaction was interrupted.'));
  });
}
