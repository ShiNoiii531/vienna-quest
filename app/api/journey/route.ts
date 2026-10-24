import { z } from 'zod';
import { identity, questDb } from '@/lib/quest-db';
import { missions, hotel, travel, currentMissionDetails } from '@/lib/missions';
import type { Mission, QuestMemory } from '@/lib/quest-types';
import { photoInfo } from '@/lib/photo-files';
import { memoryInfo, type MemorySummary } from '@/lib/memory-album';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const detailsSchema=z.object({title:z.string().trim().min(1).max(100),time:z.string().trim().max(100),address:z.string().trim().max(250),description:z.string().trim().max(1400),booking:z.enum(['free','planned','booked','choose']),link:z.string().max(700).refine(v=>!v||(/^https:\/\//i.test(v)&&(()=>{try{new URL(v);return true}catch{return false}})()),'Lien HTTPS attendu'),note:z.string().max(700)});
export async function GET(request:Request){
 const who=await identity();if(!who)return json({error:'Connectez-vous à ChatGPT pour retrouver votre aventure.'},401);
 try{
 const db=questDb();const [p,d,f,a]=await db.batch([db.prepare('SELECT * FROM quest_progress'),db.prepare('SELECT * FROM quest_details'),db.prepare('SELECT mission_id,id,uploaded_at,original_key,original_name FROM quest_photos'),db.prepare('SELECT id,mission_id,comment,uploaded_at,original_name FROM quest_memories ORDER BY uploaded_at,id')]);
 const photos=new Map(f.results.map((r:any)=>[r.mission_id,photoInfo(r.mission_id,r)]));
 const albums=new Map<string,QuestMemory[]>();
 for(const row of a.results as MemorySummary[]){const list=albums.get(row.mission_id)||[];list.push(memoryInfo(row));albums.set(row.mission_id,list);}
 const progress=new Map(p.results.map((r:any)=>[r.mission_id,r]));const details=new Map(d.results.map((r:any)=>[r.mission_id,r]));
 const explorer=who.role!=='organizer'||new URL(request.url).searchParams.get('view')==='explorer';
 const result=missions.map(m=>{const state:any=progress.get(m.id);const override=currentMissionDetails(m,details.get(m.id));const full={...m,...override,note:override.note||'',revealed:state?!!state.revealed:!!m.optional||m.photoMode==='album',completed:!!state?.completed,photo:photos.get(m.id)||null,memories:m.photoMode==='album'?albums.get(m.id)||[]:[]};if(!explorer||full.revealed)return full;return {...full,title:m.teaser,description:'La destination sera dévoilée par Joueur 1 au moment choisi.',time:'Une surprise vous attend',duration:'',address:'',link:'',linkLabel:'',booking:'free',kind:'walk',note:'',photo:null,memories:[]} satisfies Mission;});
 const times=[...p.results,...d.results].map((r:any)=>r.updated_at as string).sort();
 return json({role:who.role,viewerName:who.role==='organizer'?'Joueur 1':'Joueur 2',missions:result,hotel,travel,updatedAt:times.at(-1)||'2026-10-11T20:50:06Z'});
 }catch(e){console.error('journey_load',e);return json({error:'Le carnet ne peut pas être chargé. Réessayez dans un instant.'},503);}
}
export async function POST(request:Request){
 const who=await identity();if(!who)return json({error:'Connexion requise.'},401);
 if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Requête refusée.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Format non pris en charge.'},415);
 let body:any;try{body=await request.json()}catch{return json({error:'Demande invalide.'},400)}
 const m=missions.find(m=>m.id===body.id);if(!m)return json({error:'Étape introuvable.'},404);
 if(!['reveal','complete','edit'].includes(body.action))return json({error:'Action invalide.'},400);
 if(body.action!=='complete'&&who.role!=='organizer')return json({error:'Cette action est réservée à Joueur 1.'},403);
 try{const db=questDb();const now=new Date().toISOString();
 if(body.action==='edit'){
 const v=detailsSchema.safeParse(body.details);if(!v.success)return json({error:'Vérifiez le titre, la longueur des champs et le lien HTTPS.'},400);
 if(m.kind==='food'&&v.data.link){const host=new URL(v.data.link).hostname;if(!/(^|\.)tripadvisor\.(fr|com|at|co\.uk)$/.test(host))return json({error:'Pour une table, ajoutez son lien Tripadvisor.'},400)}
 await db.prepare('INSERT INTO quest_details(mission_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(mission_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(m.id,JSON.stringify(v.data),now).run();
 }else{
 if(typeof body.value!=='boolean')return json({error:'Valeur invalide.'},400);
 if(body.action==='reveal'){
 await db.prepare('INSERT INTO quest_progress(mission_id,revealed,completed,updated_at) VALUES (?,?,0,?) ON CONFLICT(mission_id) DO UPDATE SET revealed=excluded.revealed,completed=CASE WHEN excluded.revealed=0 THEN 0 ELSE quest_progress.completed END,updated_at=excluded.updated_at').bind(m.id,Number(body.value),now).run();
 }else{
 const result=m.photoMode==='album'
   ? await db.prepare("INSERT INTO quest_progress(mission_id,revealed,completed,updated_at) SELECT ?,1,?,? WHERE (?=0 OR (EXISTS (SELECT 1 FROM quest_memories WHERE mission_id=?) AND NOT EXISTS (SELECT 1 FROM quest_memories WHERE mission_id=? AND length(trim(comment))=0))) ON CONFLICT(mission_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at WHERE quest_progress.revealed=1").bind(m.id,Number(body.value),now,Number(body.value),m.id,m.id).run()
   : m.optional
   ? await db.prepare('INSERT INTO quest_progress(mission_id,revealed,completed,updated_at) VALUES (?,1,?,?) ON CONFLICT(mission_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at WHERE quest_progress.revealed=1').bind(m.id,Number(body.value),now).run()
   : await db.prepare('UPDATE quest_progress SET completed=?,updated_at=? WHERE mission_id=? AND revealed=1 AND (?=0 OR EXISTS (SELECT 1 FROM quest_photos WHERE mission_id=?))').bind(Number(body.value),now,m.id,Number(body.value),m.id).run();
 if(!result.meta.changes)return json({error:m.photoMode==='album'?'Ajoutez au moins une photo avec son commentaire et gardez le coffre dévoilé avant de le sceller.':m.optional?'Dévoilez cette quête avant de la valider.':'Dévoilez cette quête et ajoutez une photo avant de la valider.'},409);
 }}
 return json({ok:true,updatedAt:now});
 }catch(e){console.error('journey_save',e);return json({error:'La modification n’a pas été enregistrée. Réessayez.'},503);}
}
