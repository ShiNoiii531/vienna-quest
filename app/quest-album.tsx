'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Check, Trash2, LoaderCircle, X, Download, BookHeart } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { preparePhoto, type PhotoDraft } from './quest-photo';
import { MAX_MEMORY_COMMENT, normalizeMemoryComment } from '@/lib/memory-album';
import type { Mission, QuestMemory } from '@/lib/quest-types';
export type MemoryDraft=PhotoDraft&{comment:string};
type Props={mission:Mission;open:boolean;onOpenChange:(open:boolean)=>void;portrait:boolean;readOnly:boolean;busy:boolean;online:boolean;onSave:(draft:MemoryDraft)=>Promise<void>;onDelete:(id:string)=>Promise<void>;onComplete:()=>Promise<void>};

export default function QuestAlbum({mission,open,onOpenChange:setOpen,portrait,readOnly,busy,online,onSave,onDelete,onComplete}:Props){
  const camera=useRef<HTMLInputElement>(null),gallery=useRef<HTMLInputElement>(null);
  const [queue,setQueue]=useState<File[]>([]),[draft,setDraft]=useState<PhotoDraft|null>(null);
  const [comment,setComment]=useState(''),[error,setError]=useState(''),[preparing,setPreparing]=useState(false);
  const [viewId,setViewId]=useState<string|null>(null),[remove,setRemove]=useState<QuestMemory|null>(null);
  const [discard,setDiscard]=useState(false);
  const mounted=useRef(true),sequence=useRef(0),saving=useRef(false);
  const photos=mission.memories||[];const viewing=photos.find(p=>p.id===viewId);
  const disabled=busy||preparing||readOnly||!online;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;};},[]);
  useEffect(()=>()=>{if(draft)URL.revokeObjectURL(draft.url);},[draft]);
  async function prepare(file:File){
    const version=++sequence.current;setPreparing(true);setError('');setDraft(null);setComment('');
    try{const blob=await preparePhoto(file);if(mounted.current&&version===sequence.current)setDraft({blob,original:file,url:URL.createObjectURL(blob),id:crypto.randomUUID(),previousId:''});}
    catch(e){if(mounted.current&&version===sequence.current)setError(e instanceof Error?e.message:'La photo ne peut pas être ouverte.');}
    finally{if(mounted.current&&version===sequence.current)setPreparing(false);}
  }
  function choose(event:ChangeEvent<HTMLInputElement>){
    const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length||disabled||saving.current)return;
    setQueue(files);setViewId(null);setOpen(true);void prepare(files[0]);
  }
  function advance(){
    const next=queue.slice(1);setQueue(next);setDraft(null);setComment('');setError('');
    if(next.length)void prepare(next[0]);
  }
  async function save(){
    const value=normalizeMemoryComment(comment);
    if(!draft||disabled||saving.current)return;
    if(!value){setError('Écrivez un commentaire pour cette photo avant de l’enregistrer.');return;}
    saving.current=true;setError('');
    try{await onSave({...draft,comment:value});if(mounted.current)advance();}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Enregistrement impossible. Votre photo et votre commentaire restent disponibles.');}
    finally{saving.current=false;}
  }
  function close(){if(busy||preparing||saving.current)return;if(queue.length){setDiscard(true);return;}setOpen(false);setViewId(null);setError('');}
  const savedCount=photos.length;
  return <>
    {/* Inputs and drafts stay mounted when the native camera rotates the phone. */}
    <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Photographier un souvenir" onChange={choose}/>
    <input ref={gallery} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choisir plusieurs photos souvenirs" onChange={choose}/>
    <Dialog open={open&&!portrait} onOpenChange={value=>{if(!value)close();}}><DialogContent className="quest-dialog photo-dialog album-dialog" showCloseButton={false} onInteractOutside={event=>{if(queue.length||busy||preparing)event.preventDefault();}} onEscapeKeyDown={event=>{if(busy||preparing)event.preventDefault();}}>
      <div className="photo-dialog-title"><div><DialogTitle>{viewing?'Un fragment de notre aventure':queue.length?'Donnez une voix à cette photo':'Le coffre des souvenirs'}</DialogTitle><DialogDescription>{viewing?'Photo et commentaire conservés ensemble.':queue.length?`${queue.length} photo${queue.length>1?'s':''} à raconter · chaque enregistrement ajoute un souvenir.`:'Joueur 1 + Joueur 2 · épilogue du 17 octobre 2026'}</DialogDescription></div><button className="photo-close" disabled={busy||preparing} onClick={close} aria-label="Fermer le souvenir"><X size={21}/></button></div>
    {!queue.length&&!viewing?<section className="album-card" aria-label="Galerie du coffre">
    <div className="photo-callout"><BookHeart size={30}/><div><strong>{savedCount} souvenir{savedCount>1?'s':''} dans le coffre</strong><p>Une photo, une anecdote. Les souvenirs de Joueur 1 et Joueur 2 se retrouvent ici.</p></div></div>
    {!readOnly&&<div className="album-buttons">
      {queue.length?<button className="primary" disabled={busy||preparing} onClick={()=>setOpen(true)}><ImagePlus size={18}/>Reprendre les photos en attente ({queue.length})</button>:<><button className="primary" disabled={disabled} onClick={()=>gallery.current?.click()}><ImagePlus size={18}/>Ajouter des photos</button><button className="photo-secondary" disabled={disabled} onClick={()=>camera.current?.click()}><Camera size={18}/>Prendre une photo</button></>}
      <p className="muted">Sélection multiple possible. Chaque photo demande son propre commentaire avant l’enregistrement. Les originaux et les métadonnées transmis par le téléphone sont conservés.</p>
    </div>}
    {!!savedCount&&<div className="album-grid">{photos.map((photo,index)=><figure key={photo.id}>
      <button className="album-thumbnail" onClick={()=>{setViewId(photo.id);setOpen(true);setError('');}} aria-label={`Voir le souvenir ${index+1}`}><img src={photo.url} alt={photo.comment} loading="lazy"/></button>
      <figcaption>{photo.comment}</figcaption>
    </figure>)}</div>}
    {!readOnly&&<button className={'complete-control '+(mission.completed?'checked':'')} disabled={disabled||!!queue.length||!savedCount} onClick={()=>{setError('');void onComplete().catch(e=>setError(e instanceof Error?e.message:'Validation impossible.'));}} aria-pressed={mission.completed}><Check size={18}/>{mission.completed?'Coffre scellé · remettre à faire':'Sceller nos souvenirs · valider la quête'}</button>}
    {mission.completed&&<p className="muted">Quête terminée : vous pouvez toujours ajouter d’autres photos commentées.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    </section>:<div className="photo-layout">
        <div className="photo-stage">{viewing||draft?<img src={viewing?.url||draft?.url} alt={viewing?.comment||'Aperçu de la photo à commenter'}/>:<div className="photo-placeholder"><Camera size={40}/><p>{preparing?'Préparation…':'Cette photo ne peut pas être affichée.'}</p></div>}</div>
        <div className="photo-actions">
          {viewing?<><p className="memory-comment">{viewing.comment}</p>{viewing.originalUrl&&<a className="photo-secondary" href={viewing.originalUrl} download><Download size={18}/>Télécharger l’original</a>}<button className="photo-secondary" onClick={()=>{setViewId(null);setError('');}}>Revenir au coffre</button>{!readOnly&&<button className="subtle photo-remove" disabled={disabled} onClick={()=>setRemove(viewing)}><Trash2 size={16}/>Supprimer ce souvenir</button>}</>:<>
            <label className="memory-caption" htmlFor={`memory-comment-${mission.id}`}>Le souvenir derrière l’image <span>(obligatoire)</span></label>
            <Textarea id={`memory-comment-${mission.id}`} value={comment} onChange={event=>setComment(event.target.value)} required maxLength={MAX_MEMORY_COMMENT} rows={4} disabled={disabled||!draft} placeholder="Ce qu’on a vécu, ce qui nous a fait rire, le détail qu’on ne veut pas oublier…" aria-describedby="memory-comment-help"/>
            <small id="memory-comment-help">{comment.length}/{MAX_MEMORY_COMMENT} · Les espaces seuls ne suffisent pas.</small>
            <button className="primary photo-validate" disabled={disabled||!draft||!normalizeMemoryComment(comment)} onClick={()=>void save()}>{busy||preparing?<LoaderCircle className="spinning" size={18}/>:<Check size={18}/>} {busy?'Enregistrement…':preparing?'Préparation…':queue.length>1?'Enregistrer et commenter la suivante':'Enregistrer ce souvenir'}</button>
            <button className="subtle" disabled={busy||preparing} onClick={advance}>Ignorer cette photo</button>
          </>}
          {!online&&<p className="form-error" role="status">Hors connexion. Votre photo et son commentaire restent ici tant que la page reste ouverte.</p>}
          {error&&<p className="form-error" role="alert">{error}</p>}
        </div>
      </div>}
    </DialogContent></Dialog>
    <AlertDialog open={discard&&!portrait} onOpenChange={setDiscard}><AlertDialogContent className="quest-dialog"><AlertDialogHeader><AlertDialogTitle>Garder les photos en attente ?</AlertDialogTitle><AlertDialogDescription>Les souvenirs déjà enregistrés sont conservés. Les photos restantes et le commentaire en cours ne sont pas encore sauvegardés.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuer à écrire</AlertDialogCancel><AlertDialogAction onClick={()=>{sequence.current++;setQueue([]);setDraft(null);setComment('');setError('');setOpen(false);}}>Abandonner les photos restantes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!remove&&!portrait} onOpenChange={value=>{if(!busy&&!value)setRemove(null);}}><AlertDialogContent className="quest-dialog"><AlertDialogHeader><AlertDialogTitle>Supprimer ce souvenir ?</AlertDialogTitle><AlertDialogDescription>Cette photo, son original et son commentaire seront supprimés du coffre commun. Les autres souvenirs restent conservés. S’il s’agit du dernier, la quête redeviendra « à faire ».</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Garder le souvenir</AlertDialogCancel><AlertDialogAction disabled={busy||!online} onClick={event=>{event.preventDefault();if(remove)void onDelete(remove.id).then(()=>{setRemove(null);setViewId(null);setOpen(false);setError('');}).catch(e=>{setRemove(null);setError(e instanceof Error?e.message:'Suppression impossible.');});}}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
