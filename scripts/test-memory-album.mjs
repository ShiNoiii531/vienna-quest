// Isolated integration checks: real route code + migrations, in-memory SQLite/R2 only.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'package.json'));
const sqlite=new DatabaseSync(':memory:');
const journal=JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8'));
for(const entry of journal.entries.slice(0,3))sqlite.exec(readFileSync(resolve(root,'drizzle',entry.tag+'.sql'),'utf8'));
sqlite.exec("INSERT INTO quest_photos(mission_id,id,object_key,content_type,bytes,uploaded_at,original_key) VALUES ('m16','legacy-id','legacy-preview','image/jpeg',100,'2026-10-15','legacy-original'); INSERT INTO quest_progress VALUES ('m16',1,1,'2026-10-15');");
const legacy=sqlite.prepare('SELECT * FROM quest_photos').all();
for(const entry of journal.entries.slice(3))sqlite.exec(readFileSync(resolve(root,'drizzle',entry.tag+'.sql'),'utf8'));
assert.deepEqual(sqlite.prepare('SELECT * FROM quest_photos').all(),legacy);
let afterCommitFailure=false;
class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args;}
  bind(...args){return new Statement(this.sql,args);}
  execute(){const stmt=sqlite.prepare(this.sql);if(/^SELECT/i.test(this.sql))return {results:stmt.all(...this.args),meta:{changes:0}};const r=stmt.run(...this.args);return {results:[],meta:{changes:Number(r.changes)}};}
  async run(){return this.execute();}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
}
const db={prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');let results;try{results=statements.map(s=>s.execute());sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}if(afterCommitFailure){afterCommitFailure=false;throw new Error('Simulated response failure after commit');}return results;}};
const objects=new Map();
const bucket={async put(key,bytes,options){objects.set(key,{bytes:Uint8Array.from(bytes),options});},async get(key){const value=objects.get(key);return value?{body:value.bytes,size:value.bytes.length}:null;},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);}};
let role='organizer';
const cache=new Map();
function load(relative){
  const file=resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(name=>{
    if(name==='@/lib/quest-db')return {questDb:()=>db,questBucket:()=>bucket,identity:async()=>role?{role,user:{email:'test@example.invalid'}}:null};
    if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
    if(name.startsWith('.'))return load(resolve(dirname(file),name+'.ts'));
    return require(name);
  },module,module.exports);return module.exports;
}
const album=load('app/api/memories/route.ts'),journey=load('app/api/journey/route.ts'),single=load('app/api/photos/route.ts');
const {missions}=load('lib/missions.ts');const {normalizeMemoryComment}=load('lib/memory-album.ts');
assert(!missions.some(m=>m.id==='m17'||(!m.optional&&m.order===16)));
assert.equal(missions.find(m=>m.id==='m14').order,17);
assert.equal(missions.find(m=>m.id==='m18').day,5);
assert.equal(missions.filter(m=>!m.optional).length,17);
assert.equal(new Set(missions.map(m=>m.id)).size,missions.length);
for(const value of [null,undefined,'','   ','\n\t','\u00a0','x'.repeat(1001)])assert.equal(normalizeMemoryComment(value),null);
assert.equal(normalizeMemoryComment('  Notre souvenir ♥  '),'Notre souvenir ♥');
const preview=new Uint8Array(120);preview.set([255,216,255,192,0,17,8,0,1,0,1,3,1,17,0,2,17,0,3,17,0,255,218]);preview.set([255,217],118);
// A byte fixture exercises original retention without using personal photos.
const original=new Uint8Array(48);original.set([137,80,78,71,13,10,26,10]);original.set([73,72,68,82],12);original.set([69,88,73,70,1,2,3,4],24);
const base='https://example.invalid/api/memories?mission=m18';
const get=()=>new Request('https://example.invalid/api/journey');
function upload(comment,id=crypto.randomUUID(),mission='m18',extra={}){const form=new FormData();form.append('preview',new Blob([preview],{type:'image/jpeg'}),'preview.jpg');form.append('original',new File([original],'souvenir.png',{type:'image/png'}));form.append('lastModified','1792220000000');if(comment!==undefined)form.append('comment',comment);return {id,request:new Request('https://example.invalid/api/memories?mission='+mission,{method:'POST',headers:{'x-photo-id':id,...extra},body:form})};}
const complete=()=>new Request('https://example.invalid/api/journey',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'m18',action:'complete',value:true})});
const readPhoto=id=>new Request(base+'&photo='+id);
const remove=id=>new Request(base,{method:'DELETE',headers:{'x-photo-id':id}});
let checks=0;async function status(response,expected){assert.equal(response.status,expected,await response.clone().text());checks++;return response;}

role=null;await status(await album.POST(upload('hello').request),401);await status(await album.GET(readPhoto(crypto.randomUUID())),401);role='explorer';
let state=await (await journey.GET(get())).json();assert(state.missions.find(m=>m.id==='m18').revealed);assert.deepEqual(state.missions.find(m=>m.id==='m18').memories,[]);
await status(await journey.POST(complete()),409);
for(const comment of [undefined,'','   ','\n\t','x'.repeat(1001)])await status(await album.POST(upload(comment).request),400);
assert.equal(objects.size,0);
await status(await album.POST(upload('hello',crypto.randomUUID(),'m18',{'sec-fetch-site':'cross-site'}).request),403);
await status(await album.POST(upload('hello',crypto.randomUUID(),'m01').request),404);
await status(await single.POST(upload('hello').request),404);
const first=upload('  Notre premier souvenir  ');await status(await album.POST(first.request),200);
const second=upload('Une autre photo, une autre histoire');await status(await album.POST(second.request),200);
assert.equal(objects.size,4);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM quest_memories').get().n,2);
await status(await album.POST(upload('Notre premier souvenir',first.id).request),200);assert.equal(objects.size,4);
state=await (await journey.GET(get())).json();let mission=state.missions.find(m=>m.id==='m18');assert.equal(mission.memories.length,2);assert.equal(mission.memories[0].comment,'Notre premier souvenir');assert(!mission.completed);
const download=await status(await album.GET(new Request(base+'&photo='+first.id+'&original=1')),200);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),original);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.match(download.headers.get('cache-control'),/private/);
await status(await journey.POST(complete()),200);
const third=upload('Encore un souvenir après validation');await status(await album.POST(third.request),200);assert.equal(sqlite.prepare("SELECT completed FROM quest_progress WHERE mission_id='m18'").get().completed,1);
await status(await album.DELETE(remove(second.id)),200);assert.equal(objects.size,4);assert.equal(sqlite.prepare("SELECT completed FROM quest_progress WHERE mission_id='m18'").get().completed,1);
await status(await album.GET(readPhoto(second.id)),404);
sqlite.exec("UPDATE quest_progress SET revealed=0 WHERE mission_id='m18'");
await status(await album.GET(readPhoto(first.id)),404);await status(await album.POST(upload('hidden').request),409);await status(await journey.POST(complete()),409);
state=await (await journey.GET(get())).json();assert.deepEqual(state.missions.find(m=>m.id==='m18').memories,[]);assert.equal(state.missions.find(m=>m.id==='m18').photo,null);
sqlite.exec("UPDATE quest_progress SET revealed=1 WHERE mission_id='m18'");
const committed=upload('La sauvegarde malgré une réponse interrompue');afterCommitFailure=true;
const quiet=console.error;console.error=()=>{};try{await status(await album.POST(committed.request),503);}finally{console.error=quiet;}
assert.equal(objects.size,6);await status(await album.POST(upload('La sauvegarde malgré une réponse interrompue',committed.id).request),200);assert.equal(objects.size,6);
await status(await album.DELETE(remove(first.id)),200);await status(await album.DELETE(remove(third.id)),200);await status(await album.DELETE(remove(committed.id)),200);
assert.equal(objects.size,0);assert.equal(sqlite.prepare("SELECT completed FROM quest_progress WHERE mission_id='m18'").get().completed,0);
await status(await journey.POST(complete()),409);
const parallelA=upload('Le souvenir de Joueur 1'),parallelB=upload('Le souvenir de Joueur 2');
for(const response of await Promise.all([album.POST(parallelA.request),album.POST(parallelB.request)]))await status(response,200);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM quest_memories').get().n,2);assert.equal(objects.size,4);
await status(await album.DELETE(new Request(base,{method:'DELETE',headers:{'x-photo-id':parallelA.id,'sec-fetch-site':'cross-site'}})),403);
role=null;await status(await album.DELETE(remove(parallelA.id)),401);role='explorer';
await status(await album.DELETE(remove(parallelA.id)),200);await status(await album.DELETE(remove(parallelB.id)),200);
assert.equal(objects.size,0);
assert.deepEqual(sqlite.prepare('SELECT * FROM quest_photos').all(),legacy);
assert.equal(sqlite.prepare("SELECT completed FROM quest_progress WHERE mission_id='m16'").get().completed,1);
sqlite.close();console.log(`Album checks passed: ${checks} HTTP assertions, migrations, comment validation, preserved originals, retries, visibility and legacy data.`);
