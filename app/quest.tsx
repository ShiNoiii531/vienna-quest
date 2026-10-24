'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, Compass, Heart, LockKeyhole, UnlockKeyhole, Check, Sparkles, MapPin, Clock3, ExternalLink, Eye, Settings2, RefreshCw, Trophy, Home, BookOpen, WifiOff, X, Music2, Gamepad2, Palette, Castle, Footprints, Utensils, CircleHelp, Maximize, Minimize, Smartphone, Menu, Camera, ImagePlus, Gift } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { chapters, type Journey, type Mission, type Kind } from '@/lib/quest-types';
import WorldMap from './world-map';
import QuestPhoto, { type PhotoDraft } from './quest-photo';
import QuestAlbum, { type MemoryDraft } from './quest-album';
const icons:Record<Kind,typeof Map>={walk:Footprints,palace:Castle,game:Gamepad2,art:Palette,music:Music2,food:Utensils,underground:Compass,farewell:Heart,gift:Gift};
const labels={free:'À notre rythme',planned:'Réservation à confirmer',booked:'Réservation confirmée',choose:'Adresse à choisir'};
const directions=(s:string)=>`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s)}`;
type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations?:object;execute:(input:any)=>Promise<unknown>|unknown},options?:{signal:AbortSignal})=>void|Promise<void>};
export default function Quest(){
 const [data,setData]=useState<Journey|null>(null);
 const [day,setDay]=useState(()=>{const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Vienna'});return now>='2026-10-17'?5:Math.max(0,Math.min(4,Number(now.slice(8,10))-12))*(now.startsWith('2026-10')?1:0)});
 const [selected,setSelected]=useState<string|null>(null);
 const [preview,setPreview]=useState(false);const [error,setError]=useState('');const [auth,setAuth]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [online,setOnline]=useState(true);
 const [edit,setEdit]=useState<Mission|null>(null);const [hide,setHide]=useState<Mission|null>(null);const [help,setHelp]=useState(false);const [showHint,setShowHint]=useState(false);const [hotelOpen,setHotelOpen]=useState(false);
 const [photoOpen,setPhotoOpen]=useState(false);const [optionalOpen,setOptionalOpen]=useState(false);
 const [missionOpen,setMissionOpen]=useState(false);const [journalOpen,setJournalOpen]=useState(false);const [menuOpen,setMenuOpen]=useState(false);
 const [portrait,setPortrait]=useState(false);const [fullscreen,setFullscreen]=useState(false);const [canFullscreen,setCanFullscreen]=useState(false);
 const [focusKey,setFocusKey]=useState(0);const [celebration,setCelebration]=useState<string|null>(null);
 const busyRef=useRef(false);const loadId=useRef(0);const stateRef=useRef(data);stateRef.current=data;
 const load=useCallback(async()=>{const id=++loadId.current;try{const r=await fetch('/api/journey'+(preview?'?view=explorer':''),{cache:'no-store'});const d=await r.json() as Journey & {error?:string};if(id!==loadId.current)return;if(!r.ok){setAuth(r.status===401);throw new Error(d.error||'Le carnet est momentanément indisponible.')}const previous=stateRef.current; const changed=previous?.missions.find(old=>{const next=d.missions.find(m=>m.id===old.id);return next&&((!old.revealed&&next.revealed)||(!old.completed&&next.completed))}); if(changed)setCelebration(changed.id); setData(d);setAuth(false);setError('');}catch(e){if(id===loadId.current)setError(e instanceof Error?e.message:'Connexion interrompue.');}},[preview]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(!document.hidden&&!busyRef.current)void load()},7000);const focus=()=>{if(!busyRef.current)void load()};const on=()=>{setOnline(true);void load()};const off=()=>setOnline(false);setOnline(navigator.onLine);window.addEventListener('focus',focus);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{loadId.current++;clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[load]);
 useEffect(()=>{setShowHint(false)},[selected,day]);
 useEffect(()=>{if(!celebration)return;const t=setTimeout(()=>setCelebration(null),2200);return()=>clearTimeout(t)},[celebration]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
 const mutate=useCallback(async(body:object)=>{if(busyRef.current)throw new Error('Une sauvegarde est déjà en cours.');if(preview)throw new Error('Quittez l’aperçu pour modifier le voyage.');busyRef.current=true;setBusy(true);setError('');try{const r=await fetch('/api/journey',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;ok?:boolean};if(!r.ok)throw new Error(d.error||'Enregistrement impossible.');await load();return d;}catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');throw e;}finally{busyRef.current=false;setBusy(false)}},[load,preview]);
 async function action(m:Mission,a:'reveal'|'complete',value:boolean){try{await mutate({id:m.id,action:a,value});setNotice(a==='reveal'?(value?'Une nouvelle surprise est dévoilée !':'Cette étape est de nouveau cachée.'):(value?'Un souvenir de plus, à deux.':'Étape remise à faire.'))}catch{}}
 const photoRequest=useCallback(async(mission:Mission,draft:PhotoDraft|null,deleteId?:string)=>{
   if(busyRef.current)throw new Error('Une sauvegarde est déjà en cours.');
   if(preview)throw new Error('Quittez l’aperçu pour modifier les photos.');
   if(!navigator.onLine)throw new Error('Reconnectez-vous pour enregistrer cette photo.');
   busyRef.current=true;setBusy(true);setError('');
   try{
     const form=draft?new FormData():undefined;
     if(draft&&form){form.append('preview',draft.blob,'preview.jpg');form.append('original',draft.original,draft.original.name);form.append('lastModified',String(draft.original.lastModified));}
     const response=await fetch('/api/photos?mission='+encodeURIComponent(mission.id),{method:draft?'POST':'DELETE',headers:draft?{'X-Photo-Id':draft.id,'X-Previous-Photo':draft.previousId}:{'X-Photo-Id':deleteId||''},body:form});
     const result=await response.json() as {error?:string;completed?:boolean};
     if(!response.ok){if(response.status===409)await load();throw new Error(result.error||'La photo n’a pas pu être enregistrée.');}
     await load();
     setNotice(draft?(result.completed?'Photo enregistrée · quête validée !':'Photo retrouvée dans le carnet.'):'Photo supprimée · quête remise à faire.');
   }catch(error){setError(error instanceof Error?error.message:'La photo n’a pas pu être enregistrée.');throw error;}
   finally{busyRef.current=false;setBusy(false);}
 },[load,preview]);
 const memoryRequest=useCallback(async(mission:Mission,draft:MemoryDraft|null,deleteId?:string)=>{
   if(busyRef.current)throw new Error('Une sauvegarde est déjà en cours.');
   if(preview)throw new Error('Quittez l’aperçu pour modifier le coffre.');
   if(!navigator.onLine)throw new Error('Reconnectez-vous pour enregistrer ce souvenir.');
   busyRef.current=true;setBusy(true);setError('');
   try{
     const form=draft?new FormData():undefined;
     if(draft&&form){form.append('preview',draft.blob,'preview.jpg');form.append('original',draft.original,draft.original.name);form.append('lastModified',String(draft.original.lastModified));form.append('comment',draft.comment);}
     const response=await fetch('/api/memories?mission='+encodeURIComponent(mission.id),{method:draft?'POST':'DELETE',headers:{'X-Photo-Id':draft?.id||deleteId||''},body:form});
     const result=await response.json() as {error?:string};
     if(!response.ok)throw new Error(result.error||'Ce souvenir n’a pas pu être enregistré.');
     await load();setNotice(draft?'Photo et commentaire ajoutés au coffre.':'Ce souvenir a été supprimé du coffre.');
   }catch(e){setError(e instanceof Error?e.message:'Enregistrement impossible.');throw e;}
   finally{busyRef.current=false;setBusy(false);}
 },[load,preview]);
 useEffect(()=>{const ctx=(document as Document&{modelContext?:ModelContext}).modelContext;if(!ctx)return;const controller=new AbortController();const register=(t:Parameters<ModelContext['registerTool']>[0])=>{try{void Promise.resolve(ctx.registerTool(t,{signal:controller.signal})).catch(()=>{})}catch{}};
 register({name:'read_vienna_journey',description:'Lire les étapes et leur progression visibles pour la personne connectée.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({role:stateRef.current?.role,missions:stateRef.current?.missions})});
 register({name:'set_vienna_mission_completed',description:'Valider une quête optionnelle, une étape avec photo, ou le coffre avec au moins une photo commentée ; remettre une quête à faire.',inputSchema:{type:'object',properties:{id:{type:'string'},completed:{type:'boolean'}},required:['id','completed'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async v=>{if(typeof v?.id!=='string'||typeof v?.completed!=='boolean'||!stateRef.current?.missions.some(m=>m.id===v.id&&m.revealed&&(!v.completed||m.optional||(m.photoMode==='album'?!!m.memories?.length&&m.memories.every(p=>p.comment.trim()):!!m.photo))))throw new Error('Dévoilez la quête et ajoutez sa photo ; chaque photo du coffre doit avoir un commentaire.');await mutate({id:v.id,action:'complete',value:v.completed});return{id:v.id,completed:v.completed}}});
 if(data?.role==='organizer'&&!preview)register({name:'reveal_vienna_mission',description:'Dévoiler une étape à l’aventurière. Réservé à l’organisateur.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async v=>{if(typeof v?.id!=='string'||!stateRef.current?.missions.some(m=>m.id===v.id))throw new Error('Étape inconnue.');await mutate({id:v.id,action:'reveal',value:true});return{id:v.id,revealed:true}}});return()=>controller.abort();},[data?.role,mutate,preview]);
 useEffect(()=>{
   const media=window.matchMedia('(orientation: portrait)');
   const orient=()=>setPortrait(media.matches);orient();media.addEventListener('change',orient);
   setCanFullscreen(!!document.documentElement.requestFullscreen&&document.fullscreenEnabled);
   const screenChange=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',screenChange);
   return()=>{media.removeEventListener('change',orient);document.removeEventListener('fullscreenchange',screenChange)};
 },[]);
 const organizer=data?.role==='organizer';const controls=organizer&&!preview;
 const mainMissions=data?.missions.filter(m=>!m.optional)||[];
 const optionalMissions=data?.missions.filter(m=>m.optional)||[];
 const optionalDone=optionalMissions.filter(m=>m.completed).length;
 const dayMissions=mainMissions.filter(m=>m.day===day);
 const current=data?.missions.find(m=>m.id===selected);
 const nextMission=dayMissions.find(m=>!m.completed)||dayMissions[0];
 const Icon=current?icons[current.kind]:Compass;
 const done=mainMissions.filter(m=>m.completed).length;
 const revealed=mainMissions.filter(m=>m.revealed).length;const total=mainMissions.length||17;const chapter=chapters[day];
 function selectMission(m:Mission){setPhotoOpen(false);setOptionalOpen(false);if(!m.optional)setDay(m.day);setSelected(m.id);setFocusKey(v=>v+1);setMissionOpen(true);setJournalOpen(false);setMenuOpen(false)}
 function chooseDay(n:number){setPhotoOpen(false);setOptionalOpen(false);setDay(n);setSelected(null);setMissionOpen(false);setJournalOpen(false);setFocusKey(v=>v+1)}
 function switchPreview(){setPhotoOpen(false);setOptionalOpen(false);setData(null);stateRef.current=null;loadId.current++;setPreview(p=>!p);setMissionOpen(false);setSelected(null);setMenuOpen(false);setEdit(null);setHide(null)}
 function openOptional(){setPhotoOpen(false);setOptionalOpen(true);setMissionOpen(false);setJournalOpen(false);setMenuOpen(false);}
 async function toggleFullscreen(){
   try{
     if(document.fullscreenElement){await document.exitFullscreen();return;}
     await document.documentElement.requestFullscreen();
     const orientation=screen.orientation as ScreenOrientation&{lock?:(value:string)=>Promise<void>};
     try{await orientation.lock?.('landscape')}catch{/* The portrait gate remains available on unsupported browsers. */}
   }catch{setNotice('Le plein écran n’est pas disponible ici. Tournez votre téléphone en paysage.')}
 }
 const connectionMessage=!online?'Hors connexion · les modifications attendent votre retour.':error;
 return <>
 <main className={"game-shell "+(missionOpen||journalOpen||menuOpen||optionalOpen?"panel-visible":"")} inert={portrait} aria-label="Vienna Quest">
   <WorldMap missions={dayMissions} allMissions={mainMissions} organizer={controls} selected={current} focusKey={focusKey} panelOpen={missionOpen||journalOpen||menuOpen||optionalOpen} celebration={celebration} onSelect={selectMission} onHotel={()=>setHotelOpen(true)} onOptional={openOptional} optionalDone={optionalDone} optionalTotal={optionalMissions.length||8} optionalOpen={optionalOpen}/>
   <div className="world-vignette" aria-hidden="true"/>
   <header className="game-header">
     <div className="game-brand"><span className="brand-heart"><Heart size={19} fill="currentColor"/></span><div><h1>Vienna <em>Quest</em></h1><span>12 — 16 OCTOBRE 2026</span></div></div>
     <nav className="chapter-selector" aria-label="Les cinq journées et l’épilogue">{chapters.map(c=>{
       const list=data?.missions.filter(m=>m.day===c.day)||[];const finished=list.length>0&&list.every(m=>m.completed);
       return <button key={c.day} aria-pressed={day===c.day} aria-label={`${c.day===5?'Épilogue':`Jour ${c.day+1}`}, ${c.date} octobre : ${c.name}`} className={day===c.day?'active':''} onClick={()=>chooseDay(c.day)}><span>{c.day===5?'Épil.':`J${c.day+1}`}</span><strong>{c.date}</strong>{finished&&<Check size={13}/>}</button>
     })}</nav>
     <div className="header-actions"><button className="hud-icon" onClick={()=>{setOptionalOpen(false);setJournalOpen(v=>!v);setMissionOpen(false);setMenuOpen(false)}} aria-label="Ouvrir nos souvenirs" aria-expanded={journalOpen}><Trophy size={20}/><span className="progress-count">{done}/{total}</span></button><button className="hud-icon" onClick={()=>{setOptionalOpen(false);setMenuOpen(v=>!v);setMissionOpen(false);setJournalOpen(false)}} aria-label="Ouvrir le menu" aria-expanded={menuOpen}><Menu size={22}/></button></div>
   </header>
   <div className="chapter-bar">
   <div className="chapter-heading"><span>{day===5?'ÉPILOGUE':`CHAPITRE ${day+1}`}</span><h2>{chapter.name}</h2></div>
   <div className="game-status">
     {preview&&<button className="preview-chip" disabled={busy} onClick={switchPreview}><Eye size={14}/>Voir comme elle <X size={15}/></button>}
     {connectionMessage&&<div className="connection-alert" role="alert">{!online&&<WifiOff size={16}/>}<span>{connectionMessage}</span>{auth?<a href="/signin-with-chatgpt?return_to=%2F" target="_top">Se connecter</a>:<button aria-label="Réessayer la synchronisation" onClick={()=>void load()}><RefreshCw size={17}/></button>}</div>}
   </div>
   </div>
   {!data&&!error&&<div className="loading-camp" role="status"><Compass size={28}/><p>On ouvre notre aventure…</p></div>}
   <div className="quest-dock" aria-label="Étapes de cette journée">
     <span className="dock-label"><Compass size={18}/><span>NOS QUÊTES</span></span>
     <div className="dock-items">{dayMissions.map((m,i)=><button key={m.id} className={'dock-quest '+(current?.id===m.id?'active ':'')+(m.completed?'done':'')} aria-label={`${m.revealed||controls?m.title:`Surprise ${i+1}`} : ouvrir la quête`} aria-haspopup="dialog" onClick={()=>selectMission(m)}><span>{m.completed?<Check size={16}/>:!m.revealed&&!controls?<LockKeyhole size={15}/>:String(i+1).padStart(2,'0')}</span><strong>{m.title}</strong></button>)}</div>
     {nextMission&&<button className="next-quest" onClick={()=>selectMission(nextMission)} aria-label="Ouvrir la prochaine quête"><Sparkles size={17}/><span>{dayMissions.every(m=>m.completed)?'Revoir':'Prochaine quête'}</span></button>}
   </div>
   <footer className="map-footer">
     <div className="map-caption">Carte imaginaire · glissez pour explorer</div>
     <div className="sync-label" aria-live="polite">{busy?'Enregistrement…':connectionMessage?'Connexion en attente':data?'Progression partagée':''}</div>
   </footer>
 </main>
 <div className="orientation-gate"><div className="rotate-phone"><Smartphone size={64} strokeWidth={1.3}/></div><p className="eyebrow">JOUEUR 1 + JOUEUR 2</p><h2>L’aventure se joue<br/>en paysage.</h2><p>Tournez votre téléphone pour<br/>entrer dans notre Vienne.</p><span className="orientation-help">Si besoin, désactivez le verrouillage de rotation.<br/>Sur ordinateur, agrandissez la fenêtre en largeur.</span>{canFullscreen&&<button className="primary" onClick={()=>void toggleFullscreen()}><Maximize size={17}/>Passer en plein écran</button>}<span className="gate-signature"><Heart size={14}/>Une aventure signée Joueur 1.</span></div>
 <Sheet modal={false} open={!portrait&&missionOpen&&!!current} onOpenChange={setMissionOpen}><SheetContent className="game-panel mission-panel" showCloseButton={false} onInteractOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{e.preventDefault();document.querySelector<HTMLButtonElement>('.world-pin.selected')?.focus()}}>
   {current&&<><div className="panel-top"><p className="eyebrow">{current.optional?'QUÊTE OPTIONNELLE':`QUÊTE ${String(current.order).padStart(2,'0')}`}</p><button className="panel-close" onClick={()=>setMissionOpen(false)} aria-label="Revenir à la carte"><X size={21}/></button></div><div className="panel-scroll">
     {current.optional&&<button className="subtle optional-back" onClick={openOptional}><Gift size={17}/>Tous les cadeaux</button>}<div className="mission-heading"><div className={'mission-symbol '+(current.completed?'completed':'')}>{current.revealed||controls?<Icon size={27}/>:<LockKeyhole size={26}/>}</div><span className={'state-label '+(current.completed?'done':current.revealed?'open':'')}>{current.completed?<><Check size={13}/>Terminée</>:current.revealed?<><UnlockKeyhole size={13}/>{current.optional?'À faire':'Dévoilée'}</>:<><LockKeyhole size={13}/>À découvrir</>}</span></div>
     <SheetTitle className="quest-title">{current.title}</SheetTitle><SheetDescription className="chapter-line">{current.optional?'À faire quand nous en avons envie':chapter.name}</SheetDescription>
     {!current.revealed&&!controls?<><p className="description">Une nouvelle page de notre aventure attend son moment.</p><button className="hint-btn" aria-expanded={showHint} onClick={()=>setShowHint(v=>!v)}><Sparkles size={17}/>{showHint?'Refermer l’indice':'Un petit indice ?'}</button>{showHint&&<p className="hint">« {current.hint} »</p>}<p className="waiting"><LockKeyhole size={15}/>Joueur 1 vous réserve la surprise.</p></>:<>
       <p className="description">{current.description}</p><div className="mission-meta"><span><Clock3 size={16}/>{current.time}</span>{current.duration&&<small>{current.duration}</small>}</div>
       {current.booking!=='free'&&<span className={'booking '+current.booking}>{current.booking==='booked'?<Check size={14}/>:<CircleHelp size={14}/>} {labels[current.booking]}</span>}
       {current.address&&<a className="text-link" href={directions(current.address)} target="_blank" rel="noreferrer"><MapPin size={17}/>Y aller <ExternalLink size={13}/></a>}
       {current.link&&<a className="text-link" href={current.link} target="_blank" rel="noreferrer"><BookOpen size={17}/>{current.linkLabel||'Consulter le lien'}<ExternalLink size={13}/></a>}
       {current.note&&<p className="personal-note">{current.note}</p>}
       {current.optional&&current.revealed&&<button className={'complete-control '+(current.completed?'checked':'')} disabled={busy||preview||!online} onClick={()=>void action(current,'complete',!current.completed)} aria-pressed={current.completed}><Check size={19}/>{current.completed?'Cadeau trouvé · remettre à faire':'Cadeau trouvé · valider la quête'}</button>}
       {current.photoMode==='album'&&current.revealed&&<section className="quest-photo-card" aria-label="Album de la quête"><div className="photo-callout"><ImagePlus size={28}/><div><strong>{current.memories?.length||0} souvenir(s) dans le coffre</strong><p>Ajoutez plusieurs photos, chacune avec son commentaire. Scellez ensuite le coffre pour valider la quête.</p></div></div><button className="primary" onClick={()=>setPhotoOpen(true)}><ImagePlus size={18}/>Ouvrir le coffre des souvenirs</button></section>}
       {!current.optional&&current.photoMode!=='album'&&current.revealed&&<section className="quest-photo-card" aria-label="Photo de la quête">
         {current.photo?<><button className="saved-photo" onClick={()=>setPhotoOpen(true)} aria-label={`Voir la photo souvenir de ${current.title}`}><img key={current.photo.id} src={current.photo.url} alt="Notre photo souvenir" loading="lazy"/><span><Camera size={17}/>Voir notre photo</span></button><p className="photo-saved-label"><Check size={16}/>{current.completed?'Quête validée avec notre photo':'Photo conservée dans le carnet'}</p>{!preview&&<><button className="photo-secondary" disabled={busy||!online} onClick={()=>setPhotoOpen(true)}><ImagePlus size={17}/>Changer la photo</button><button className="subtle" disabled={busy||!online} onClick={()=>void action(current,'complete',!current.completed)}>{current.completed?'Remettre la quête à faire':'Valider avec cette photo'}</button></>}</>:<><div className="photo-callout"><Camera size={28}/><div><strong>Notre preuve d’aventure</strong><p>{current.completed?'Quête déjà validée. Ajoutons sa photo souvenir.':'Une photo pour terminer cette quête et garder le souvenir.'}</p></div></div><button className="primary" disabled={busy||preview||!online} onClick={()=>setPhotoOpen(true)}><Camera size={18}/>{current.completed?'Ajouter notre photo':'Valider avec une photo'}</button></>}
       </section>}
     </>}
     {controls&&<div className="organizer-actions">{!current.revealed?<button className="primary" disabled={busy||!online} onClick={()=>void action(current,'reveal',true)}><Sparkles size={17}/>Dévoiler cette étape</button>:<button className="subtle" disabled={busy||!online} onClick={()=>setHide(current)}><LockKeyhole size={15}/>Cacher de nouveau</button>}<button className="subtle" disabled={busy} onClick={()=>setEdit({...current})}><Settings2 size={15}/>Ajuster cette étape</button></div>}
     {preview&&<p className="muted">Aperçu uniquement. Revenez à votre espace pour modifier le voyage.</p>}
     {error&&<p className="form-error" role="alert">{error}</p>}
   </div></>}
 </SheetContent></Sheet>
 <Sheet modal={false} open={!portrait&&optionalOpen} onOpenChange={setOptionalOpen}><SheetContent className="game-panel" showCloseButton={false} onInteractOutside={e=>e.preventDefault()} onCloseAutoFocus={e=>{e.preventDefault();document.querySelector<HTMLButtonElement>('.gift-pin')?.focus()}}>
   <div className="panel-top"><p className="eyebrow">QUÊTES OPTIONNELLES</p><button className="panel-close" onClick={()=>setOptionalOpen(false)} aria-label="Revenir à la carte"><X size={21}/></button></div>
   <div className="panel-scroll"><Gift className="journal-trophy" size={32}/><SheetTitle className="quest-title">Les petits cadeaux</SheetTitle><SheetDescription>Au fil de nos balades, un souvenir pour chacun. Cochez dès que le cadeau est trouvé.</SheetDescription>
   <p className="optional-count">{optionalDone}/{optionalMissions.length||8} cadeaux trouvés</p>
   <div className="optional-list">{optionalMissions.map(m=><div key={m.id} className={'optional-row '+(m.completed?'done':'')}>
     <Checkbox checked={m.completed} disabled={busy||preview||!online||!m.revealed} aria-label={`${m.completed?'Remettre à faire':'Valider'} : ${m.title}`} onCheckedChange={value=>{if(typeof value==='boolean')void action(m,'complete',value)}}/>
     <button className="optional-details" onClick={()=>selectMission(m)} aria-haspopup="dialog"><strong>{m.title}</strong><span>{m.completed?'Terminé':m.revealed?'À trouver':'À découvrir'}</span></button>
   </div>)}</div>
   {!data&&<p className="muted">Chargement des quêtes…</p>}
   <p className="muted optional-note">Ces quêtes sont indépendantes des cinq journées. Aucune photo n’est nécessaire.</p>
   {preview&&<p className="muted">Aperçu uniquement. Revenez à votre espace pour cocher les cadeaux.</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}</div>
 </SheetContent></Sheet>
 <Sheet modal={false} open={!portrait&&journalOpen} onOpenChange={setJournalOpen}><SheetContent className="game-panel" showCloseButton={false} onInteractOutside={e=>e.preventDefault()}>
   <div className="panel-top"><p className="eyebrow">LE CARNET DU DUO</p><button className="panel-close" onClick={()=>setJournalOpen(false)} aria-label="Revenir à la carte"><X size={21}/></button></div><div className="panel-scroll"><Trophy className="journal-trophy" size={32}/><SheetTitle className="quest-title">Nos souvenirs</SheetTitle><SheetDescription>{done} étapes vécues ensemble sur {total}.</SheetDescription><Progress className="journal-progress" value={done/total*100} aria-label={`${done} étapes terminées sur ${total}`}/><div className="stats"><span><strong>{revealed}</strong>dévoilées</span><span><strong>{done}</strong>terminées</span><span><strong>{total-done}</strong>à vivre</span></div>
   {!!data?.missions.some(m=>(m.photo||m.memories?.length)&&m.revealed)&&<div className="souvenir-photos" aria-label="Nos photos souvenirs">{data.missions.filter(m=>m.revealed).flatMap(m=>(m.photoMode==='album'?m.memories||[]:m.photo?[m.photo]:[]).map(p=><button key={p.id} onClick={()=>selectMission(m)} aria-label={`Revoir ${m.title}`}><img src={p.url} alt={'comment' in p?String(p.comment):`Souvenir : ${m.title}`} loading="lazy"/><span>{'comment' in p?String(p.comment):m.title}</span></button>))}</div>}
   <div className="chapter-cards">{chapters.map(c=>{const ms=data?.missions.filter(m=>m.day===c.day)||[];const count=ms.filter(m=>m.completed).length;return <button key={c.day} className={count===ms.length&&ms.length?'all-done':''} onClick={()=>chooseDay(c.day)}><span className="eyebrow">{c.date.toUpperCase()} OCT.</span><h3>{c.name}</h3><Progress value={ms.length?count/ms.length*100:0} aria-label={`Jour ${c.day+1} : ${count} étapes sur ${ms.length}`}/><p>{count} / {ms.length} souvenirs</p></button>})}</div>
   <button className="optional-summary" onClick={openOptional}><Gift size={21}/><span>Quêtes optionnelles<small>{optionalDone}/{optionalMissions.length||8} cadeaux trouvés · à notre rythme</small></span></button>
   <div className="badges"><span className={done>=1?'earned':''}><Footprints/>Premiers pas</span><span className={done>=5?'earned':''}><Compass/>Duo d’explorateurs</span><span className={done===total?'earned':''}><Heart/>Vienne dans le cœur</span></div></div>
 </SheetContent></Sheet>
 <Sheet modal={false} open={!portrait&&menuOpen} onOpenChange={setMenuOpen}><SheetContent className="game-panel menu-panel" showCloseButton={false} onInteractOutside={e=>e.preventDefault()}>
   <div className="panel-top"><p className="eyebrow">NOTRE AVENTURE</p><button className="panel-close" onClick={()=>setMenuOpen(false)} aria-label="Revenir à la carte"><X size={21}/></button></div><div className="panel-scroll"><SheetTitle className="quest-title">Une pause ?</SheetTitle><SheetDescription>Tout est ici pour poursuivre le voyage.</SheetDescription><div className="game-menu">
   <button onClick={openOptional}><Gift size={21}/><span>Quêtes optionnelles<small>Les cadeaux · {optionalDone}/{optionalMissions.length||8} terminées</small></span></button>
   <button onClick={()=>{setHotelOpen(true);setMenuOpen(false)}}><Home size={21}/><span>Hôtel & vols<small>Nos horaires et le retour à l’aéroport</small></span></button>
   {organizer&&<button disabled={busy} onClick={switchPreview}><Eye size={21}/><span>{preview?'Revenir à mon espace':'Voir comme elle'}<small>{preview?'Retrouver les commandes organisateur':'Découvrir les surprises à sa place'}</small></span></button>}
   {canFullscreen&&<button onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={21}/>:<Maximize size={21}/>}<span>{fullscreen?'Quitter le plein écran':'Passer en plein écran'}</span></button>}
   <button onClick={()=>{setHelp(true);setMenuOpen(false)}}><CircleHelp size={21}/><span>Comment jouer<small>Installer et explorer l’aventure</small></span></button></div><p className="menu-signature"><Heart size={15}/>Une aventure signée Joueur 1.</p></div>
 </SheetContent></Sheet>
 {notice&&!portrait&&<div className="toast" role="status"><Check size={18}/>{notice}</div>}
 <Dialog open={!portrait&&hotelOpen} onOpenChange={setHotelOpen}><DialogContent className="quest-dialog"><DialogTitle>Hôtel & vols</DialogTitle><DialogDescription>{data?.hotel.name||'Hôtel de démonstration'}</DialogDescription>{data&&<><p>{data.hotel.address}</p><div className="hotel-times"><p><strong>Chambre disponible</strong>{data.hotel.arrival}</p><p><strong>Libérer la chambre</strong>{data.hotel.departure}</p></div>{data.travel&&<section className="travel-times" aria-label="Nos vols et nos bagages"><h3>Nos vols · heures locales</h3><p>{data.travel.arrival}</p><p>{data.travel.returnFlight}</p><p>{data.travel.airportTransfer}</p><p className="travel-bags">{data.travel.bags}</p></section>}<a className="primary" href={directions(data.hotel.address)} target="_blank" rel="noreferrer"><MapPin size={16}/>Retour à l’hôtel</a></>}</DialogContent></Dialog>
 <Dialog open={!portrait&&help} onOpenChange={setHelp}><DialogContent className="quest-dialog"><DialogTitle>À vous de jouer</DialogTitle><DialogDescription>Notre Vienne se découvre en paysage.</DialogDescription><div className="help-step"><span>1</span><p><strong>Explorez la carte.</strong> Glissez avec le doigt ou la souris ; pincez ou utilisez les boutons pour zoomer. Au clavier : flèches sur la carte, + et − pour zoomer.</p></div><div className="help-step"><span>2</span><p><strong>Touchez un lieu.</strong> Lisez son indice, découvrez la surprise quand Joueur 1 la dévoile, puis prenez une photo souvenir pour valider la quête. Vous pourrez vérifier l’image avant de l’enregistrer.</p></div><div className="help-step"><span>3</span><p><strong>Gardez l’aventure à portée de main.</strong> Ouvrez ce lien dans Safari sur iPhone ou Chrome sur Android. Dans le menu de partage ou du navigateur, choisissez « Sur l’écran d’accueil » ou « Installer l’application », si proposé.</p></div><p className="muted">Connectez-vous avec le compte ChatGPT invité. Une connexion internet est nécessaire pour charger et enregistrer la progression commune. La carte et les déplacements du duo sont imaginaires ; « Y aller » ouvre le véritable itinéraire.</p>{organizer&&<p className="muted">Dans le menu, « Voir comme elle » permet de vérifier les surprises sans modifier le voyage.</p>}</DialogContent></Dialog>
 <Dialog open={!portrait&&!!edit} onOpenChange={o=>{if(!o&&!busy)setEdit(null)}}><DialogContent className="quest-dialog edit-dialog"><DialogTitle>Ajuster cette étape</DialogTitle><DialogDescription>Les modifications seront communes à votre voyage.</DialogDescription>{edit&&<form onSubmit={async e=>{e.preventDefault();try{await mutate({id:edit.id,action:'edit',details:{title:edit.title,time:edit.time,address:edit.address,description:edit.description,booking:edit.booking,link:edit.link,note:edit.note}});setEdit(null);setNotice('Étape mise à jour.')}catch{}}}><label>Titre<Input value={edit.title} required maxLength={100} onChange={e=>setEdit({...edit,title:e.target.value})}/></label><label>Horaire<Input value={edit.time} maxLength={100} onChange={e=>setEdit({...edit,time:e.target.value})}/></label><label>Adresse<Input value={edit.address} maxLength={250} onChange={e=>setEdit({...edit,address:e.target.value})}/></label><label>Description<Textarea value={edit.description} maxLength={1400} rows={4} onChange={e=>setEdit({...edit,description:e.target.value})}/></label><label>Statut<Select value={edit.booking} onValueChange={v=>setEdit({...edit,booking:v as Mission['booking']})}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(labels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></label><label>{edit.kind==='food'?'Lien Tripadvisor':'Lien utile'}<Input type="url" value={edit.link} placeholder="https://…" maxLength={700} onChange={e=>setEdit({...edit,link:e.target.value})}/></label><label>Petit mot à découvrir avec l’étape<Textarea value={edit.note} rows={2} maxLength={700} onChange={e=>setEdit({...edit,note:e.target.value})}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={busy||!online}>{busy?'Enregistrement…':'Enregistrer les modifications'}</button></form>}</DialogContent></Dialog>
 <AlertDialog open={!portrait&&!!hide} onOpenChange={o=>{if(!o)setHide(null)}}><AlertDialogContent className="quest-dialog"><AlertDialogHeader><AlertDialogTitle>Cacher de nouveau cette étape ?</AlertDialogTitle><AlertDialogDescription>Elle redeviendra une surprise et sa case « terminée » sera décochée sur vos deux téléphones.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Garder visible</AlertDialogCancel><AlertDialogAction disabled={busy||!online} onClick={()=>{if(hide)void action(hide,'reveal',false);setHide(null)}}>Cacher l’étape</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 {current?.photoMode==='album'&&<QuestAlbum key={current.id} mission={current} open={photoOpen} onOpenChange={setPhotoOpen} portrait={portrait} readOnly={preview||!current.revealed} busy={busy} online={online} onSave={draft=>memoryRequest(current,draft)} onDelete={id=>memoryRequest(current,null,id)} onComplete={async()=>{await mutate({id:current.id,action:'complete',value:!current.completed});setNotice(current.completed?'Coffre remis à faire.':'Coffre scellé · votre histoire est préservée !');}}/>}
 {current&&!current.optional&&current.photoMode!=='album'&&<QuestPhoto key={current.id} mission={current} open={photoOpen} portrait={portrait} readOnly={preview||!current.revealed} busy={busy} online={online} onOpenChange={setPhotoOpen} onSave={draft=>photoRequest(current,draft)} onDelete={id=>photoRequest(current,null,id)}/>}
 </>;
}
