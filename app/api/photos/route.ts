import { identity, questDb, questBucket } from '@/lib/quest-db';
import { missions } from '@/lib/missions';
import { photoInfo, PhotoUploadError, readPhotoUpload, validJpeg, validPhotoId } from '@/lib/photo-files';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
type PhotoRow = { mission_id: string; id: string; object_key: string; content_type: string; bytes: number; uploaded_at: string; original_key: string | null; original_content_type: string | null; original_bytes: number | null; original_name: string | null; original_last_modified: number | null };
function missionId(request: Request) { const id = new URL(request.url).searchParams.get('mission'); return missions.some(m => m.id === id && m.photoMode !== 'album') ? id : null; }
async function deleteFiles(bucket: R2Bucket, keys: (string | null)[]) { for (const key of keys) if (key) await bucket.delete(key); }

export async function GET(request: Request) {
  const who = await identity(); if (!who) return json({ error: 'Connexion requise.' }, 401);
  const id = missionId(request); if (!id) return json({ error: 'Étape introuvable.' }, 404);
  try {
    const db = questDb();
    const progress = await db.prepare('SELECT revealed FROM quest_progress WHERE mission_id=?').bind(id).first<{ revealed: number }>();
    if (!progress?.revealed && who.role !== 'organizer') return json({ error: 'Photo introuvable.' }, 404);
    const row = await db.prepare('SELECT * FROM quest_photos WHERE mission_id=?').bind(id).first<PhotoRow>();
    const version = new URL(request.url).searchParams.get('v');
    if (!row || (version && version !== row.id)) return json({ error: 'Photo introuvable.' }, 404);
    const original = new URL(request.url).searchParams.get('original') === '1';
    const key = original ? row.original_key : row.object_key;
    if (!key) return json({ error: 'L’original de cette photo n’a pas été conservé. Choisissez-la de nouveau sur votre téléphone.', }, 404);
    const file = await questBucket().get(key); if (!file) return json({ error: 'Photo indisponible.' }, 404);
    const name = encodeURIComponent(row.original_name || `vienna-${id}`).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(file.body, { headers: { ...headers, 'Content-Type': original ? row.original_content_type || 'application/octet-stream' : 'image/jpeg', 'Content-Length': String(file.size), 'Content-Disposition': original ? `attachment; filename="vienna-${id}-original"; filename*=UTF-8''${name}` : `inline; filename="vienna-${id}.jpg"` } });
  } catch (error) { console.error('photo_read', error); return json({ error: 'La photo ne peut pas être chargée pour le moment.' }, 503); }
}

export async function POST(request: Request) {
  const who = await identity(); if (!who) return json({ error: 'Connexion requise.' }, 401);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Requête refusée.' }, 403);
  const id = missionId(request); if (!id) return json({ error: 'Étape introuvable.' }, 404);
  const uploadId = request.headers.get('x-photo-id') || '';
  const previous = request.headers.get('x-previous-photo') || '';
  if (!validPhotoId(uploadId) || (previous && !validPhotoId(previous))) return json({ error: 'Photo invalide. Choisissez-la de nouveau.' }, 400);
  if (!['image/jpeg', 'multipart/form-data'].includes(request.headers.get('content-type')?.split(';')[0] || '')) return json({ error: 'Une photo et son original sont attendus.' }, 415);
  let db: D1Database | undefined; let bucket: R2Bucket | undefined; const key = `quests/${id}/${uploadId}.jpg`;
  let attempted = false; let originalKey: string | null = null;
  try {
    db = questDb(); bucket = questBucket();
    const progress = await db.prepare('SELECT revealed,completed FROM quest_progress WHERE mission_id=?').bind(id).first<{ revealed: number; completed: number }>();
    if (!progress?.revealed) return json({ error: 'Découvrez cette quête avant de la photographier.' }, 409);
    const old = await db.prepare('SELECT * FROM quest_photos WHERE mission_id=?').bind(id).first<PhotoRow>();
    if (old?.id === uploadId) return json({ ok: true, photo: photoInfo(id, old), completed: !!progress.completed });
    if ((old?.id || '') !== previous) return json({ error: 'Cette photo a changé sur l’autre téléphone. Fermez puis rouvrez la quête.' }, 409);
    const { bytes, original } = await readPhotoUpload(request);
    if (!validJpeg(bytes)) return json({ error: 'Cette image ne peut pas être enregistrée. Choisissez une autre photo.' }, 415);
    originalKey = original ? `quests/${id}/${uploadId}-original.${original.extension}` : null;
    attempted = true;
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
    if (original && originalKey) await bucket.put(originalKey, original.bytes, { httpMetadata: { contentType: original.type } });
    const now = new Date().toISOString();
    const originalFields = [originalKey, original?.type || null, original?.bytes.length ?? null, original?.name || null, original?.lastModified ?? null];
    const newPhoto = { id: uploadId, uploaded_at: now, original_key: originalKey, original_name: original?.name || null };
    const save = old
      ? db.prepare('UPDATE quest_photos SET id=?,object_key=?,content_type=?,bytes=?,uploaded_at=?,original_key=?,original_content_type=?,original_bytes=?,original_name=?,original_last_modified=? WHERE mission_id=? AND id=? AND EXISTS (SELECT 1 FROM quest_progress WHERE mission_id=? AND revealed=1)').bind(uploadId, key, 'image/jpeg', bytes.length, now, ...originalFields, id, previous, id)
      : db.prepare('INSERT INTO quest_photos(mission_id,id,object_key,content_type,bytes,uploaded_at,original_key,original_content_type,original_bytes,original_name,original_last_modified) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM quest_progress WHERE mission_id=? AND revealed=1) ON CONFLICT(mission_id) DO NOTHING').bind(id, uploadId, key, 'image/jpeg', bytes.length, now, ...originalFields, id);
    const result = await db.batch([save, db.prepare('UPDATE quest_progress SET completed=1,updated_at=? WHERE mission_id=? AND revealed=1 AND EXISTS (SELECT 1 FROM quest_photos WHERE mission_id=? AND id=?)').bind(now, id, id, uploadId)]);
    if (!result[0].meta.changes) {
      const current = await db.prepare('SELECT * FROM quest_photos WHERE mission_id=?').bind(id).first<PhotoRow>();
      if (current?.id !== uploadId) await deleteFiles(bucket, [key, originalKey]);
      if (current?.id === uploadId) return json({ ok: true, photo: photoInfo(id, current), completed: true });
      return json({ error: 'La quête a changé pendant l’envoi. Votre photo n’a pas été validée ; réessayez après actualisation.' }, 409);
    }
    if (old) { try { await deleteFiles(bucket, [old.object_key, old.original_key]); } catch (error) { console.error('photo_old_cleanup', error); } }
    return json({ ok: true, photo: photoInfo(id, newPhoto), completed: true });
  } catch (error) {
    // A failed response may follow a committed transaction. Never delete the active image.
    if (attempted && db && bucket) { try { const current = await db.prepare('SELECT id FROM quest_photos WHERE mission_id=?').bind(id).first<{ id: string }>(); if (current?.id !== uploadId) await deleteFiles(bucket, [key, originalKey]); } catch {} }
    if (error instanceof RangeError) return json({ error: 'La photo dépasse la taille autorisée : 30 Mo pour l’original, 5 Mo pour l’aperçu.' }, 413);
    if (error instanceof PhotoUploadError) return json({ error: error.message }, error.status);
    console.error('photo_save', error); return json({ error: 'L’enregistrement n’a pas pu être confirmé. Gardez cette photo et réessayez.' }, 503);
  }
}

export async function DELETE(request: Request) {
  const who = await identity(); if (!who) return json({ error: 'Connexion requise.' }, 401);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Requête refusée.' }, 403);
  const id = missionId(request); if (!id) return json({ error: 'Étape introuvable.' }, 404);
  const photoId = request.headers.get('x-photo-id') || ''; if (!validPhotoId(photoId)) return json({ error: 'Photo invalide.' }, 400);
  try {
    const db = questDb();
    const progress = await db.prepare('SELECT revealed FROM quest_progress WHERE mission_id=?').bind(id).first<{ revealed: number }>();
    if (!progress?.revealed && who.role !== 'organizer') return json({ error: 'Photo introuvable.' }, 404);
    const row = await db.prepare('SELECT * FROM quest_photos WHERE mission_id=? AND id=?').bind(id, photoId).first<PhotoRow>();
    if (!row) return json({ error: 'Cette photo a déjà changé. Actualisez la quête.' }, 409);
    const results = await db.batch([
      db.prepare('DELETE FROM quest_photos WHERE mission_id=? AND id=?').bind(id, photoId),
      db.prepare('UPDATE quest_progress SET completed=0,updated_at=? WHERE mission_id=? AND NOT EXISTS (SELECT 1 FROM quest_photos WHERE mission_id=?)').bind(new Date().toISOString(), id, id)
    ]);
    if (!results[0].meta.changes) return json({ error: 'Cette photo a déjà changé. Actualisez la quête.' }, 409);
    try { await deleteFiles(questBucket(), [row.object_key, row.original_key]); } catch (error) { console.error('photo_deleted_cleanup', error); }
    return json({ ok: true });
  } catch (error) { console.error('photo_delete', error); return json({ error: 'La suppression n’a pas pu être confirmée. Réessayez.' }, 503); }
}
