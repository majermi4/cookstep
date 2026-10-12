import {read,write,confirmUpload,cacheUpload,applyRemote,resolveConflict} from './storage.js';

export function createLibrarySync({changed=()=>{},status=()=>{},notice=()=>{}}={}) {
  let running=null,again=false;
  async function request(path,options={}) {
    const response=await fetch('/api/library'+path,{...options,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(30000)});
    if(!response.ok){let message='Could not connect to cloud storage.';try{message=(await response.json()).error||message;}catch{}
      const error=new Error(message);error.status=response.status;throw error;}
    return response;
  }
  const send=(path,method,data)=>request(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
  const recordPath=id=>'/recipes/'+encodeURIComponent(id);
  async function download(meta) {
    const data=await request(recordPath(meta.id)).then(r=>r.json());
    const assets={};
    for(const [id,asset] of Object.entries(data.assets||{}))assets[id]=await request('/assets?key='+encodeURIComponent(asset.key)).then(r=>r.blob());
    return {...data,assets,cloudRevision:data.revision};
  }
  async function run() {
    status({state:'syncing',message:'Syncing recipes…'});
    try{
      let remote=(await request('').then(r=>r.json())).records;
      // Bring libraries saved before cloud storage into the durable upload queue.
      const pending=new Map((await read('sync')).map(op=>[op.id,op]));
      const known=new Map(remote.map(meta=>[meta.id,meta]));
      for(const record of await read('recipes')){
        if(!record.cloudRevision&&!pending.has(record.id)&&!known.has(record.id))await write('recipes',record);
      }
      for(const operation of await read('sync')) {
        const meta=known.get(operation.id);
        if(meta?.revision===operation.token){await confirmUpload(operation,meta.revision);continue;}
        const record=await read('recipes',operation.id);
        if((meta?.revision??null)!==operation.expectedRevision){
          let copy=null;
          if(operation.operation==='put'&&record){const id=crypto.randomUUID();copy={...record,id,cloudRevision:null,recipe:{...record.recipe,id}};}
          await resolveConflict(operation,copy);
          notice(copy?'A recipe changed on another device. Both versions were kept.':'A recipe changed on another device, so it was kept. Remove it again if needed.');
          again=true;continue;
        }
        let result;
        if(operation.operation==='delete')result=await send(recordPath(operation.id),'DELETE',{expectedRevision:operation.expectedRevision,mutationId:operation.token});
        else{
          if(!record)continue;
          const assets={...operation.uploads};
          for(const [id,blob] of Object.entries(record.assets||{})){
            if(assets[id])continue;
            assets[id]=await request('/assets',{method:'POST',headers:{'Content-Type':blob.type},body:blob}).then(r=>r.json());
            await cacheUpload(operation,id,assets[id]);
          }
          result=await send(recordPath(operation.id),'PUT',{recipe:record.recipe,savedAt:record.savedAt,assets,expectedRevision:operation.expectedRevision,mutationId:operation.token});
        }
        await confirmUpload(operation,result.revision);
      }
      remote=(await request('').then(r=>r.json())).records;
      const local=new Map((await read('recipes')).map(record=>[record.id,record]));
      const dirty=new Set((await read('sync')).map(op=>op.id));
      for(const meta of remote){
        if(dirty.has(meta.id))continue;
        if(meta.deleted){await applyRemote(meta);continue;}
        if(local.get(meta.id)?.cloudRevision===meta.revision)continue;
        const record=await download(meta);
        // A replacement may happen during download; the storage layer checks again.
        await applyRemote({...meta,revision:record.cloudRevision},record);
      }
      await changed();
      const count=(await read('sync')).length;
      status({state:count?'pending':'synced',message:count?`${count} change${count===1?'':'s'} waiting to sync`:'Recipes synced across devices',pending:count});
    }catch(error){
      let count=0;try{await changed();count=(await read('sync')).length;}catch{}
      status({state:error.status===401?'signin':'error',message:error.status===401?'Sign in to sync recipes':count?`Saved on this device · ${count} change${count===1?'':'s'} waiting to upload`:'Cloud unavailable · showing saved recipes',detail:error.message,pending:count});
      // A concurrent write requested another pass; retries after failure wait for
      // the next explicit request or connection/visibility event.
      again=false;
    }
  }
  function sync() {
    if(running){again=true;return running;}
    running=(async()=>{do{again=false;await run();}while(again);})().finally(()=>{running=null;});
    return running;
  }
  return {sync};
}
