'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Check, Trash2, LoaderCircle, X, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import type { Mission } from '@/lib/quest-types';
import { MAX_PHOTO_BYTES, MAX_PHOTO_EDGE, MAX_ORIGINAL_BYTES } from '@/lib/photo-files';

export type PhotoDraft = { blob: Blob; original: File; url: string; id: string; previousId: string };
export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error('Cette image est trop volumineuse. Choisissez une photo de moins de 30 Mo.');
  if (file.type && !/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type)) throw new Error('Choisissez une photo JPEG, PNG, WebP ou une photo de votre téléphone.');
  const url = URL.createObjectURL(file); const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Ce format ne peut pas être lu ici. Essayez une photo JPEG ou PNG, ou prenez une nouvelle photo.')); image.src = url; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Cette photo ne peut pas être ouverte.');
    const ratio = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Votre navigateur ne peut pas préparer cette photo.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('La préparation de la photo a échoué. Réessayez.')), 'image/jpeg', .86));
    canvas.width = 0; canvas.height = 0;
    if (blob.type !== 'image/jpeg' || blob.size > MAX_PHOTO_BYTES) throw new Error('La photo ne peut pas être préparée. Essayez une image plus petite.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

type Props = { mission: Mission; open: boolean; portrait: boolean; readOnly: boolean; busy: boolean; online: boolean; onOpenChange: (open: boolean) => void; onSave: (draft: PhotoDraft) => Promise<void>; onDelete: (photoId: string) => Promise<void> };
export default function QuestPhoto({ mission, open, portrait, readOnly, busy, online, onOpenChange, onSave, onDelete }: Props) {
  const camera = useRef<HTMLInputElement>(null); const gallery = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [preparing, setPreparing] = useState(false); const [error, setError] = useState(''); const [remove, setRemove] = useState(false);
  const sequence = useRef(0); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);
  const disabled = busy || preparing || readOnly || !online;
  const conflict = draft && draft.previousId !== (mission.photo?.id || '') && draft.id !== mission.photo?.id;
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const version = ++sequence.current; const previousId = mission.photo?.id || '';
    setPreparing(true); setError('');
    try {
      const blob = await preparePhoto(file); if (!mounted.current || version !== sequence.current) return;
      setDraft({ blob, original: file, url: URL.createObjectURL(blob), id: crypto.randomUUID(), previousId }); onOpenChange(true);
    } catch (error) { if (mounted.current && version === sequence.current) setError(error instanceof Error ? error.message : 'La photo ne peut pas être ouverte.'); }
    finally { if (mounted.current && version === sequence.current) setPreparing(false); }
  }
  async function save() {
    if (!draft || disabled) return;
    setError('');
    try { await onSave({ ...draft, previousId: conflict ? mission.photo?.id || '' : draft.previousId }); if (mounted.current) { setDraft(null); onOpenChange(false); } }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'L’enregistrement a échoué. Votre photo reste disponible pour réessayer.'); }
  }
  return <>
    {/* Keep file inputs mounted when the native camera rotates the device. */}
    <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Prendre une photo" onChange={event => void choose(event)}/>
    <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Choisir une photo" onChange={event => void choose(event)}/>
    <Dialog open={open && !portrait} onOpenChange={value => { if (!busy && !preparing) onOpenChange(value); }}><DialogContent className="quest-dialog photo-dialog" showCloseButton={false} onInteractOutside={event => { if (draft || busy || preparing) event.preventDefault(); }}>
      <div className="photo-dialog-title"><div><DialogTitle>{draft ? 'Notre photo souvenir' : mission.photo ? 'Un souvenir à deux' : 'Une photo pour cette quête'}</DialogTitle><DialogDescription>{mission.title}</DialogDescription></div><button className="photo-close" disabled={busy || preparing} onClick={() => onOpenChange(false)} aria-label="Fermer la photo"><X size={21}/></button></div>
      <div className="photo-layout">
        <div className="photo-stage">{draft || mission.photo ? <img key={draft?.url || mission.photo?.url} src={draft?.url || mission.photo!.url} alt={`Photo souvenir : ${mission.title}`} onError={() => setError('La photo ne peut pas être affichée. Vérifiez la connexion et rouvrez la quête.')}/> : <div className="photo-placeholder"><Camera size={42}/><p>Un lieu, un détail,<br/>ou notre duo.</p></div>}</div>
        <div className="photo-actions">
          {preparing ? <p className="photo-progress" role="status"><LoaderCircle size={20}/>Préparation de la photo…</p> : draft ? <p>Cette photo sera partagée dans notre carnet et validera la quête après son enregistrement.</p> : mission.photo ? <p><Check size={17}/>Photo enregistrée dans notre carnet.</p> : <p>Prenez une photo souvenir, puis confirmez pour terminer cette quête.</p>}
          {draft ? <p>L’original sera conservé pour notre album, avec la date et le lieu si le téléphone les transmet.</p> : mission.photo?.originalUrl ? <a className="photo-secondary" href={mission.photo.originalUrl} download><Download size={18}/>Télécharger l’original</a> : mission.photo ? <p>Seule la copie allégée est disponible. Choisissez à nouveau la photo pour garder son original pour l’album.</p> : null}
          {!readOnly && <><button className="primary" disabled={disabled} onClick={() => camera.current?.click()}><Camera size={18}/>{draft || mission.photo ? 'Prendre une autre photo' : 'Prendre une photo'}</button><button className="photo-secondary" disabled={disabled} onClick={() => gallery.current?.click()}><ImagePlus size={18}/>Choisir sur le téléphone</button></>}
          {conflict && <p className="form-error" role="alert">Une autre photo a été enregistrée pour cette quête. En confirmant, vous la remplacerez par celle-ci.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!online && <p className="form-error" role="status">Reconnectez-vous pour enregistrer. La photo choisie reste disponible tant que cette quête reste ouverte.</p>}
          {draft && !readOnly && <><button className="primary photo-validate" disabled={disabled} onClick={() => void save()}>{busy ? <LoaderCircle className="spinning" size={18}/> : <Check size={18}/>} {busy ? 'Enregistrement…' : conflict ? 'Remplacer et valider la quête' : 'Enregistrer et valider la quête'}</button><button className="subtle" disabled={busy || preparing} onClick={() => { setDraft(null); setError(''); }}>Annuler cette photo</button></>}
          {mission.photo && !draft && !readOnly && <button className="subtle photo-remove" disabled={disabled} onClick={() => setRemove(true)}><Trash2 size={16}/>Supprimer la photo</button>}
        </div>
      </div>
    </DialogContent></Dialog>
    <AlertDialog open={remove && !portrait} onOpenChange={value => { if (!busy) setRemove(value); }}><AlertDialogContent className="quest-dialog"><AlertDialogHeader><AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle><AlertDialogDescription>Elle disparaîtra de votre carnet commun et cette quête redeviendra « à faire ».</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Garder la photo</AlertDialogCancel><AlertDialogAction disabled={busy || !online} onClick={event => { event.preventDefault(); if (!mission.photo) return; void onDelete(mission.photo.id).then(() => { setRemove(false); setError(''); }).catch(error => { setRemove(false); setError(error instanceof Error ? error.message : 'Suppression impossible.'); }); }}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
