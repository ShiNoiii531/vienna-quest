import { identity, questDb, questBucket } from '@/lib/quest-db';
import { missions } from '@/lib/missions';
import { memoryInfo, normalizeMemoryComment, type MemorySummary } from '@/lib/memory-album';
import { PhotoUploadError, readPhotoUpload, validJpeg, validPhotoId } from '@/lib/photo-files';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
type MemoryRow=MemorySummary&{object_key:string;original_key:string;original_content_type:string};
function missionId(request:Request){const id=new URL(request.url).searchParams.get('mission');return missions.some(m=>m.id===id&&m.photoMode==='album')?id:null;}
async function visible(db:D1Database,id:string){const state=await db.prepare('SELECT revealed FROM quest_progress WHERE mission_id=?').bind(id).first<{revealed:number}>();return !state||!!state.revealed;}

export async function GET(request:Request){
  const who=await identity();if(!who)return json({error:'Connexion requise.'},401);
  const id=missionId(request);if(!id)return json({error:'Coffre introuvable.'},404);
  const params=new URL(request.url).searchParams;const photoId=params.get('photo')||'';
  if(!validPhotoId(photoId))return json({error:'Photo introuvable.'},404);
  try{
    const db=questDb();if(!await visible(db,id)&&who.role!=='organizer')return json({error:'Photo introuvable.'},404);
    const row=await db.prepare('SELECT * FROM quest_memories WHERE mission_id=? AND id=?').bind(id,photoId).first<MemoryRow>();
    if(!row)return json({error:'Photo introuvable.'},404);
    const original=params.get('original')==='1';const file=await questBucket().get(original?row.original_key:row.object_key);
    if(!file)return json({error:'Photo indisponible.'},404);
    const name=encodeURIComponent(row.original_name).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(file.body,{headers:{...headers,'Content-Type':original?row.original_content_type:'image/jpeg','Content-Length':String(file.size),'Content-Disposition':original?`attachment; filename="vienna-souvenir-original"; filename*=UTF-8''${name}`:`inline; filename="vienna-souvenir.jpg"`}});
  }catch(error){console.error('memory_read',error);return json({error:'Le souvenir ne peut pas être chargé pour le moment.'},503);}
}

export async function POST(request:Request){
  const who=await identity();if(!who)return json({error:'Connexion requise.'},401);
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Requête refusée.'},403);
  const id=missionId(request);if(!id)return json({error:'Coffre introuvable.'},404);
  const uploadId=request.headers.get('x-photo-id')||'';
  if(!validPhotoId(uploadId))return json({error:'Photo invalide. Choisissez-la de nouveau.'},400);
  if(request.headers.get('content-type')?.split(';')[0]!=='multipart/form-data')return json({error:'Une photo originale et son commentaire sont nécessaires.'},415);
  let db:D1Database|undefined;let bucket:R2Bucket|undefined;let key:string|null=null;let originalKey:string|null=null;
  try{
    db=questDb();bucket=questBucket();
    if(!await visible(db,id))return json({error:'Découvrez cette quête avant d’ajouter un souvenir.'},409);
    const existing=await db.prepare('SELECT * FROM quest_memories WHERE mission_id=? AND id=?').bind(id,uploadId).first<MemoryRow>();
    if(existing)return json({ok:true,photo:memoryInfo(existing)});
    const {bytes,original,comment:rawComment}=await readPhotoUpload(request);
    const comment=normalizeMemoryComment(rawComment);
    if(!comment)return json({error:'Écrivez un commentaire pour cette photo (1 à 1 000 caractères).'},400);
    if(!original||!validJpeg(bytes))return json({error:'La photo originale et son aperçu sont nécessaires.'},415);
    // Per-attempt keys mean retries and simultaneous uploads never overwrite an existing image.
    const attempt=crypto.randomUUID();key=`memories/${id}/${uploadId}/${attempt}.jpg`;originalKey=`memories/${id}/${uploadId}/${attempt}-original.${original.extension}`;
    await bucket.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
    await bucket.put(originalKey,original.bytes,{httpMetadata:{contentType:original.type}});
    const now=new Date().toISOString();
    const results=await db.batch([
      db.prepare('INSERT INTO quest_memories(id,mission_id,comment,object_key,bytes,uploaded_at,original_key,original_content_type,original_bytes,original_name,original_last_modified) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM quest_progress WHERE mission_id=? AND revealed=0) ON CONFLICT(id) DO NOTHING').bind(uploadId,id,comment,key,bytes.length,now,originalKey,original.type,original.bytes.length,original.name,original.lastModified,id),
      db.prepare('INSERT INTO quest_progress(mission_id,revealed,completed,updated_at) SELECT ?,1,0,? WHERE EXISTS (SELECT 1 FROM quest_memories WHERE mission_id=? AND id=?) ON CONFLICT(mission_id) DO UPDATE SET updated_at=excluded.updated_at WHERE quest_progress.revealed=1').bind(id,now,id,uploadId)
    ]);
    if(!results[0].meta.changes){
      await bucket.delete([key,originalKey]);key=null;originalKey=null;
      const row=await db.prepare('SELECT * FROM quest_memories WHERE mission_id=? AND id=?').bind(id,uploadId).first<MemoryRow>();
      if(row&&await visible(db,id))return json({ok:true,photo:memoryInfo(row)});
      return json({error:'La quête a changé pendant l’envoi. Actualisez avant de réessayer.'},409);
    }
    return json({ok:true,photo:memoryInfo({id:uploadId,mission_id:id,comment,uploaded_at:now,original_name:original.name})});
  }catch(error){
    // A commit may have succeeded even if the response failed. Keep any referenced files.
    if(db&&bucket&&key){try{const row=await db.prepare('SELECT object_key FROM quest_memories WHERE id=?').bind(uploadId).first<{object_key:string}>();if(row?.object_key!==key)await bucket.delete([key,...(originalKey?[originalKey]:[])]);}catch{}}
    if(error instanceof RangeError)return json({error:'Maximum : 30 Mo pour l’original et 5 Mo pour l’aperçu.'},413);
    if(error instanceof PhotoUploadError)return json({error:error.message},error.status);
    console.error('memory_save',error);return json({error:'L’enregistrement n’a pas pu être confirmé. Gardez la photo et son commentaire, puis réessayez.'},503);
  }
}

export async function DELETE(request:Request){
  const who=await identity();if(!who)return json({error:'Connexion requise.'},401);
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Requête refusée.'},403);
  const id=missionId(request);if(!id)return json({error:'Coffre introuvable.'},404);
  const photoId=request.headers.get('x-photo-id')||'';if(!validPhotoId(photoId))return json({error:'Photo invalide.'},400);
  try{
    const db=questDb();if(!await visible(db,id)&&who.role!=='organizer')return json({error:'Photo introuvable.'},404);
    const row=await db.prepare('SELECT * FROM quest_memories WHERE mission_id=? AND id=?').bind(id,photoId).first<MemoryRow>();
    if(!row)return json({ok:true});
    const results=await db.batch([
      db.prepare('DELETE FROM quest_memories WHERE mission_id=? AND id=?').bind(id,photoId),
      db.prepare('UPDATE quest_progress SET completed=CASE WHEN EXISTS (SELECT 1 FROM quest_memories WHERE mission_id=?) THEN completed ELSE 0 END,updated_at=? WHERE mission_id=?').bind(id,new Date().toISOString(),id)
    ]);
    if(results[0].meta.changes){try{await questBucket().delete([row.object_key,row.original_key]);}catch(error){console.error('memory_cleanup',error);}}
    return json({ok:true});
  }catch(error){console.error('memory_delete',error);return json({error:'La suppression n’a pas pu être confirmée. Réessayez.'},503);}
}
