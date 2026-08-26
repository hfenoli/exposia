import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { supabase } from "./supabase";
import { compressImageFile, removeBackground, dominantBorderColor, isImageFile, formatBytes, makeThumbnail, TOLERANCE_PRESETS, MAX_SOURCE_BYTES } from "./imaging";
import { SPORT_LIST, DEFAULT_SPORT, getSport, termsFor, ctypesFor, ctypeInfo } from "./sports";
// ─── BOTTOM SHEET SWIPE-TO-DISMISS ────────────────────────────
// Helper module-level pour pouvoir être utilisé dans DragCanvas comme dans App.
function makeSwipeClose(onClose){
  let startY=0, dy=0, panelEl=null;
  return{
    onTouchStart:(e)=>{
      startY=e.touches[0].clientY; dy=0;
      panelEl=e.currentTarget.closest('[data-bottom-sheet]');
    },
    onTouchMove:(e)=>{
      dy=e.touches[0].clientY-startY;
      if(dy>0&&panelEl){panelEl.style.transform="translateY("+dy+"px)"; panelEl.style.transition="none";}
    },
    onTouchEnd:()=>{
      if(panelEl){panelEl.style.transition="transform .25s ease";panelEl.style.transform="";}
      if(dy>100&&onClose)onClose();
      dy=0;panelEl=null;
    },
  };
}
// ─── FILE INTAKE ──────────────────────────────────────────────
// Plus de rejet à 10 Mo : les photos lourdes (reflex, iPhone…) sont
// redimensionnées et recompressées automatiquement à l'import. Seul un
// garde-fou technique subsiste (MAX_SOURCE_BYTES), au-delà duquel le
// navigateur ne sait de toute façon plus décoder l'image.
function validateImageFile(f){
  if(!f) return false;
  if(!isImageFile(f)){alert("Format non supporté. Sélectionnez une image (JPG, PNG, WebP…).");return false;}
  if(f.size>MAX_SOURCE_BYTES){alert("Fichier trop volumineux ("+formatBytes(f.size)+"). Maximum "+formatBytes(MAX_SOURCE_BYTES)+".");return false;}
  return true;
}
// Lit + compresse un fichier, et renvoie la data URL prête à stocker.
// Renvoie null (et prévient l'utilisateur) si l'image est illisible.
async function intakeImage(file,preset){
  const r=await intakeImageWithThumb(file,preset);
  return r?r.url:null;
}
// Variante qui produit aussi la vignette, pour les images affichées en grille.
async function intakeImageWithThumb(file,preset){
  if(!validateImageFile(file)) return null;
  try{
    const {url}=await compressImageFile(file,preset||"photo");
    let thumbUrl=null;
    try{ thumbUrl=await makeThumbnail(url); }
    catch(e){ console.warn("[intakeImage] vignette non générée:",e); }
    return {url,thumbUrl};
  }catch(err){
    console.error("[intakeImage] échec:",err);
    alert("Image illisible : "+(err&&err.message?err.message:"format non pris en charge")
      +"\nAstuce : les fichiers HEIC de l'iPhone doivent être exportés en JPEG.");
    return null;
  }
}
// Affichage en grille : la vignette si elle existe, sinon l'original (lignes
// créées avant la migration 0003).
function thumbOf(row){ return (row&&(row.thumb_url||row.thumbUrl))||(row&&row.url)||null; }
// ─── STOCKAGE LOCAL ───────────────────────────────────────────
// Certains contextes (navigation privée, cookies bloqués, mode verrouillage)
// font lever l'accès à localStorage. Une exception dans un initialiseur de
// state ferait planter toute l'application : on encapsule.
function lsGet(key){
  try{ return localStorage.getItem(key); }
  catch(e){ console.warn("[localStorage] lecture impossible:",e&&e.message); return null; }
}
function lsSet(key,value){
  try{ localStorage.setItem(key,value); return true; }
  catch(e){ console.warn("[localStorage] écriture impossible:",e&&e.message); return false; }
}
// ─── MOBILE HOOKS ─────────────────────────────────────────────
const MOBILE_BREAKPOINT = 768;
function useIsMobile(){
  const[v,setV]=useState(typeof window!=="undefined"&&window.innerWidth<MOBILE_BREAKPOINT);
  useEffect(()=>{
    const h=()=>setV(window.innerWidth<MOBILE_BREAKPOINT);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);
  return v;
}
function useCanvasScale(cw,ch){
  const W=cw||270, H=ch||480;
  const[scale,setScale]=useState(1);
  useEffect(()=>{
    const compute=()=>{
      const w=window.innerWidth, h=window.innerHeight;
      if(w>=MOBILE_BREAKPOINT){setScale(1);return;}
      // reservedHeight adaptatif : viewports compacts gardent plus de place pour le canvas
      const r=h<700?140:200;
      const sw=(w-24)/W, sh=(h-r)/H;
      // Les formats courts (carré, 4:5) peuvent dépasser 1 sans déborder : on
      // les laisse grandir un peu, mais pas au point de pixelliser l'aperçu.
      setScale(Math.max(0.4,Math.min(1.5,Math.min(sw,sh))));
    };
    compute();
    window.addEventListener("resize",compute);
    return()=>window.removeEventListener("resize",compute);
  },[W,H]);
  return scale;
}
// ─── CONSTANTS ────────────────────────────────────────────────
// ─── FORMATS DE PUBLICATION ───────────────────────────────────
// Le canvas garde toujours 270 px de large : seule la hauteur change, donc
// les calques (positionnés en %) et les tailles de police restent cohérents
// d'un format à l'autre.
const FORMATS = {
  story:  {id:"story",  label:"Story",  sub:"9:16", icon:"📱", w:270, h:480, desc:"Story / Reel Instagram, TikTok"},
  post:   {id:"post",   label:"Post",   sub:"4:5",  icon:"🖼️", w:270, h:337.5, desc:"Post au fil, format vertical"},
  square: {id:"square", label:"Carré",  sub:"1:1",  icon:"⬜", w:270, h:270, desc:"Post carré, Facebook / X"},
};
const DEFAULT_FORMAT = "story";
// Nombre de visuels rapatriés dans l'historique (voir commentaire au chargement).
const HISTORY_PAGE_SIZE = 60;
function fmt(id){ return FORMATS[id]||FORMATS[DEFAULT_FORMAT]; }
// Les formats ne concernent que l'éditeur libre (but, score, affiche, recrue,
// annonce). Composition XI et Groupe ont des gabarits dessinés en 9:16.
const FORMAT_TYPES = ["goal","result","match","recruit","post","perf","podium"];
// Au changement de format, les tailles de texte suivent la hauteur du canvas
// pour que rien ne déborde de son cadre.
function scaleLayersToFormat(layers,fromId,toId){
  const a=fmt(fromId), b=fmt(toId);
  if(a.h===b.h) return layers;
  const k=b.h/a.h;
  return layers.map(l=>{
    if(typeof l.fontSize!=="number") return l;
    return Object.assign({},l,{fontSize:Math.max(6,Math.round(l.fontSize*k))});
  });
}

// ─── TRI STABLE ───────────────────────────────────────────────
// Postgres ne garantit aucun ordre sans ORDER BY : sans tri explicite,
// l'effectif se réordonnait à chaque rechargement (joueurs qui "bougent",
// voire semblent disparaître). On trie côté client, partout pareil.
function sortPlayers(list){
  return [...(list||[])].sort((a,b)=>
    (a.name||"").localeCompare(b.name||"","fr",{sensitivity:"base"})
    || String(a.id).localeCompare(String(b.id)));
}
function sortPhotos(list){
  return [...(list||[])].sort((a,b)=>
    ((b.is_fav||b.fav)?1:0)-((a.is_fav||a.fav)?1:0)
    || String(a.created_at||"").localeCompare(String(b.created_at||""))
    || String(a.id).localeCompare(String(b.id)));
}

// ─── REMPLISSAGE AUTO DU JOUEUR ───────────────────────────────
// Les textes par défaut des gabarits : on ne les écrase que tant qu'ils n'ont
// pas été personnalisés (ou qu'ils portent encore le joueur précédent).
const NAME_PLACEHOLDERS = ["","prénom nom","prenom nom","nom du joueur"];
function posPlaceholders(sport){
  const sp=getSport(sport), T=termsFor(sport);
  // Le texte par défaut du gabarit, plus les variantes des autres sports :
  // changer de sport ne doit pas figer un ancien libellé.
  const own=(sp.defaultPosition+" · #"+T.numberPlaceholder).toLowerCase();
  return ["", own, "attaquant · #9", "poste · #9"];
}
function norm(s){ return (s||"").trim().toLowerCase(); }
function playerPosLabel(p){
  if(!p) return "";
  const num=(p.number===0||p.number)?String(p.number).trim():"";
  return [p.position||"",num?"#"+num:""].filter(Boolean).join(" · ");
}
function isNameLayer(l){ return l.id==="nm"||/nom\s*(du\s*)?joueur/i.test(l.label||""); }
function isPosLayer(l){ return l.id==="ps"||/^poste/i.test(l.label||""); }
function applyPlayerToLayers(layers,player,prevPlayer,sport){
  const POS_PLACEHOLDERS=posPlaceholders(sport);
  if(!player) return layers;
  const name=player.name||"";
  const pos=playerPosLabel(player);
  const prevName=prevPlayer?norm(prevPlayer.name):null;
  const prevPos=prevPlayer?norm(playerPosLabel(prevPlayer)):null;
  const free=(cur,placeholders,prevVal)=>
    placeholders.includes(norm(cur)) || (prevVal&&norm(cur)===prevVal);
  return layers.map(l=>{
    if(!l||!["text","heading","subtext"].includes(l.type)) return l;
    if(isNameLayer(l)&&name&&free(l.text,NAME_PLACEHOLDERS,prevName)) return Object.assign({},l,{text:name});
    if(isPosLayer(l)&&pos&&free(l.text,POS_PLACEHOLDERS,prevPos)) return Object.assign({},l,{text:pos});
    return l;
  });
}

const FONTS = ["Impact","Arial Black","Georgia","Helvetica Neue","Courier New","Montserrat"];
// Postes, formations et types de visuels dépendent désormais du sport du club :
// voir src/sports.js. Ces helpers évitent de trimballer l'objet sport partout.
function positionsFor(sport){ return getSport(sport).positions; }
function formationsFor(sport){ return getSport(sport).formations||{}; }
function firstFormation(sport){ const f=Object.keys(formationsFor(sport)); return f[0]||"4-4-2"; }
function navFor(terms){
  return [
    {id:"home",    icon:"🏠", label:"Accueil"},
    {id:"club",    icon:"🏟️", label:"Mon Club"},
    {id:"players", icon:"👥", label:terms.players},
    {id:"media",   icon:"🖼️", label:"Médias"},
    {id:"create",  icon:"✨", label:"Créer"},
    {id:"history", icon:"📁", label:"Historique"},
    {id:"settings",icon:"⚙️", label:"Paramètres"},
  ];
}
// ─── URL ROUTING ──────────────────────────────────────────────
// Map bidirectionnelle entre l'id de section et le path URL.
const NAV_PATHS = {
  home: "/",
  club: "/club",
  players: "/joueurs",
  media: "/medias",
  create: "/creation",
  history: "/historique",
  settings: "/reglages",
};
const PATH_TO_NAV = Object.fromEntries(Object.entries(NAV_PATHS).map(([k,v])=>[v,k]));
function navFromUrl(){
  if(typeof window==="undefined")return "home";
  // /admin et hash spéciaux gérés ailleurs — on ignore ici
  const p=window.location.pathname.replace(/\/$/,"")||"/";
  return PATH_TO_NAV[p]||"home";
}
function pathFromNav(navId){
  return NAV_PATHS[navId]||"/";
}
const LINEUP_TPLS = [
  {id:"ln1",label:"Noir Absolu",  cat:"Sombre"},
  {id:"ln2",label:"Feu & Braise", cat:"Sombre"},
  {id:"ln3",label:"Élite Serif",  cat:"Sombre"},
  {id:"ln4",label:"Élite Diag",   cat:"Moderne"},
  {id:"ln5",label:"Chrome",       cat:"Clair"},
  {id:"ln6",label:"Minimal",      cat:"Clair"},
];
const GROUP_TPLS = [
  {id:"gr1",label:"Convocation Pro", cat:"Officiel"},
  {id:"gr2",label:"Élite Dark",      cat:"Officiel"},
  {id:"gr3",label:"Trombinoscope",   cat:"Photos"},
  {id:"gr4",label:"Split Duo",       cat:"Compact"},
  {id:"gr5",label:"Minimal Clean",   cat:"Clair"},
  {id:"gr6",label:"Néon Listing",    cat:"Ambiance"},
];
const POST_TPLS = [
  {id:"pt1",label:"Quote Bold",     cat:"Texte"},
  {id:"pt2",label:"Annonce Sombre", cat:"Texte"},
  {id:"pt3",label:"Breaking News",  cat:"Texte"},
  {id:"pt4",label:"Minimal Frame",  cat:"Épuré"},
  {id:"pt5",label:"Split Couleur",  cat:"Épuré"},
  {id:"pt6",label:"Couverture",     cat:"Photo"},
];
// ─── UTILS ────────────────────────────────────────────────────
function getPhoto(p){ return p && p.photos && p.photos.length ? (p.photos.find(x=>x.is_fav||x.fav)||p.photos[0]).url : null; }
function rr(hex){ hex=(hex||"#000").replace("#",""); if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; return[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)]; }
function rgba(hex,a){ const[r,g,b]=rr(hex); return "rgba("+r+","+g+","+b+","+a+")"; }
function mixC(h1,h2,t){ const a=rr(h1),b=rr(h2); return "#"+[0,1,2].map(i=>Math.round(a[i]+(b[i]-a[i])*t).toString(16).padStart(2,"0")).join(""); }
function lum(h){ const[r,g,b]=rr(h); return(0.299*r+0.587*g+0.114*b)/255; }
function contrastText(hex){
  const[r,g,b]=rr(hex);
  const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
  const L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  return L>0.179?"#000":"#fff";
}
function buildTheme(c1,c2,mode){
  const a=c1||"#e63329", b=c2||"#1a1a2e";
  if(mode==="light"){
    return{
      bg:"#ffffff",bg2:"#f5f5f5",bg3:"#ebebeb",bg4:"#dedede",
      border:"#e0e0e0",border2:"#cfcfcf",
      text:"#111111",text2:"rgba(0,0,0,.6)",text3:"rgba(0,0,0,.4)",
      accent:a,accent2:b,
    };
  }
  if(mode==="club"){
    const dk=lum(a)<0.5;
    return{
      bg:    dk?mixC(a,"#000",.72):mixC(a,"#fff",.88),
      bg2:   dk?mixC(a,"#000",.55):mixC(a,"#fff",.76),
      bg3:   dk?mixC(a,"#000",.40):mixC(a,"#fff",.62),
      bg4:   dk?mixC(a,"#000",.25):mixC(a,"#fff",.46),
      border:rgba(a,.2), border2:rgba(a,.4),
      text:  dk?"#ffffff":"#0a0a0a",
      text2: dk?"rgba(255,255,255,.65)":"rgba(0,0,0,.55)",
      text3: dk?"rgba(255,255,255,.38)":"rgba(0,0,0,.33)",
      accent:a, accent2:b,
    };
  }
  return{
    bg:"#080810", bg2:"#0f0f1a", bg3:"#16162a", bg4:"#1e1e38",
    border:"rgba(255,255,255,.08)", border2:"rgba(255,255,255,.18)",
    text:"#f0f0f8", text2:"rgba(240,240,248,.58)", text3:"rgba(240,240,248,.33)",
    accent:a, accent2:b,
  };
}
// ─── LAYER DEFAULTS ───────────────────────────────────────────
const TD = {font:"Impact",bold:false,italic:false,upper:false,letterSpacing:0,lineHeight:1.2,bgColor:"#000000",bgOpacity:0,textShadow:8,align:"center",curve:0};
function makeLayers(type,c1,c2,sport){
  const T=termsFor(sport);
  function L(id,z,tp,x,y,w,h,label,extra){
    return Object.assign({id,z,type:tp,x,y,w,h,locked:false,label},extra||{});
  }
  const sets = {
    goal:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:70}),
      L("wm",2,"watertext",-5,18,110,32,"Filigrane",Object.assign({},TD,{text:T.scoreEventShort,fontSize:120,color:c1,opacity:12})),
      L("pl",3,"photo",5,5,90,72,"Photo "+T.playerLower),
      L("lg",4,"logo",4,4,13,13,"Logo club"),
      L("st",5,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("bt",6,"text",4,73,92,14,"Texte principal",Object.assign({},TD,{text:T.scoreEvent,fontSize:58,color:"#ffffff",bold:true})),
      L("nm",7,"text",4,86,92,8,"Nom "+T.playerLower,Object.assign({},TD,{text:"Prénom Nom",fontSize:22,color:c2})),
      L("sc",8,"scoreblock",18,92,64,7,"Score",{font:"Impact",color:c1,scoreHome:"1",scoreAway:"0"}),
    ],
    result:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:65}),
      L("pl",2,"photo",5,5,90,62,"Photo "+T.playerLower),
      L("lg",3,"logo",4,4,12,12,"Logo club"),
      L("lg2",4,"logo2",84,4,12,12,"Logo adversaire"),
      L("st",5,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("lb",6,"text",10,5,75,7,"Étiquette",Object.assign({},TD,{text:"SCORE FINAL",fontSize:18,color:"rgba(255,255,255,0.8)",italic:true})),
      L("rl",7,"resultlabel",8,66,84,6,"Résultat auto",{scoreHome:"0",scoreAway:"0"}),
      L("sb",8,"scorebig",4,71,92,17,"Score",{font:"Impact",color:"#ffffff",scoreHome:"2",scoreAway:"0",fontSize:44}),
      L("op",9,"text",8,88,84,6,T.opponent,Object.assign({},TD,{text:"vs "+T.opponent,fontSize:14,color:"rgba(255,255,255,0.4)"})),
    ],
    match:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:58}),
      L("st",2,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("cp",3,"text",8,6,84,6,"Compétition",Object.assign({},TD,{text:T.competitionPlaceholder.toUpperCase(),fontSize:11,color:"rgba(255,255,255,0.4)"})),
      L("cn",4,"text",4,22,92,16,"Mon club",Object.assign({},TD,{text:"MON CLUB",fontSize:40,color:"#ffffff",bold:true})),
      L("vs",5,"text",26,38,48,10,"VS",Object.assign({},TD,{text:"vs",fontSize:26,color:"rgba(255,255,255,0.35)",italic:true})),
      L("op",6,"text",4,47,92,13,T.opponent,Object.assign({},TD,{text:T.opponent,fontSize:32,color:"#ffffff",bold:true,italic:true})),
      L("lg",7,"logo",3,62,14,14,"Logo club"),
      L("lg2",8,"logo2",83,62,14,14,"Logo "+T.opponent.toLowerCase()),
      L("dt",9,"text",4,78,92,7,"Date",Object.assign({},TD,{text:"Samedi 12 Avril · 21h00",fontSize:14,color:"rgba(255,255,255,0.6)"})),
      L("vn",10,"text",4,85,92,6,T.venue,Object.assign({},TD,{text:"Nom du lieu",fontSize:12,color:"rgba(255,255,255,0.28)"})),
    ],
    recruit:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:52}),
      L("st",2,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("pl",3,"photo",5,4,90,66,"Photo "+T.playerLower),
      L("lg",4,"logo",4,4,12,12,"Logo club"),
      L("tg",5,"text",6,72,88,6,"Étiquette",Object.assign({},TD,{text:ctypeInfo(sport,"recruit").label.toUpperCase(),fontSize:11,color:c1,bold:true,letterSpacing:4})),
      L("nm",6,"text",6,78,88,13,"Nom "+T.playerLower,Object.assign({},TD,{text:"Prénom Nom",fontSize:32,color:"#ffffff",bold:true})),
      L("ps",7,"text",6,90,88,7,T.positionLabel,Object.assign({},TD,{text:getSport(sport).defaultPosition+" · #"+T.numberPlaceholder,fontSize:14,color:c2})),
    ],
    // Chrono / record : le « but » des sports individuels.
    perf:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:66}),
      L("pl",2,"photo",5,4,90,58,"Photo "+T.playerLower),
      L("lg",3,"logo",4,4,13,13,"Logo club"),
      L("st",4,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("tg",5,"text",6,64,88,6,"Étiquette",Object.assign({},TD,{text:"RECORD PERSONNEL",fontSize:11,color:c1,bold:true,letterSpacing:4})),
      L("tm",6,"text",4,70,92,14,"Chrono",Object.assign({},TD,{text:"00:54:12",fontSize:54,color:"#ffffff",bold:true})),
      L("nm",7,"text",4,85,92,8,"Nom "+T.playerLower,Object.assign({},TD,{text:"Prénom Nom",fontSize:22,color:"#ffffff"})),
      L("ds",8,"text",4,92,92,6,"Épreuve",Object.assign({},TD,{text:getSport(sport).defaultPosition,fontSize:13,color:c2})),
    ],
    // Podium : trois places, une épreuve.
    podium:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true,fillColor:"#0b0b12"}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:40}),
      L("st",2,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("lg",3,"logo",4,4,13,13,"Logo club"),
      L("ti",4,"text",6,20,88,10,"Titre",Object.assign({},TD,{text:"PODIUM",fontSize:44,color:"#ffffff",bold:true,letterSpacing:6})),
      L("ev",5,"text",6,31,88,6,"Épreuve",Object.assign({},TD,{text:T.competitionPlaceholder,fontSize:14,color:c1})),
      L("p1",6,"text",8,44,84,8,"1re place",Object.assign({},TD,{text:"1.  Prénom Nom  ·  00:54:12",fontSize:19,color:"#f5c542",align:"left",bold:true})),
      L("p2",7,"text",8,54,84,8,"2e place",Object.assign({},TD,{text:"2.  Prénom Nom  ·  00:55:47",fontSize:17,color:"#d8d8d8",align:"left"})),
      L("p3",8,"text",8,64,84,8,"3e place",Object.assign({},TD,{text:"3.  Prénom Nom  ·  00:57:03",fontSize:17,color:"#cd8b5a",align:"left"})),
      L("dt",9,"text",6,88,88,6,"Date / lieu",Object.assign({},TD,{text:"12 avril · "+T.venue,fontSize:12,color:"rgba(255,255,255,0.45)"})),
    ],
    post:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true,fillColor:"#000000"}),
      L("lg",1,"logo",4,4,14,14,"Logo club"),
      L("h1",2,"text",6,30,88,16,"Titre",Object.assign({},TD,{text:"TITRE DE L'ANNONCE",fontSize:38,color:"#ffffff",bold:true,upper:true,letterSpacing:1})),
      L("h2",3,"text",6,48,88,9,"Sous-titre",Object.assign({},TD,{text:"Sous-titre ou catégorie",fontSize:18,color:c1})),
      L("bd",4,"text",6,60,88,18,"Corps",Object.assign({},TD,{text:"Texte du message.",fontSize:14,color:"rgba(255,255,255,0.7)",align:"left",lineHeight:1.5})),
    ],
  };
  return JSON.parse(JSON.stringify(sets[type]||sets.goal));
}
// ─── CURVED TEXT ──────────────────────────────────────────────
function CurvedText({lay,containerW}){
  const txt = lay.upper ? (lay.text||"").toUpperCase() : (lay.text||"");
  const curve = lay.curve||0;
  if(!txt || curve===0) return null;
  const fontSize = lay.fontSize||20;
  const font = (lay.font||"Impact")+",sans-serif";
  const color = lay.color||"#fff";
  const lsp = lay.letterSpacing||0;

  // ── Géométrie ──────────────────────────────────────────────────────────
  // On part de la CORDE, pas de l'angle. La corde vaut exactement la largeur
  // du calque : l'arc va donc toujours du bord gauche au bord droit de la
  // boîte, quel que soit l'angle choisi.
  //
  // L'ancienne version déduisait le rayon du seul angle (W*180/(|curve|*2)),
  // ce qui donnait r ≈ 24 000 px à 1° et ancrait le tracé sur le centre du
  // cercle : le texte sautait de plusieurs milliers de pixels dès qu'on
  // touchait le curseur, et la hauteur du SVG suivait le rayon.
  //
  // Autre correction : la largeur utilisée était celle du canvas (270) et non
  // celle du calque, donc l'arc débordait de sa propre boîte et ignorait le
  // redimensionnement.
  const W = Math.max(8,(containerW||270)*((lay.w||100)/100));
  const half = (Math.abs(curve)*Math.PI/180)/2;   // demi-angle balayé
  // r = W / (2·sin(θ/2)) ⇒ corde = W. Quand θ → 0, r → ∞ et l'arc tend vers
  // la ligne droite de largeur W : le passage courbe/plat est continu.
  // Borne de sécurité numérique. Le curseur s'arrête à 1°, qui demande
  // r ≈ 57·W : on prend 60·W pour ne jamais rogner la corde dans la plage utile.
  const r = Math.min(W/(2*Math.sin(half)), W*60);
  const sag = r*(1-Math.cos(half));               // flèche (hauteur du bombé)
  const up = curve>0;
  const padTop = fontSize*1.15;                   // place pour les hampes
  const padBot = fontSize*0.45;                   // place pour les jambages
  const H = sag+padTop+padBot;                    // borné par la flèche, plus par r
  const cx = W/2;
  // Sommet de l'arc calé sur un bord fixe du SVG : c'est lui qui ne bouge
  // plus quand on fait varier l'angle.
  const apexY = up ? padTop : H-padBot;
  const cy = up ? apexY+r : apexY-r;
  const dx = r*Math.sin(half), dy = r*Math.cos(half);
  const x1 = cx-dx, x2 = cx+dx;
  const y = up ? cy-dy : cy+dy;                   // les deux extrémités sont à la même hauteur
  const pid = "arc_"+lay.id;
  // θ ≤ 180° par construction (curseur borné) ⇒ large-arc-flag toujours 0.
  const arcD = "M "+x1.toFixed(2)+" "+y.toFixed(2)+" A "+r.toFixed(2)+" "+r.toFixed(2)+" 0 0 "+(up?1:0)+" "+x2.toFixed(2)+" "+y.toFixed(2);
  // L'alignement du calque s'applique aussi au texte courbé.
  const anchor = lay.align==="left"?"start":lay.align==="right"?"end":"middle";
  const offset = lay.align==="left"?"0%":lay.align==="right"?"100%":"50%";
  // Le SVG occupe EXACTEMENT la boîte du calque (100 % / 100 %), et l'arc est
  // ramené dedans par le viewBox. C'est ce qui rend le texte à nouveau
  // sélectionnable : c'est la boîte du calque qui porte le onMouseDown, or
  // l'ancienne version dimensionnait le SVG sur la flèche de l'arc (jusqu'à
  // 199 px pour une boîte qui en fait souvent 48). Le texte était donc dessiné
  // hors de sa propre zone cliquable : on cliquait dessus et l'événement
  // partait au calque du dessous, en général le fond, qui est verrouillé.
  //
  // preserveAspectRatio="meet" : l'arc est mis à l'échelle sans déformation et
  // reste entièrement visible. La taille rendue suit donc aussi la taille du
  // calque, ce qui rend les boutons − / + opérants sur un texte courbé.
  return(
    <svg width="100%" height="100%" viewBox={"0 0 "+W.toFixed(2)+" "+H.toFixed(2)} preserveAspectRatio="xMidYMid meet" style={{position:"absolute",left:0,top:0,cursor:"inherit"}}>
      <defs><path id={pid} d={arcD}/></defs>
      {/* Toute la boîte est cliquable, comme pour un texte droit. C'est sans
          danger maintenant que le rect est borné au calque : la version qui
          posait problème le dimensionnait sur le rayon et couvrait le canvas. */}
      <rect x="0" y="0" width={W.toFixed(2)} height={H.toFixed(2)} fill="rgba(0,0,0,0)" pointerEvents="all"/>
      <text fontFamily={font} fontSize={fontSize} fontWeight={lay.bold?"900":"400"} fontStyle={lay.italic?"italic":"normal"} fill={color} letterSpacing={lsp} pointerEvents="visiblePainted">
        <textPath href={"#"+pid} startOffset={offset} textAnchor={anchor}>{txt}</textPath>
      </text>
    </svg>
  );
}
// ─── LAYER RENDERER ───────────────────────────────────────────
function renderLayerContent(lay, bgUrl, playerUrl, logoUrl, logo2Url, accent, accent2, clubName){
  const isTextType = ["text","watertext","heading","subtext"].includes(lay.type);
  if(lay.type==="bg") return(<div style={{width:"100%",height:"100%",overflow:"hidden",background:lay.fillColor||"transparent"}}>{bgUrl?<img src={bgUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:(lay.fillColor?null:<div style={{width:"100%",height:"100%",background:"linear-gradient(160deg,#0a0a1a,#1a0a2e)"}}/>)}</div>);
  if(lay.type==="overlay") return(<div style={{width:"100%",height:"100%",background:"linear-gradient(to bottom,rgba(0,0,0,"+((lay.opacity||60)/200)+"),rgba(0,0,0,"+((lay.opacity||60)/100)+")"}}/>);
  if(lay.type==="stripe") return(<div style={{width:"100%",height:"100%",background:"linear-gradient(90deg,"+(lay.color||accent)+","+(lay.color2||accent2)+")"}}/>);
  if(lay.type==="colorblock") return(<div style={{width:"100%",height:"100%",background:lay.color||"#ff5555",opacity:(lay.opacity==null?80:lay.opacity)/100}}/>);
  if(lay.type==="photo") return(<div style={{width:"100%",height:"100%",overflow:"hidden"}}>{playerUrl?<img src={playerUrl} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>👤</div>}</div>);
  if(lay.type==="logo"||lay.type==="logo2"){
    // Pastille de fond optionnelle : beaucoup de logos de club sont fournis
    // avec un carré blanc incrusté. Plutôt que de le subir, on assume un fond
    // uni (carré, arrondi ou cercle) de la couleur choisie — idéalement celle
    // échantillonnée sur le logo lui-même, ce qui rend la jointure invisible.
    const url=lay.type==="logo"?logoUrl:logo2Url;
    const shape=lay.bgShape||"none";
    const padPct=lay.pad==null?12:lay.pad;
    const wrap={width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box"};
    if(shape!=="none"){
      wrap.background=lay.bgColor||"#ffffff";
      wrap.borderRadius=shape==="circle"?"50%":(lay.radius==null?12:lay.radius)+"%";
      wrap.padding=padPct+"%";
      if(lay.bgBorder) wrap.border="1px solid "+rgba(lay.bgBorderColor||"#000000",.15);
    }
    const ph=lay.type==="logo"
      ? <div style={{width:"100%",height:"100%",background:rgba(accent,.2),borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:accent}}>LOGO</div>
      : <div style={{width:"100%",height:"100%",background:"rgba(255,255,255,.07)",borderRadius:4,border:"1px solid rgba(255,255,255,.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.3)"}}>ADV</div>;
    return(<div style={wrap}>{url?<img src={url} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:ph}</div>);
  }
  if(lay.type==="sponsor") return(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>{lay.url?<img src={lay.url} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:<div style={{width:"100%",height:"100%",background:"rgba(255,255,255,.05)",border:"1px dashed rgba(255,255,255,.22)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:".12em"}}>SPONSOR</div>}</div>);
  if(isTextType){
    const txt = lay.upper?(lay.text||"").toUpperCase():(lay.text||"");
    const hasBg = (lay.bgOpacity||0)>0;
    const shadow = lay.textShadow>0?"0 0 "+lay.textShadow+"px rgba(0,0,0,.85)":"none";
    const hasCurve = (lay.curve||0)!==0;
    if(hasCurve) return(<div style={{width:"100%",height:"100%",position:"relative",overflow:"visible"}}><CurvedText lay={lay} containerW={270}/></div>);
    return(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:lay.align==="left"?"flex-start":lay.align==="right"?"flex-end":"center",overflow:"hidden",padding:"2px 4px",boxSizing:"border-box"}}><span style={{fontFamily:(lay.font||"Impact")+",sans-serif",fontSize:lay.fontSize||20,color:lay.color||"#fff",fontWeight:lay.bold?"900":"400",fontStyle:lay.italic?"italic":"normal",textAlign:lay.align||"center",lineHeight:lay.lineHeight||1.2,letterSpacing:(lay.letterSpacing||0)+"px",textShadow:shadow,maxWidth:"100%",wordBreak:"break-word",background:hasBg?rgba(lay.bgColor||"#000",lay.bgOpacity||0):"transparent",padding:hasBg?"4px 10px":"0"}}>{txt}</span></div>);
  }
  if(lay.type==="scoreblock"||lay.type==="scorebig"){
    const fs = lay.fontSize||(lay.type==="scorebig"?44:22);
    const homeName = lay.homeLabel||clubName||"";
    const awayName = lay.awayLabel||"Adversaire";
    const showNames = lay.showNames!==false;
    const nameFs = Math.max(9, fs*0.22);
    return(<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:fs*0.05}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"5%",width:"100%"}}>
        <span style={{fontSize:fs,fontWeight:900,color:lay.color||"#fff",fontFamily:(lay.font||"Impact")+",sans-serif"}}>{lay.scoreHome||"0"}</span>
        <span style={{fontSize:fs*.5,color:"rgba(255,255,255,.3)",fontFamily:"Impact,sans-serif"}}>-</span>
        <span style={{fontSize:fs,fontWeight:900,color:lay.color||"#fff",fontFamily:(lay.font||"Impact")+",sans-serif"}}>{lay.scoreAway||"0"}</span>
      </div>
      {showNames&&(homeName||awayName)&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"0 4%"}}>
          <span style={{fontSize:nameFs,color:lay.color||"#fff",opacity:.75,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",maxWidth:"45%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{homeName}</span>
          <span style={{fontSize:nameFs,color:lay.color||"#fff",opacity:.75,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",maxWidth:"45%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{awayName}</span>
        </div>
      )}
    </div>);
  }
  if(lay.type==="resultlabel"){
    const sh=parseInt(lay.scoreHome||"0"), sa=parseInt(lay.scoreAway||"0");
    const autoLbl=sh>sa?"VICTOIRE":sh===sa?"MATCH NUL":"DÉFAITE";
    const lbl=(lay.text!=null&&lay.text!=="")?(lay.upper?lay.text.toUpperCase():lay.text):autoLbl;
    const autoCol=sh>sa?"#22c55e":sh===sa?"#f59e0b":"#ef4444";
    const lc=lay.color||autoCol;
    return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:lay.fontSize||11,fontWeight:700,color:lc,letterSpacing:".16em",fontFamily:(lay.font||"Impact")+",sans-serif"}}>{lbl}</span></div>;
  }
  return null;
}
function LayerView({lay,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,isSel,onMD,onResize,hideHandles,clubName}){
  const s={position:"absolute",left:lay.x+"%",top:lay.y+"%",width:lay.w+"%",height:lay.h+"%",cursor:lay.locked?"default":"grab",boxSizing:"border-box",outline:isSel&&!lay.locked?"2px solid "+accent:"none",outlineOffset:1,zIndex:lay.z};
  const showHandles=!hideHandles&&isSel&&!lay.locked&&["photo","colorblock","sponsor","logo","logo2"].includes(lay.type);
  return(<div style={s} onMouseDown={lay.locked?undefined:e=>onMD(e,lay.id)} onTouchStart={lay.locked?undefined:e=>onMD(e,lay.id)}>
    {renderLayerContent(lay,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,clubName)}
    {showHandles&&["tl","tr","bl","br"].map(c=>(
      <div key={c}
        onMouseDown={e=>{e.preventDefault();e.stopPropagation();onResize&&onResize(e,lay.id,c);}}
        onTouchStart={e=>{e.stopPropagation();onResize&&onResize(e,lay.id,c);}}
        style={{
          position:"absolute",
          width:11,height:11,
          background:"#fff",
          border:"2px solid "+accent,
          boxSizing:"border-box",
          [c[0]==="t"?"top":"bottom"]:-6,
          [c[1]==="l"?"left":"right"]:-6,
          cursor:(c==="tl"||c==="br")?"nwse-resize":"nesw-resize",
          zIndex:1000,
        }}/>
    ))}
  </div>);
}
// ─── LINEUP CANVAS ────────────────────────────────────────────
// Slider tactile : +/− 44×44 sur mobile pour ajustement fin
function TouchSlider({value,onChange,min,max,step,t,isMobile}){
  const v=value==null?min:value;
  const stp=step||1;
  const dec_=()=>onChange(Math.max(min,+(v-stp).toFixed(4)));
  const inc_=()=>onChange(Math.min(max,+(v+stp).toFixed(4)));
  return(<div style={{display:"flex",alignItems:"center",gap:isMobile?6:4,marginTop:2}}>
    {isMobile&&<button onClick={dec_} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text2,borderRadius:5,padding:0,fontSize:13,cursor:"pointer",fontWeight:700,lineHeight:1,width:44,height:36,flexShrink:0,fontFamily:"inherit"}}>−</button>}
    <input type="range" min={min} max={max} step={stp} value={v} onChange={e=>onChange(+e.target.value)} style={{flex:1,minWidth:0}}/>
    {isMobile&&<button onClick={inc_} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text2,borderRadius:5,padding:0,fontSize:13,cursor:"pointer",fontWeight:700,lineHeight:1,width:44,height:36,flexShrink:0,fontFamily:"inherit"}}>+</button>}
  </div>);
}
function Watermark(){
  // Filigrane non-amovible : pas un calque, pointerEvents:none, hardcodé dans chaque canvas
  return <div aria-hidden="true" style={{position:"absolute",bottom:5,right:6,fontSize:9,color:"rgba(255,255,255,0.92)",background:"rgba(0,0,0,0.42)",padding:"2px 7px",borderRadius:3,fontFamily:"'DM Mono',ui-monospace,system-ui,monospace",letterSpacing:"0.04em",fontWeight:500,whiteSpace:"nowrap",pointerEvents:"none",userSelect:"none",zIndex:999}}>Powered by Viziona</div>;
}
// ─── TRACÉ DE L'AIRE DE JEU ───────────────────────────────────
// Football, rugby, patinoire et parquet n'ont pas les mêmes lignes : la
// composition doit être lisible comme une vraie feuille de match.
function PitchLines({kind,stroke,dark}){
  const wrap={position:"absolute",inset:0,width:"100%",height:"100%",opacity:dark?.12:.09,pointerEvents:"none"};
  if(kind==="rugby") return(
    <svg style={wrap} viewBox="0 0 270 480">
      <rect x="18" y="6" width="234" height="375" fill="none" stroke={stroke} strokeWidth="1"/>
      <line x1="18" y1="193" x2="252" y2="193" stroke={stroke} strokeWidth=".8"/>
      {/* En-buts + lignes des 22 mètres */}
      <line x1="18" y1="46" x2="252" y2="46" stroke={stroke} strokeWidth=".7"/>
      <line x1="18" y1="341" x2="252" y2="341" stroke={stroke} strokeWidth=".7"/>
      <line x1="18" y1="103" x2="252" y2="103" stroke={stroke} strokeWidth=".5" strokeDasharray="4 4" opacity=".7"/>
      <line x1="18" y1="284" x2="252" y2="284" stroke={stroke} strokeWidth=".5" strokeDasharray="4 4" opacity=".7"/>
      {/* Poteaux en H */}
      <path d="M123 30 V52 M147 30 V52 M123 41 H147" fill="none" stroke={stroke} strokeWidth=".7" opacity=".8"/>
      <path d="M123 335 V357 M147 335 V357 M123 346 H147" fill="none" stroke={stroke} strokeWidth=".7" opacity=".8"/>
    </svg>
  );
  if(kind==="ice") return(
    <svg style={wrap} viewBox="0 0 270 480">
      <rect x="18" y="6" width="234" height="375" rx="46" fill="none" stroke={stroke} strokeWidth="1"/>
      {/* Ligne rouge médiane et lignes bleues */}
      <line x1="18" y1="193" x2="252" y2="193" stroke={stroke} strokeWidth="1"/>
      <line x1="18" y1="132" x2="252" y2="132" stroke={stroke} strokeWidth=".8"/>
      <line x1="18" y1="254" x2="252" y2="254" stroke={stroke} strokeWidth=".8"/>
      <ellipse cx="135" cy="193" rx="26" ry="26" fill="none" stroke={stroke} strokeWidth=".8"/>
      {/* Points d'engagement */}
      {[[70,70],[200,70],[70,317],[200,317]].map(([cx,cy],i)=>(
        <ellipse key={i} cx={cx} cy={cy} rx="17" ry="17" fill="none" stroke={stroke} strokeWidth=".5" opacity=".7"/>
      ))}
      {/* Buts */}
      <rect x="117" y="24" width="36" height="9" fill="none" stroke={stroke} strokeWidth=".6" opacity=".8"/>
      <rect x="117" y="348" width="36" height="9" fill="none" stroke={stroke} strokeWidth=".6" opacity=".8"/>
    </svg>
  );
  if(kind==="handball") return(
    <svg style={wrap} viewBox="0 0 270 480">
      <rect x="18" y="6" width="234" height="375" fill="none" stroke={stroke} strokeWidth="1"/>
      <line x1="18" y1="193" x2="252" y2="193" stroke={stroke} strokeWidth=".8"/>
      {/* Zones des 6 m (trait plein) et des 9 m (pointillé) */}
      <path d="M18 6 V52 A72 72 0 0 0 252 52 V6" fill="none" stroke={stroke} strokeWidth=".7"/>
      <path d="M18 381 V335 A72 72 0 0 1 252 335 V381" fill="none" stroke={stroke} strokeWidth=".7"/>
      <path d="M18 6 V78 A96 96 0 0 0 252 78 V6" fill="none" stroke={stroke} strokeWidth=".5" strokeDasharray="5 5" opacity=".75"/>
      <path d="M18 381 V309 A96 96 0 0 1 252 309 V381" fill="none" stroke={stroke} strokeWidth=".5" strokeDasharray="5 5" opacity=".75"/>
      {/* Buts */}
      <rect x="117" y="6" width="36" height="7" fill="none" stroke={stroke} strokeWidth=".6" opacity=".85"/>
      <rect x="117" y="374" width="36" height="7" fill="none" stroke={stroke} strokeWidth=".6" opacity=".85"/>
    </svg>
  );
  if(kind==="court") return(
    <svg style={wrap} viewBox="0 0 270 480">
      <rect x="18" y="6" width="234" height="375" fill="none" stroke={stroke} strokeWidth="1"/>
      <line x1="18" y1="193" x2="252" y2="193" stroke={stroke} strokeWidth=".8"/>
      <ellipse cx="135" cy="193" rx="30" ry="30" fill="none" stroke={stroke} strokeWidth=".8"/>
      {/* Raquettes et arcs */}
      <rect x="97" y="6" width="76" height="66" fill="none" stroke={stroke} strokeWidth=".6"/>
      <rect x="97" y="315" width="76" height="66" fill="none" stroke={stroke} strokeWidth=".6"/>
      <path d="M97 72 A38 38 0 0 0 173 72" fill="none" stroke={stroke} strokeWidth=".6"/>
      <path d="M97 315 A38 38 0 0 1 173 315" fill="none" stroke={stroke} strokeWidth=".6"/>
      <path d="M42 6 V52 A93 93 0 0 0 228 52 V6" fill="none" stroke={stroke} strokeWidth=".5" opacity=".7"/>
      <path d="M42 381 V335 A93 93 0 0 1 228 335 V381" fill="none" stroke={stroke} strokeWidth=".5" opacity=".7"/>
    </svg>
  );
  // Football par défaut
  return(
    <svg style={wrap} viewBox="0 0 270 480">
      <rect x="18" y="6" width="234" height="375" rx="3" fill="none" stroke={stroke} strokeWidth="1"/>
      <line x1="18" y1="193" x2="252" y2="193" stroke={stroke} strokeWidth=".8"/>
      <ellipse cx="135" cy="193" rx="36" ry="36" fill="none" stroke={stroke} strokeWidth=".8"/>
      <rect x="18" y="6" width="234" height="50" fill="none" stroke={stroke} strokeWidth=".5" opacity=".7"/>
      <rect x="18" y="331" width="234" height="50" fill="none" stroke={stroke} strokeWidth=".5" opacity=".7"/>
      <ellipse cx="135" cy="6" rx="22" ry="11" fill="none" stroke={stroke} strokeWidth=".5" opacity=".6"/>
      <ellipse cx="135" cy="381" rx="22" ry="11" fill="none" stroke={stroke} strokeWidth=".5" opacity=".6"/>
    </svg>
  );
}
function LineupCanvas({ld,tpl,logoUrl,logo2Url,accent,accent2,bgUrl,W,H,slotScale,sport}){
  W=W||270; H=H||480; slotScale=slotScale||1;
  const F0=formationsFor(sport);
  const fm=(ld&&ld.formation&&F0[ld.formation])?ld.formation:(Object.keys(F0)[0]||"4-4-2");
  const starters=ld&&ld.starters?ld.starters:[];
  const subs=ld&&ld.subs?ld.subs.filter(Boolean):[];
  const competition=ld&&ld.competition?ld.competition:"";
  const F=formationsFor(sport);
  const fRows=F[fm]||F[Object.keys(F)[0]]||[{n:1},{n:4},{n:4},{n:2}];
  let li=0;
  const rows=fRows.map(function(r){const players=starters.slice(li,li+r.n);li+=r.n;return{n:r.n,label:(r.l||"").slice(0,3).toUpperCase(),players:players};});
  const dark=tpl!=="ln5"&&tpl!=="ln6";
  const root={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<160?6:14,flexShrink:0,display:"flex",flexDirection:"column",userSelect:"none"};
  function Logo(props){const sz=props.sz||W*.1;if(!props.url)return<div style={{width:sz,height:sz,borderRadius:4,background:rgba(accent,.25),display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontSize:sz*.3}}>◈</div>;return<img src={props.url} style={{width:sz,height:sz,objectFit:"contain"}} alt=""/>;}
  function Slot(props){const p=props.p;const sz=props.sz||W*.09;const square=props.square;const ph=getPhoto(p);return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:"1 1 0",minWidth:0,padding:"0 2px",boxSizing:"border-box"}}><div style={{width:sz,height:sz,borderRadius:square?6:"50%",overflow:"hidden",border:"2px solid "+accent,background:dark?"rgba(0,0,0,.5)":"#e0e0e8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:sz*.34,fontWeight:900,color:accent,fontFamily:"Impact,sans-serif"}}>{p&&p.number?p.number:"?"}</span>}</div><span style={{fontSize:W*.024,color:dark?"#fff":"#111",fontWeight:700,textAlign:"center",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:dark?"0 1px 5px #000":"none"}}>{p&&p.name?p.name.split(" ").pop():"—"}</span></div>);}
  const bg={ln1:"#030305",ln2:"#0a0000",ln3:"#0a0805",ln4:"#060408",ln5:"#f2f2f4",ln6:"#fafafa"}[tpl]||"#030305";
  // FIX Lucas Test 26 : le template "Minuit Doré" (ln3) forçait un jaune #FFD700 aléatoire.
  // On l'adapte à la couleur du club : "Minuit Doré" devient un template élégant basé sur accent1.
  const GOLD=accent;
  const isGold=tpl==="ln3";
  const fieldStroke=isGold?GOLD:(dark?accent:"#666");
  return(<div style={Object.assign({},root,{background:bg})}>
    {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:dark?.44:.36}} alt=""/>}
    {dark&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.7),rgba(0,0,0,.42),rgba(0,0,0,.7))"}}/>}
    {tpl==="ln2"&&<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 100%,"+rgba(accent,.5)+" 0%,transparent 65%)"}}/>}
    {/* ln3 "Minuit Doré" (renommé "Élite" en logique) : halo teinté couleur du club, plus de jaune hardcodé */}
    {isGold&&<div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 78% 18%,"+rgba(accent,.22)+" 0%,transparent 55%),linear-gradient(160deg,"+rgba(accent,.08)+" 0%,transparent 45%,"+rgba(accent2,.25)+" 100%)"}}/>}
    {tpl==="ln4"&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.06}} viewBox="0 0 270 480"><polygon points="0,0 200,0 0,240" fill={rgba(accent,.2)}/><polygon points="270,480 70,480 270,240" fill={rgba(accent2,.2)}/></svg>}
    {/* Tracé de l'aire de jeu, dessiné selon le sport du club */}
    <PitchLines kind={getSport(sport).pitch} stroke={fieldStroke} dark={dark}/>
    {tpl==="ln6"&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:"linear-gradient(to bottom,"+accent+","+accent2+")",zIndex:3}}/>}
    {tpl==="ln5"&&<div style={{position:"absolute",top:0,left:0,right:0,height:"27%",background:"linear-gradient(135deg,"+accent+","+accent2+")",zIndex:1}}/>}
    {dark&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:isGold?"linear-gradient(90deg,transparent,"+accent+","+rgba(accent,.6)+","+accent+",transparent)":"linear-gradient(90deg,transparent,"+accent+","+accent2+","+accent+",transparent)",zIndex:4}}/>}
    {/* ln3 : second filet doré tout en bas pour cadrer */}
    {isGold&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,"+GOLD+",transparent)",zIndex:4,opacity:.7}}/>}
    <div style={{position:"relative",zIndex:3,padding:(W*.03)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Logo url={logoUrl} sz={W*.09}/>
      <div style={{textAlign:"center",overflow:"hidden",maxWidth:W*.6}}>{competition&&<div style={{fontSize:W*.022,color:isGold?accent:(dark?rgba(accent,.7):"#666"),letterSpacing:".13em",textTransform:"uppercase",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{competition}</div>}<div style={{fontSize:W*.032,fontWeight:isGold?400:700,color:isGold?accent:(dark?"#fff":"#111"),fontFamily:isGold?"Georgia,'Times New Roman',serif":"Impact,sans-serif",fontStyle:isGold?"italic":"normal",letterSpacing:isGold?".02em":".05em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>XI · {fm}</div>{ld&&ld.opponent&&<div style={{fontSize:W*.024,color:isGold?rgba(accent,.65):(dark?"rgba(255,255,255,.6)":"#555"),fontFamily:isGold?"Georgia,serif":"Impact,sans-serif",fontStyle:"italic",letterSpacing:".04em",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {ld.opponent}</div>}</div>
      <Logo url={logo2Url} sz={W*.08}/>
    </div>
    <div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:"0 "+(W*.018)+"px"}}>
      {[].concat(rows).reverse().map(function(row,ri){const rowSz=Math.min(W*0.088,W*0.75/row.n)*slotScale;const denseRow=row.n>=5;return(<div key={ri} style={{display:"flex",justifyContent:denseRow?"space-evenly":"space-around",alignItems:"center",overflow:"hidden",gap:W*(row.n>4?0.005:0.01)}}>{Array.from({length:row.n}).map(function(_,pi){return<Slot key={pi} p={row.players[pi]} sz={rowSz} square={tpl==="ln4"}/>})}</div>);})}
    </div>
    {/* FIX Lucas Test 21 : le "Powered by Viziona" (Watermark) chevauchait les remplaçants
        quand il y en avait beaucoup. On réserve un paddingRight en bas suffisant pour la watermark
        (~30% de W soit ~80px sur canvas 270) — la row de remplaçants ne s'étend plus jusqu'au bord droit. */}
    {subs.length>0&&<div style={{position:"relative",zIndex:3,borderTop:"1px solid "+rgba(accent,.3),background:rgba(dark?"#000":"#f0f0f0",.55),padding:(W*.012)+"px "+(W*.035)+"px",paddingRight:(W*.30)+"px",paddingBottom:(W*.032)+"px"}}><div style={{fontSize:W*.02,color:rgba(dark?"#fff":"#000",.38),letterSpacing:".1em",marginBottom:2}}>REMPLAÇANTS</div><div style={{display:"flex",gap:W*.016,flexWrap:"wrap",alignItems:"center"}}>{subs.map(function(s,i){const ph=getPhoto(s);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.009}}>{ph?<img src={ph} style={{width:W*.046,height:W*.046,borderRadius:"50%",objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(accent,.4)}} alt=""/>:<div style={{width:W*.046,height:W*.046,borderRadius:"50%",background:rgba(accent,.2),display:"flex",alignItems:"center",justifyContent:"center",fontSize:W*.018,color:accent}}>{s.number||"?"}</div>}<span style={{fontSize:W*.023,color:rgba(dark?"#fff":"#000",.5)}}>{s.name?s.name.split(" ").pop():""}</span></div>);})}</div></div>}
    <Watermark/>
  </div>);
}
// ─── GROUP CANVAS ─────────────────────────────────────────────
function GroupCanvas({gd,tpl,logoUrl,logo2Url,accent,accent2,bgUrl,W,H}){
  W=W||270; H=H||480;
  const title=gd&&gd.title?gd.title:"GROUPE A";
  const competition=gd&&gd.competition?gd.competition:"";
  const gk=gd&&gd.gk?gd.gk:[];
  const def=gd&&gd.def?gd.def:[];
  const mid=gd&&gd.mid?gd.mid:[];
  const fwd=gd&&gd.fwd?gd.fwd:[];
  const coaches=gd&&gd.coaches?gd.coaches:[];
  // Titre éditable : font/size/color avec fallback aux défauts du template
  const titleFont=(gd&&gd.titleFont)||"Impact";
  const titleSizeOv=gd&&gd.titleSize;
  const titleColorOv=gd&&gd.titleColor;
  function tFont(){return titleFont+",sans-serif";}
  function tSize(defPx){return titleSizeOv||defPx;}
  function tColor(defC){return titleColorOv||defC;}
  const root={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<160?6:14,flexShrink:0,display:"flex",flexDirection:"column",userSelect:"none"};
  function Logo(props){const sz=props.sz||W*.1;if(!props.url)return<div style={{width:sz,height:sz,borderRadius:4,background:rgba(accent,.25),display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontSize:sz*.3}}>◈</div>;return<img src={props.url} style={{width:sz,height:sz,objectFit:"contain"}} alt=""/>;}
  function PlayerRow(props){const p=props.p;const col=props.col||accent;const ph=p.photo||getPhoto(p);return(<div style={{display:"flex",alignItems:"center",gap:W*.018,marginBottom:W*.009,padding:(W*.005)+"px",borderRadius:3,background:rgba("#fff",.025)}}>{ph?<img src={ph} style={{width:W*.074,height:W*.074,borderRadius:W*.009,objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(col,.3)}} alt=""/>:<div style={{width:W*.074,height:W*.074,borderRadius:W*.009,background:rgba(col,.13),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:W*.026,fontWeight:900,color:col}}>{p.number||"?"}</div>}<span style={{flex:1,color:"rgba(255,255,255,.82)",fontSize:W*.032}}>{p.name||"—"}{p.captain&&<span style={{color:col,fontSize:W*.024,marginLeft:W*.009}}> ©</span>}</span>{p.number&&<span style={{fontSize:W*.028,color:rgba("#fff",.16),fontFamily:"Impact,sans-serif"}}>#{p.number}</span>}</div>);}
  function StaffSep(props){
    const isDark=props.dark!==false;
    const lineCol=isDark?"rgba(255,255,255,.18)":"rgba(0,0,0,.1)";
    const txtCol=isDark?"rgba(255,255,255,.6)":"#888";
    return(<div style={{display:"flex",alignItems:"center",gap:W*.012,margin:(W*.022)+"px 0 "+(W*.012)+"px"}}>
      <div style={{flex:1,height:1,background:lineCol}}/>
      <span style={{fontSize:W*.02,color:txtCol,letterSpacing:".22em",fontWeight:700,textTransform:"uppercase"}}>Staff</span>
      <div style={{flex:1,height:1,background:lineCol}}/>
    </div>);
  }
  if(tpl==="gr3"){
    const allP=[].concat(gk,def,mid,fwd).slice(0,16);
    return(<div style={Object.assign({},root,{background:"#fff"})}>
      {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.05}} alt=""/>}
      <div style={{position:"relative",zIndex:2,background:"linear-gradient(135deg,"+accent+","+accent2+")",padding:(W*.028)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo url={logoUrl} sz={W*.09}/>
        <div style={{textAlign:"center"}}>{competition&&<div style={{fontSize:W*.022,color:"rgba(255,255,255,.76)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:tSize(W*.052),fontWeight:900,color:tColor("#fff"),fontFamily:tFont(),letterSpacing:".05em"}}>{title}</div></div>
        <Logo url={logo2Url} sz={W*.08}/>
      </div>
      <div style={{position:"relative",zIndex:2,flex:1,padding:(W*.018)+"px",overflowY:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:W*.012,alignContent:"start"}}>{allP.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:W*.18,height:W*.22,borderRadius:W*.016,overflow:"hidden",border:"2px solid "+rgba(accent,.25),background:"#eee",display:"flex",alignItems:"center",justifyContent:"center"}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{fontSize:W*.05,color:"#ccc"}}>👤</div>}</div><span style={{fontSize:W*.024,fontWeight:700,color:"#111",textAlign:"center",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</span>{p.number&&<span style={{fontSize:W*.019,color:accent,fontWeight:700}}>#{p.number}</span>}</div>);})}</div>
        {coaches.length>0&&<>
          <StaffSep dark={false}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:W*.012,alignContent:"start"}}>{coaches.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={"st"+i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:W*.15,height:W*.18,borderRadius:W*.016,overflow:"hidden",border:"1px solid rgba(0,0,0,.12)",background:"#eee",display:"flex",alignItems:"center",justifyContent:"center"}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{fontSize:W*.04,color:"#bbb"}}>👤</div>}</div><span style={{fontSize:W*.021,fontWeight:600,color:"#555",textAlign:"center",maxWidth:W*.17,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</span></div>);})}</div>
        </>}
      </div>
      <Watermark/>
    </div>);
  }
  if(tpl==="gr4"){
    const left=[].concat(gk,def),right=[].concat(mid,fwd);
    return(<div style={Object.assign({},root,{background:"#f5f5f7"})}>
      {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.06}} alt=""/>}
      <div style={{position:"relative",zIndex:2,background:"linear-gradient(90deg,"+accent+","+accent2+")",padding:(W*.025)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo url={logoUrl} sz={W*.085}/>
        <div style={{textAlign:"center"}}>{competition&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.76)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:tSize(W*.04),fontWeight:900,color:tColor("#fff"),fontFamily:tFont()}}>{title}</div></div>
        <Logo url={logo2Url} sz={W*.07}/>
      </div>
      <div style={{position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr"}}>
          <div style={{padding:(W*.016)+"px "+(W*.018)+"px"}}><div style={{fontSize:W*.019,color:accent,fontWeight:700,letterSpacing:".1em",marginBottom:W*.012}}>GK · DEF</div>{left.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.012,marginBottom:W*.012,paddingBottom:W*.012,borderBottom:"1px solid rgba(0,0,0,.05)"}}><div style={{width:W*.078,height:W*.078,borderRadius:"50%",overflow:"hidden",border:"2px solid "+rgba(accent,.28),background:"#ddd",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.026,fontWeight:900,color:accent,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{p.number||""}</span>}</div><div><div style={{fontSize:W*.028,fontWeight:700,color:"#111",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</div>{p.number&&<div style={{fontSize:W*.018,color:accent}}>#{p.number}</div>}</div></div>);})}</div>
          <div style={{background:"rgba(0,0,0,.08)"}}/>
          <div style={{padding:(W*.016)+"px "+(W*.018)+"px"}}><div style={{fontSize:W*.019,color:accent2,fontWeight:700,letterSpacing:".1em",marginBottom:W*.012}}>MIL · ATT</div>{right.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.012,marginBottom:W*.012,paddingBottom:W*.012,borderBottom:"1px solid rgba(0,0,0,.05)"}}><div style={{width:W*.078,height:W*.078,borderRadius:"50%",overflow:"hidden",border:"2px solid "+rgba(accent2,.28),background:"#ddd",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.026,fontWeight:900,color:accent2,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{p.number||""}</span>}</div><div><div style={{fontSize:W*.028,fontWeight:700,color:"#111",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</div>{p.number&&<div style={{fontSize:W*.018,color:accent2}}>#{p.number}</div>}</div></div>);})}</div>
        </div>
        {coaches.length>0&&<div style={{padding:"0 "+(W*.018)+"px "+(W*.018)+"px"}}>
          <StaffSep dark={false}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:W*.018}}>{coaches.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={"st"+i} style={{display:"flex",alignItems:"center",gap:W*.01}}>{ph?<img src={ph} style={{width:W*.05,height:W*.05,borderRadius:"50%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{width:W*.05,height:W*.05,borderRadius:"50%",background:"#ddd"}}/>}<span style={{fontSize:W*.022,color:"#555",fontWeight:600}}>{p.name||"—"}</span></div>);})}</div>
        </div>}
      </div>
      <Watermark/>
    </div>);
  }
  if(tpl==="gr5"){const cats=[{l:"GARDIENS",list:gk,c:accent},{l:"DÉFENSEURS",list:def,c:accent2},{l:"MILIEUX",list:mid,c:accent},{l:"ATTAQUANTS",list:fwd,c:accent2}];if(coaches.length)cats.push({l:"STAFF",list:coaches,c:"rgba(255,255,255,.5)"});return(<div style={Object.assign({},root,{background:"#f8f9fa"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.06}} alt=""/>}<div style={{position:"relative",zIndex:2,padding:(W*.03)+"px "+(W*.04)+"px",background:"#fff",borderBottom:"1px solid #e8e8e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:W*.025}}><Logo url={logoUrl} sz={W*.1}/><div><div style={{fontSize:tSize(W*.048),fontWeight:900,color:tColor("#111"),fontFamily:tFont(),letterSpacing:".04em"}}>{title}</div>{competition&&<div style={{fontSize:W*.019,color:"#888",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}</div></div><Logo url={logo2Url} sz={W*.082}/></div><div style={{height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")"}}/>  <div style={{position:"relative",zIndex:2,flex:1,overflowY:"auto",padding:(W*.022)+"px "+(W*.03)+"px"}}>{cats.map(function(cat,ci){if(!cat.list.length)return null;return(<div key={ci} style={{marginBottom:W*.018}}><div style={{display:"flex",alignItems:"center",gap:W*.014,marginBottom:W*.012}}><div style={{width:3,height:W*.03,borderRadius:2,background:cat.c}}/><span style={{fontSize:W*.022,color:cat.c,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>{cat.l}</span><span style={{fontSize:W*.019,color:"#bbb",marginLeft:"auto"}}>{cat.list.length}</span></div>{cat.list.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.018,background:"#fff",borderRadius:W*.016,padding:(W*.01)+"px "+(W*.018)+"px",border:"1px solid #f0f0f0",marginBottom:W*.007}}>{ph?<img src={ph} style={{width:W*.072,height:W*.072,borderRadius:W*.012,objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(cat.c,.3)}} alt=""/>:<div style={{width:W*.072,height:W*.072,borderRadius:W*.012,background:rgba(cat.c,.12),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:W*.026,fontWeight:900,color:cat.c}}>{p.number||"?"}</div>}<span style={{flex:1,fontSize:W*.032,color:"#111",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name||"—"}{p.captain&&<span style={{color:cat.c,fontSize:W*.022,marginLeft:W*.009}}>©</span>}</span>{p.number&&<span style={{fontSize:W*.028,fontWeight:700,color:cat.c,fontFamily:"Impact,sans-serif"}}>#{p.number}</span>}</div>);})}</div>);})}</div><Watermark/></div>);}
  // gr2 "Élite Dark" — style magazine sportif : grande photo de fond, typo massive, bandes diagonales
  if(tpl==="gr2"){
    const allP=[].concat(gk,def,mid,fwd);
    const staffList=coaches||[];
    return(<div style={Object.assign({},root,{background:"#020208"})}>
      {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.6,filter:"contrast(1.05) saturate(1.1)"}} alt=""/>}
      {/* Voile dégradé : opaque en bas, semi en haut pour laisser respirer la photo */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 35%,rgba(0,0,0,.85) 75%,rgba(0,0,0,.95) 100%)"}}/>
      {/* Bandes diagonales magazine */}
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} viewBox="0 0 270 480" preserveAspectRatio="none">
        <polygon points="0,40 270,0 270,18 0,58" fill={accent} opacity=".9"/>
        <polygon points="0,62 270,22 270,30 0,70" fill={accent2} opacity=".75"/>
        <polygon points="0,420 270,400 270,408 0,428" fill={accent} opacity=".55"/>
      </svg>
      {/* Header logos */}
      <div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.045)+"px "+(W*.025)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Logo url={logoUrl} sz={W*.11}/>
        {competition&&<div style={{fontSize:W*.022,color:rgba("#fff",.55),letterSpacing:".18em",textTransform:"uppercase",fontWeight:600}}>{competition}</div>}
        <Logo url={logo2Url} sz={W*.085}/>
      </div>
      {/* Titre massif */}
      <div style={{position:"relative",zIndex:3,padding:"0 "+(W*.045)+"px",marginTop:W*.01,marginBottom:W*.025}}>
        <div style={{fontSize:tSize(W*.105),fontWeight:900,color:tColor("#fff"),fontFamily:tFont(),letterSpacing:"-.01em",lineHeight:.95,textTransform:"uppercase",textShadow:"0 4px 18px rgba(0,0,0,.5)"}}>{title}</div>
        <div style={{width:W*.18,height:3,background:accent,marginTop:W*.018,borderRadius:1}}/>
      </div>
      {/* Liste joueurs condensée */}
      <div style={{position:"relative",zIndex:3,flex:1,overflowY:"auto",padding:(W*.012)+"px "+(W*.045)+"px"}}>
        {allP.map(function(p,i){
          const ph=p.photo||getPhoto(p);
          return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.018,padding:(W*.008)+"px 0",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
            <span style={{fontSize:W*.022,color:rgba(accent,.85),fontWeight:700,fontFamily:"Impact,sans-serif",letterSpacing:".06em",minWidth:W*.05}}>{String(i+1).padStart(2,"0")}</span>
            {ph?<img src={ph} style={{width:W*.062,height:W*.062,borderRadius:"50%",objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(accent,.4)}} alt=""/>:<div style={{width:W*.062,height:W*.062,borderRadius:"50%",background:rgba(accent,.18),display:"flex",alignItems:"center",justifyContent:"center",fontSize:W*.022,fontWeight:900,color:accent}}>{p.number||"?"}</div>}
            <span style={{flex:1,fontSize:W*.028,color:"#fff",fontWeight:600,letterSpacing:".01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name||"—"}{p.captain&&<span style={{color:accent,marginLeft:6}}>©</span>}</span>
            {p.number&&<span style={{fontSize:W*.028,color:rgba("#fff",.4),fontFamily:"Impact,sans-serif",fontWeight:900}}>#{p.number}</span>}
          </div>);
        })}
        {/* Séparateur staff */}
        {staffList.length>0&&<>
          <div style={{display:"flex",alignItems:"center",gap:W*.014,marginTop:W*.022,marginBottom:W*.012}}>
            <div style={{flex:1,height:1,background:rgba("#fff",.18)}}/>
            <span style={{fontSize:W*.02,color:rgba("#fff",.6),letterSpacing:".22em",fontWeight:700,textTransform:"uppercase"}}>Staff</span>
            <div style={{flex:1,height:1,background:rgba("#fff",.18)}}/>
          </div>
          {staffList.map(function(p,i){
            const ph=p.photo||getPhoto(p);
            return(<div key={"st"+i} style={{display:"flex",alignItems:"center",gap:W*.018,padding:(W*.006)+"px 0"}}>
              {ph?<img src={ph} style={{width:W*.05,height:W*.05,borderRadius:"50%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{width:W*.05,height:W*.05,borderRadius:"50%",background:"rgba(255,255,255,.1)"}}/>}
              <span style={{flex:1,fontSize:W*.025,color:rgba("#fff",.78),letterSpacing:".02em"}}>{p.name||"—"}</span>
            </div>);
          })}
        </>}
      </div>
      <Watermark/>
    </div>);
  }
  const isNeon=tpl==="gr6";
  // FIX Lucas Test 26 : "Néon Listing" utilisait 4 couleurs aléatoires (turquoise/bleu/rose/jaune).
  // On garde le glow néon (textShadow ligne suivante) mais on alterne accent/accent2 du club.
  const cats2=[{l:"GARDIENS",list:gk,c:accent},{l:"DÉFENSEURS",list:def,c:accent2},{l:"MILIEUX",list:mid,c:accent},{l:"ATTAQUANTS",list:fwd,c:accent2}];
  const bg2={gr1:"#020208",gr6:"#04040c"}[tpl]||"#020208";
  return(<div style={Object.assign({},root,{background:bg2})}>
    {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.12}} alt=""/>}
    <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,"+rgba(accent,.11)+",transparent 50%,"+rgba(accent2,.08)+")"}}/>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/>
    <div style={{position:"relative",zIndex:3,padding:(W*.03)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:W*.02}}>
      <Logo url={logoUrl} sz={W*.105}/>
      <div style={{flex:1,textAlign:"center",overflow:"hidden"}}>
        {competition&&<div style={{fontSize:W*.019,color:rgba("#fff",.32),letterSpacing:".12em",textTransform:"uppercase"}}>{competition}</div>}
        <div style={{fontSize:tSize(W*.054),fontWeight:900,color:tColor("#fff"),fontFamily:tFont(),letterSpacing:".05em",textShadow:isNeon?"0 0 20px "+rgba(accent,.5):"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
      </div>
      <Logo url={logo2Url} sz={W*.085}/>
    </div>
    <div style={{position:"relative",zIndex:3,flex:1,overflowY:"auto",padding:(W*.005)+"px "+(W*.04)+"px "+(W*.018)+"px"}}>
      {cats2.map(function(cat,ci){if(!cat.list.length)return null;return(<div key={ci} style={{marginBottom:W*.018}}><div style={{display:"flex",alignItems:"center",gap:W*.014,marginBottom:W*.008}}><div style={{width:W*.04,height:1,background:cat.c}}/><span style={{fontSize:W*.022,color:cat.c,fontWeight:700,letterSpacing:".12em"}}>{cat.l} ({cat.list.length})</span><div style={{flex:1,height:1,background:rgba(cat.c,.2)}}/></div>{cat.list.map(function(p,i){return<PlayerRow key={i} p={p} col={cat.c}/>;})}</div>);})}
      {coaches.length>0&&<>
        <StaffSep dark={true}/>
        {coaches.map(function(p,i){return<PlayerRow key={"st"+i} p={p} col="rgba(255,255,255,.55)"/>;})}
      </>}
    </div>
    <Watermark/>
  </div>);
}
// ─── POST CANVAS ──────────────────────────────────────────────
function PostCanvas({pd,tpl,logoUrl,accent,accent2,bgUrl,W,H}){
  W=W||270; H=H||480;
  const title=pd&&pd.title?pd.title:"TITRE";
  const subtitle=pd&&pd.subtitle?pd.subtitle:"Sous-titre";
  const body=pd&&pd.body?pd.body:"Texte du message.";
  const date=pd&&pd.date?pd.date:"";
  const hashtag=pd&&pd.hashtag?pd.hashtag:"";
  const root={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<160?6:14,flexShrink:0,display:"flex",flexDirection:"column",userSelect:"none"};
  function Logo(props){const sz=props.sz||W*.09;if(!logoUrl)return<div style={{width:sz,height:sz,borderRadius:4,background:rgba(accent,.25),display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontSize:sz*.3}}>◈</div>;return<img src={logoUrl} style={{width:sz,height:sz,objectFit:"contain"}} alt=""/>;}
  if(tpl==="pt2")return(<div style={Object.assign({},root,{background:"#06060e"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,"+rgba(accent,.12)+",transparent 50%,"+rgba(accent2,.08)+")"}}/>  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.1}/>{date&&<div style={{fontSize:W*.022,color:"rgba(255,255,255,.3)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:(W*.05)+"px"}}><div style={{fontSize:W*.022,color:accent,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",marginBottom:W*.02}}>{subtitle}</div><div style={{fontSize:W*.06,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,textTransform:"uppercase",marginBottom:W*.025}}>{title}</div><div style={{width:W*.08,height:2,background:accent,marginBottom:W*.025,borderRadius:2}}/><div style={{fontSize:W*.028,color:"rgba(255,255,255,.58)",lineHeight:1.5}}>{body}</div>{hashtag&&<div style={{marginTop:W*.04,fontSize:W*.022,color:rgba(accent,.6)}}>{hashtag}</div>}</div><Watermark/></div>);
  if(tpl==="pt3")return(<div style={Object.assign({},root,{background:"#0a0000"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.2}} alt=""/>}<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,"+rgba(accent,.4)+" 0%,rgba(0,0,0,.9) 60%)"}}/><div style={{position:"relative",zIndex:3,background:"rgba(0,0,0,.7)",padding:(W*.022)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",gap:W*.02}}><div style={{background:accent,borderRadius:3,padding:(W*.008)+"px "+(W*.018)+"px",fontSize:W*.024,fontWeight:900,color:"#fff",letterSpacing:".08em"}}>BREAKING</div><div style={{flex:1,height:1,background:rgba(accent,.3)}}/><Logo sz={W*.07}/></div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.05)+"px",gap:W*.03}}><div style={{fontSize:W*.019,color:rgba(accent,.8),fontWeight:700,letterSpacing:".16em",textTransform:"uppercase"}}>{subtitle}</div><div style={{fontSize:W*.056,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,textTransform:"uppercase"}}>{title}</div><div style={{width:"100%",height:1,background:rgba(accent,.25)}}/><div style={{fontSize:W*.03,color:"rgba(255,255,255,.62)",lineHeight:1.5}}>{body}</div></div>{(date||hashtag)&&<div style={{position:"relative",zIndex:3,background:"rgba(0,0,0,.7)",padding:(W*.022)+"px "+(W*.04)+"px",display:"flex",justifyContent:"space-between",fontSize:W*.022,color:"rgba(255,255,255,.3)"}}><span>{date}</span><span>{hashtag}</span></div>}<Watermark/></div>);
  if(tpl==="pt4")return(<div style={Object.assign({},root,{background:"#f8f9fa"})}><div style={{position:"absolute",left:0,top:0,bottom:0,width:5,background:"linear-gradient(to bottom,"+accent+","+accent2+")",zIndex:3}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.05)+"px "+(W*.03)+"px "+(W*.065)+"px",borderBottom:"1px solid rgba(0,0,0,.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(0,0,0,.3)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.05)+"px "+(W*.05)+"px "+(W*.05)+"px "+(W*.065)+"px"}}><div style={{fontSize:W*.022,color:accent,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:W*.02}}>{subtitle}</div><div style={{fontSize:W*.052,fontWeight:900,color:"#111",fontFamily:"Impact,sans-serif",lineHeight:1.08,letterSpacing:".01em",marginBottom:W*.025}}>{title}</div><div style={{width:W*.06,height:3,background:accent,marginBottom:W*.025,borderRadius:2}}/><div style={{fontSize:W*.028,color:"rgba(0,0,0,.56)",lineHeight:1.55}}>{body}</div>{hashtag&&<div style={{marginTop:W*.04,fontSize:W*.022,color:rgba(accent,.7)}}>{hashtag}</div>}</div><Watermark/></div>);
  if(tpl==="pt5")return(<div style={Object.assign({},root,{background:"#f0f0f2"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.07}} alt=""/>}<div style={{position:"absolute",left:0,top:0,right:0,height:"45%",background:"linear-gradient(135deg,"+accent+","+accent2+")",zIndex:1}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.65)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:(W*.04)+"px"}}><div style={{fontSize:W*.019,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:W*.015}}>{subtitle}</div><div style={{fontSize:W*.052,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,marginBottom:W*.015}}>{title}</div></div><div style={{position:"relative",zIndex:3,background:"#fff",padding:(W*.04)+"px",flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:W*.018}}><div style={{fontSize:W*.028,color:"#333",lineHeight:1.55}}>{body}</div>{hashtag&&<div style={{fontSize:W*.022,color:accent}}>{hashtag}</div>}</div><Watermark/></div>);
  if(tpl==="pt6")return(<div style={Object.assign({},root,{background:"#000"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.3}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.92) 65%)"}}/><div style={{position:"relative",zIndex:3,padding:(W*.035)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.5)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.04)+"px "+(W*.05)+"px"}}><div style={{fontSize:W*.019,color:accent,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",marginBottom:W*.015}}>{subtitle}</div><div style={{fontSize:W*.054,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,marginBottom:W*.018}}>{title}</div><div style={{width:W*.07,height:2,background:accent,marginBottom:W*.018,borderRadius:2}}/><div style={{fontSize:W*.026,color:"rgba(255,255,255,.6)",lineHeight:1.5}}>{body}</div>{hashtag&&<div style={{marginTop:W*.025,fontSize:W*.022,color:rgba(accent,.6)}}>{hashtag}</div>}</div><Watermark/></div>);
  return(<div style={Object.assign({},root,{background:"#030308"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.85),rgba(0,0,0,.5),rgba(0,0,0,.85))"}}/><div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.06)+"px"}}><div style={{width:W*.1,height:3,background:accent,marginBottom:W*.04,borderRadius:2}}/><div style={{fontSize:W*.065,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.05,textTransform:"uppercase",marginBottom:W*.03}}>{title}</div><div style={{fontSize:W*.036,color:accent,fontWeight:600,marginBottom:W*.04}}>{subtitle}</div><div style={{fontSize:W*.028,color:"rgba(255,255,255,.6)",lineHeight:1.55}}>{body}</div>{(date||hashtag)&&<div style={{marginTop:W*.05,fontSize:W*.022,color:"rgba(255,255,255,.3)",letterSpacing:".08em"}}>{date}{date&&hashtag?" · ":""}{hashtag}</div>}</div><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.06)+"px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:W*.025}}><Logo sz={W*.09}/><div style={{fontSize:W*.022,color:"rgba(255,255,255,.35)",letterSpacing:".06em"}}>OFFICIEL</div></div><Watermark/></div>);
}
// ─── RENDU DIFFÉRÉ ────────────────────────────────────────────
// Ne monte ses enfants qu'une fois la zone approchée du viewport. Sans ça, la
// grille d'historique décode le fond, le logo et la photo de chaque visuel dès
// l'ouverture de l'écran — de quoi faire tuer l'onglet sur mobile.
function WhenVisible({children,minHeight,rootMargin}){
  const ref=useRef(null);
  // Sans IntersectionObserver (navigateurs anciens), on affiche tout de suite.
  const[shown,setShown]=useState(()=>typeof IntersectionObserver==="undefined");
  useEffect(()=>{
    if(shown)return;
    const el=ref.current;
    if(!el)return;
    const io=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)){setShown(true);io.disconnect();}
    },{rootMargin:rootMargin||"300px"});
    io.observe(el);
    return()=>io.disconnect();
  },[shown,rootMargin]);
  return <div ref={ref} style={{minHeight:minHeight||120}}>{shown?children:null}</div>;
}
// ─── HISTORY THUMB ────────────────────────────────────────────
function HistoryThumb({h,c1,c2}){
  // La vignette reprend le format du visuel (story, 4:5 ou carré).
  const F=FORMAT_TYPES.includes(h.type)?fmt(h.format):FORMATS.story;
  const W=108, H=Math.round(W*F.h/F.w);
  const wr={width:W,height:H,overflow:"hidden",borderRadius:8,flexShrink:0,position:"relative"};
  const inn={width:F.w,height:F.h,transformOrigin:"top left",transform:"scale("+(W/F.w)+")",position:"absolute",top:0,left:0};
  try{
    if(h.type==="lineup")return<div style={wr}><div style={inn}><LineupCanvas sport={h.sport} ld={h.lineupData} tpl={h.lineupTpl||"ln1"} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    if(h.type==="group")return<div style={wr}><div style={inn}><GroupCanvas gd={h.groupData} tpl={h.groupTpl||"gr1"} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    if(h.type==="post"){
      // Post nouveau format : layers présents → rendu standard. Sinon legacy PostCanvas via postData.
      if(h.layers&&h.layers.length>0){
        const sortedP=[...h.layers].sort((a,b)=>a.z-b.z);
        return(<div style={Object.assign({},wr,{background:"#000"})}><div style={inn}>{sortedP.map(lay=><LayerView key={lay.id} lay={lay} bgUrl={h.bgUrl} playerUrl={h.playerUrl} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} isSel={false} onMD={()=>{}}/>)}</div></div>);
      }
      return<div style={wr}><div style={inn}><PostCanvas pd={h.postData} tpl={h.postTpl||"pt1"} logoUrl={h.logoUrl} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    }
    const sorted=[...(h.layers||[])].sort((a,b)=>a.z-b.z);
    return(<div style={Object.assign({},wr,{background:"#111"})}><div style={inn}>{sorted.map(lay=><LayerView key={lay.id} lay={lay} bgUrl={h.bgUrl} playerUrl={h.playerUrl} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} isSel={false} onMD={()=>{}}/>)}</div></div>);
  }catch{return<div style={Object.assign({},wr,{background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20})}>{h.ct&&h.ct.icon?h.ct.icon:"📄"}</div>;}
}
// ─── DRAG CANVAS ──────────────────────────────────────────────
function DragCanvas({layers,setLayers,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,t,isMobile,mobileSheet,setMobileSheet,canvasScale,clubName,cw,ch,onLogoChange}){
  const CW=cw||270, CH=ch||480;
  // Chaque snapshot est un clone profond des calques, sponsors compris — et
  // ceux-ci portent leur image en data URL. Pile plus courte sur mobile.
  const HIST_MAX=isMobile?8:20;
  const cvRef=useRef(null);const dragRef=useRef(null);const resizeRef=useRef(null);const historyRef=useRef([]);const[sel,setSel]=useState(null);const[historyDepth,setHistoryDepth]=useState(0);const[mobileToast,setMobileToast]=useState(false);const selL=sel?layers.find(l=>l.id===sel):null;
  useEffect(()=>{
    if(!isMobile||!sel||mobileSheet==="layers")return;
    setMobileToast(true);
    const t=setTimeout(()=>setMobileToast(false),2000);
    return()=>clearTimeout(t);
  },[sel,isMobile,mobileSheet]);
  function pushHist(){
    historyRef.current.push(JSON.parse(JSON.stringify(layers)));
    if(historyRef.current.length>HIST_MAX)historyRef.current.shift();
    setHistoryDepth(historyRef.current.length);
  }
  function undo(){
    if(historyRef.current.length===0)return;
    const last=historyRef.current.pop();
    setLayers(last);
    setHistoryDepth(historyRef.current.length);
    setSel(null);
  }
  useEffect(()=>{
    const handler=(e)=>{
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.code==="KeyZ"){
        const tag=e.target&&e.target.tagName?e.target.tagName.toLowerCase():"";
        if(tag==="input"||tag==="textarea"||tag==="select")return;
        if(historyRef.current.length===0)return;
        e.preventDefault();
        const last=historyRef.current.pop();
        setLayers(last);
        setHistoryDepth(historyRef.current.length);
        setSel(null);
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[setLayers]);
  // Helper : extrait clientX/Y indifféremment d'un MouseEvent ou TouchEvent
  function pt(e){
    if(e.touches&&e.touches.length>0)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
    if(e.changedTouches&&e.changedTouches.length>0)return{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
    return{x:e.clientX,y:e.clientY};
  }
  const onMD=useCallback((e,id)=>{const l=layers.find(x=>x.id===id);if(!l||l.locked)return;e.preventDefault();e.stopPropagation();setSel(id);historyRef.current.push(JSON.parse(JSON.stringify(layers)));if(historyRef.current.length>HIST_MAX)historyRef.current.shift();setHistoryDepth(historyRef.current.length);const rect=cvRef.current.getBoundingClientRect();const p=pt(e);dragRef.current={id,ox:l.x,oy:l.y,mx0:(p.x-rect.left)/rect.width*100,my0:(p.y-rect.top)/rect.height*100};},[layers,HIST_MAX]);
  const onResize=useCallback((e,id,corner)=>{
    const l=layers.find(x=>x.id===id);if(!l||l.locked)return;
    setSel(id);
    historyRef.current.push(JSON.parse(JSON.stringify(layers)));
    if(historyRef.current.length>HIST_MAX)historyRef.current.shift();
    setHistoryDepth(historyRef.current.length);
    const rect=cvRef.current.getBoundingClientRect();
    const p=pt(e);
    resizeRef.current={id,corner,ox:l.x,oy:l.y,ow:l.w,oh:l.h,startX:p.x,startY:p.y,canvasW:rect.width,canvasH:rect.height};
  },[layers,HIST_MAX]);
  const onMM=useCallback(e=>{
    if(resizeRef.current&&cvRef.current){
      const r=resizeRef.current;
      const p=pt(e);
      const dxP=(p.x-r.startX)/r.canvasW*100;
      const dyP=(p.y-r.startY)/r.canvasH*100;
      const sx=(r.corner==="tr"||r.corner==="br")?1:-1;
      const sy=(r.corner==="bl"||r.corner==="br")?1:-1;
      const ratioX=(dxP*sx)/r.ow;
      const ratioY=(dyP*sy)/r.oh;
      let scale=1+(Math.abs(ratioX)>Math.abs(ratioY)?ratioX:ratioY);
      const minScale=Math.max(5/r.ow,5/r.oh);
      scale=Math.max(minScale,scale);
      const newW=r.ow*scale, newH=r.oh*scale;
      const newX=(r.corner==="tl"||r.corner==="bl")?r.ox+(r.ow-newW):r.ox;
      const newY=(r.corner==="tl"||r.corner==="tr")?r.oy+(r.oh-newH):r.oy;
      setLayers(prev=>prev.map(l=>l.id===r.id?{...l,x:newX,y:newY,w:newW,h:newH}:l));
      if(e.cancelable)e.preventDefault();
      return;
    }
    if(!dragRef.current||!cvRef.current)return;
    const rect=cvRef.current.getBoundingClientRect();
    const p=pt(e);
    const mx=(p.x-rect.left)/rect.width*100,my=(p.y-rect.top)/rect.height*100;
    setLayers(prev=>prev.map(l=>l.id===dragRef.current.id?{...l,x:Math.max(0,Math.min(90,dragRef.current.ox+(mx-dragRef.current.mx0))),y:Math.max(0,Math.min(95,dragRef.current.oy+(my-dragRef.current.my0)))}:l));
    if(e.cancelable)e.preventDefault();
  },[setLayers]);
  const onMU=useCallback(()=>{dragRef.current=null;resizeRef.current=null;},[]);
  function addColorBlock(){
    pushHist();
    const newId="cb_"+Date.now();
    const maxZ=layers.reduce((m,l)=>Math.max(m,l.z),0);
    const newLayer={id:newId,z:maxZ+1,type:"colorblock",x:30,y:35,w:40,h:30,locked:false,label:"Couleur",color:"#ff5555",opacity:80};
    setLayers(prev=>[...prev,newLayer]);
    setSel(newId);
  }
  function addSponsor(){
    pushHist();
    const newId="sp_"+Date.now();
    const maxZ=layers.reduce((m,l)=>Math.max(m,l.z),0);
    const newLayer={id:newId,z:maxZ+1,type:"sponsor",x:70,y:84,w:25,h:10,locked:false,label:"Sponsor",url:null};
    setLayers(prev=>[...prev,newLayer]);
    setSel(newId);
  }
  function addText(){
    pushHist();
    const newId="tx_"+Date.now();
    const maxZ=layers.reduce((m,l)=>Math.max(m,l.z),0);
    const newLayer={id:newId,z:maxZ+1,type:"text",x:10,y:45,w:80,h:10,locked:false,label:"Texte",text:"Nouveau texte",font:"Impact",fontSize:24,color:"#ffffff",bold:false,italic:false,upper:false,letterSpacing:0,lineHeight:1.2,bgColor:"#000000",bgOpacity:0,textShadow:6,align:"center",curve:0};
    setLayers(prev=>[...prev,newLayer]);
    setSel(newId);
  }
  const[removingBg,setRemovingBg]=useState(false);
  const[bgTol,setBgTol]=useState("normal");
  // Détourage adaptatif : la couleur de fond est détectée sur le pourtour de
  // l'image, puis retirée par propagation depuis les bords. Fonctionne donc
  // sur n'importe quel fond uni, pas seulement le blanc.
  async function removeBgOnSelected(){
    if(!selL)return;
    const isLogoLayer=selL.type==="logo"||selL.type==="logo2";
    const src=isLogoLayer?(selL.type==="logo"?logoUrl:logo2Url):selL.url;
    if(!src)return;
    setRemovingBg(true);
    try{
      const{url,removedRatio}=await removeBackground(src,{tolerance:TOLERANCE_PRESETS[bgTol],trim:true});
      if(removedRatio<0.01){
        alert("Aucun fond uni détecté sur cette image. Essayez une tolérance plus forte, ou partez d'une image au fond uni.");
      }else{
        if(isLogoLayer){ onLogoChange&&onLogoChange(selL.type,url); }
        else{ pushHist(); setLayers(p=>p.map(l=>l.id===sel?{...l,url}:l)); }
      }
    }catch(err){
      console.error("[removeBg] échec:",err);
      alert(err&&err.message?err.message:"Détourage impossible sur cette image.");
    }
    setRemovingBg(false);
  }
  // Échantillonne le fond du logo pour colorer sa pastille / son bandeau :
  // la jointure devient invisible même quand le logo traîne un carré blanc.
  async function pickLogoBgColor(){
    const src=selL&&selL.type==="logo2"?logo2Url:logoUrl;
    if(!src)return;
    try{
      const color=await dominantBorderColor(src);
      pushHist();
      setLayers(p=>p.map(l=>l.id===sel?{...l,bgShape:l.bgShape&&l.bgShape!=="none"?l.bgShape:"square",bgColor:color}:l));
    }catch(err){console.error("[pickLogoBgColor] échec:",err);}
  }
  // Bandeau : une marge unie pleine largeur dans laquelle le logo vient se
  // poser. C'est la réponse aux logos sans forme nette, qu'on ne peut pas
  // détourer proprement — on assume la bande plutôt que le carré blanc.
  async function addBand(where){
    let color=accent;
    if(logoUrl){ try{ color=await dominantBorderColor(logoUrl); }catch(err){ console.warn("[addBand] couleur auto indisponible:",err); } }
    pushHist();
    const bandH=15;
    const top=where==="bottom"?100-bandH:0;
    const maxZ=layers.reduce((m,l)=>Math.max(m,l.z),0);
    const bandId="bn_"+Date.now();
    const band={id:bandId,z:maxZ+1,type:"colorblock",x:0,y:top,w:100,h:bandH,locked:false,label:"Bandeau "+(where==="bottom"?"bas":"haut"),color,opacity:100};
    const logoH=bandH*0.72, logoW=logoH*(CH/CW);
    setLayers(prev=>{
      const withBand=[...prev,band];
      const hasLogo=withBand.some(l=>l.type==="logo");
      if(!hasLogo) return withBand;
      // Le logo se recale au centre du bandeau, juste au-dessus de lui.
      return withBand.map(l=>l.type==="logo"
        ?{...l,z:maxZ+2,x:50-logoW/2,y:top+(bandH-logoH)/2,w:logoW,h:logoH,bgShape:"none"}
        :l);
    });
    setSel(bandId);
  }
  function upd(f,v){pushHist();setLayers(p=>p.map(l=>l.id===sel?Object.assign({},l,{[f]:v}):l));}
  function moveZ(id,d){pushHist();setLayers(prev=>{const s=[...prev].sort((a,b)=>a.z-b.z);const i=s.findIndex(l=>l.id===id),j=i+d;if(j<0||j>=s.length)return prev;const za=s[i].z,zb=s[j].z;return prev.map(l=>l.id===s[i].id?{...l,z:zb}:l.id===s[j].id?{...l,z:za}:l);});}
  function delSel(){if(!selL||selL.locked)return;pushHist();setLayers(p=>p.filter(l=>l.id!==sel));setSel(null);}
  function layerHit(e){const rect=cvRef.current.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*100,my=(e.clientY-rect.top)/rect.height*100;const c=[...layers].filter(l=>!l.locked&&mx>=l.x&&mx<=l.x+l.w&&my>=l.y&&my<=l.y+l.h).sort((a,b)=>b.z-a.z);setSel(c.length?c[0].id:null);}
  const sorted=[...layers].sort((a,b)=>a.z-b.z);
  const inp={background:t.bg4,border:"1px solid "+t.border2,borderRadius:6,padding:"5px 7px",color:t.text,fontSize:11,outline:"none",boxSizing:"border-box",width:"100%"};
  const isText=selL&&["text","watertext","heading","subtext"].includes(selL.type);
  const layersPanelStyle=isMobile?{position:"fixed",bottom:0,left:0,right:0,maxHeight:"75vh",background:t.bg2,borderTop:"1px solid "+t.border,overflowY:"auto",padding:12,flexShrink:0,zIndex:200,transform:mobileSheet==="layers"?"translateY(0)":"translateY(100%)",transition:"transform .25s ease",boxShadow:mobileSheet==="layers"?"0 -8px 24px rgba(0,0,0,.4)":"none",borderTopLeftRadius:16,borderTopRightRadius:16}:{width:230,background:t.bg2,borderLeft:"1px solid "+t.border,overflowY:"auto",padding:12,flexShrink:0};
  const cs=isMobile?(canvasScale||1):1;
  return(<div style={{flex:1,display:"flex",overflow:"hidden",flexDirection:isMobile?"column":"row",position:"relative"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#030306",padding:isMobile?"12px 8px 70px":20,gap:10,overflow:"auto"}}>
      {historyDepth>0&&(
        <button onClick={undo} title="Annuler (Ctrl+Z)" className="viz-touch-btn" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.65)",padding:isMobile?"10px 18px":"6px 14px",borderRadius:7,fontSize:isMobile?12:11,cursor:"pointer",fontFamily:"inherit",letterSpacing:".02em",fontWeight:500,minHeight:isMobile?44:undefined}}>↩ Undo ({historyDepth})</button>
      )}
      {isMobile&&mobileToast&&selL&&(
        <div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.85)",color:"#fff",padding:"10px 18px",borderRadius:6,fontSize:12,fontFamily:"inherit",letterSpacing:".02em",boxShadow:"0 8px 20px rgba(0,0,0,.4)",zIndex:500,pointerEvents:"none",whiteSpace:"nowrap",maxWidth:"90vw",overflow:"hidden",textOverflow:"ellipsis"}}>
          Calque sélectionné — appuyez sur ≡ Calques pour éditer
        </div>
      )}
      <div style={isMobile?{width:CW*cs,height:CH*cs,position:"relative",flexShrink:0}:{display:"contents"}}>
        <div style={isMobile?{position:"absolute",top:0,left:0,width:CW,height:CH,transform:"scale("+cs+")",transformOrigin:"top left"}:{display:"contents"}}>
          <div ref={cvRef} className="visium-canvas" onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU} onTouchMove={onMM} onTouchEnd={onMU} onTouchCancel={onMU} onClick={layerHit} style={{width:CW,height:CH,position:"relative",overflow:"hidden",borderRadius:16,border:"1px solid "+t.border,background:"#111",cursor:"default",userSelect:"none",WebkitUserSelect:"none",touchAction:"none",flexShrink:0}}>
            {sorted.map(lay=>(<LayerView key={lay.id} lay={lay} bgUrl={bgUrl} playerUrl={playerUrl} logoUrl={logoUrl} logo2Url={logo2Url} accent={accent} accent2={accent2} isSel={sel===lay.id} onMD={onMD} onResize={onResize} hideHandles={isMobile} clubName={clubName}/>))}
            <Watermark/>
          </div>
        </div>
      </div>
      {!isMobile&&<div style={{fontSize:11,color:"rgba(255,255,255,.2)"}}>Cliquer · Glisser pour déplacer</div>}
      {isMobile&&selL&&!selL.locked&&["photo","colorblock","sponsor","logo","logo2","text","watertext","heading","subtext"].includes(selL.type)&&(
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"6px 10px"}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,.6)",letterSpacing:".06em",textTransform:"uppercase"}}>{selL.label||"Calque"}</span>
          <button onClick={()=>{pushHist();setLayers(p=>p.map(l=>l.id===sel?{...l,w:Math.max(5,l.w*0.95),h:Math.max(5,l.h*0.95)}:l));}} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text,borderRadius:8,padding:0,fontSize:18,cursor:"pointer",fontWeight:700,lineHeight:1,width:44,height:44,fontFamily:"inherit"}}>−</button>
          <span style={{fontFamily:"'DM Mono',ui-monospace,monospace",fontSize:11,color:"#fff",minWidth:44,textAlign:"center",letterSpacing:".05em"}}>{Math.round(selL.w)}×{Math.round(selL.h)}%</span>
          <button onClick={()=>{pushHist();setLayers(p=>p.map(l=>l.id===sel?{...l,w:Math.min(120,l.w*1.05),h:Math.min(120,l.h*1.05)}:l));}} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text,borderRadius:8,padding:0,fontSize:18,cursor:"pointer",fontWeight:700,lineHeight:1,width:44,height:44,fontFamily:"inherit"}}>+</button>
        </div>
      )}
    </div>
    {isMobile&&mobileSheet==="layers"&&<div onClick={()=>setMobileSheet&&setMobileSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:150}}/>}
    <div data-bottom-sheet="layers" style={layersPanelStyle}>
      {isMobile&&<div {...makeSwipeClose(()=>setMobileSheet&&setMobileSheet(null))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"1px solid "+t.border,touchAction:"none",cursor:"grab",userSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:4,background:"rgba(255,255,255,.2)",borderRadius:3}}/><div style={{fontSize:13,fontWeight:700,color:t.text}}>Calques</div></div><button onClick={()=>setMobileSheet&&setMobileSheet(null)} style={{background:"none",border:"none",color:t.text3,fontSize:18,cursor:"pointer",padding:4}}>✕</button></div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:isMobile?"flex-end":"space-between",marginBottom:8}}>
        {!isMobile&&<div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase"}}>Calques</div>}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          <button onClick={addText} style={{background:rgba(accent,.15),color:accent,border:"1px solid "+rgba(accent,.35),borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Texte</button>
          <button onClick={addColorBlock} style={{background:rgba(accent,.15),color:accent,border:"1px solid "+rgba(accent,.35),borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Couleur</button>
          <button onClick={addSponsor} style={{background:rgba(accent,.15),color:accent,border:"1px solid "+rgba(accent,.35),borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Sponsor</button>
          <button onClick={()=>addBand("top")} title="Marge unie en haut, logo intégré dedans" style={{background:rgba(accent,.15),color:accent,border:"1px solid "+rgba(accent,.35),borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Bandeau ↑</button>
          <button onClick={()=>addBand("bottom")} title="Marge unie en bas, logo intégré dedans" style={{background:rgba(accent,.15),color:accent,border:"1px solid "+rgba(accent,.35),borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Bandeau ↓</button>
        </div>
      </div>
      <div style={{marginBottom:12}}>{[...sorted].reverse().map(lay=>(<div key={lay.id} onClick={()=>setSel(lay.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 7px",borderRadius:6,marginBottom:2,background:sel===lay.id?rgba(accent,.14):t.bg3,border:"1px solid "+(sel===lay.id?rgba(accent,.45):t.border),cursor:"pointer"}}><span style={{fontSize:10,color:t.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lay.label||lay.type}</span>{!lay.locked&&<><button onClick={e=>{e.stopPropagation();moveZ(lay.id,1);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:11,padding:0}}>↑</button><button onClick={e=>{e.stopPropagation();moveZ(lay.id,-1);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:11,padding:0}}>↓</button></>}</div>))}</div>
      {selL&&!selL.locked&&(<div>
        <div style={{fontSize:10,color:accent,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>✏️ {selL.label}</div>
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Texte affiché</div><textarea value={selL.text||""} onChange={e=>upd("text",e.target.value)} rows={2} style={Object.assign({},inp,{resize:"none",fontFamily:"inherit"})}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Police</div><select value={selL.font||"Impact"} onChange={e=>upd("font",e.target.value)} style={inp}>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select></div>}
        {isText&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Taille</div><input type="number" value={selL.fontSize||20} onChange={e=>upd("fontSize",+e.target.value||12)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div><input type="color" value={(selL.color||"#ffffff").startsWith("rgba")?"#ffffff":selL.color||"#ffffff"} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:32,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div></div>}
        {isText&&<div style={{display:"flex",gap:4,marginBottom:8}}>{[["bold","G","Gras"],["italic","I","Italic"],["upper","AA","Majusc."]].map(([f,sym,lbl])=>(<button key={f} onClick={()=>upd(f,!selL[f])} style={{flex:1,background:selL[f]?accent:"transparent",border:"1px solid "+(selL[f]?accent:t.border2),borderRadius:6,padding:"5px 2px",color:selL[f]?"#fff":t.text2,cursor:"pointer",fontSize:9,fontWeight:600,textAlign:"center"}}><div style={{fontSize:11,fontWeight:700}}>{sym}</div><div style={{fontSize:8,opacity:.7}}>{lbl}</div></button>))}</div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:3}}>Alignement</div><div style={{display:"flex",gap:4}}>{["left","center","right"].map(al=>(<button key={al} onClick={()=>upd("align",al)} style={{flex:1,background:(selL.align||"center")===al?accent:"transparent",border:"1px solid "+((selL.align||"center")===al?accent:t.border2),borderRadius:6,padding:"5px 2px",color:(selL.align||"center")===al?"#fff":t.text2,cursor:"pointer",fontSize:12}}>{al==="left"?"←":al==="center"?"≡":"→"}</button>))}</div></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Espacement lettres ({(selL.letterSpacing||0).toFixed(1)}px)</div><TouchSlider value={selL.letterSpacing||0} onChange={v=>upd("letterSpacing",v)} min={-2} max={20} step={0.5} t={t} isMobile={isMobile}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Interligne ({(selL.lineHeight||1.2).toFixed(1)})</div><TouchSlider value={selL.lineHeight||1.2} onChange={v=>upd("lineHeight",v)} min={0.8} max={3} step={0.1} t={t} isMobile={isMobile}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Ombre ({selL.textShadow||0}px)</div><TouchSlider value={selL.textShadow||0} onChange={v=>upd("textShadow",v)} min={0} max={40} step={1} t={t} isMobile={isMobile}/></div>}
        {isText&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Fond texte</div><input type="color" value={selL.bgColor||"#000000"} onChange={e=>upd("bgColor",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Opacité fond ({Math.round((selL.bgOpacity||0)*100)}%)</div><TouchSlider value={selL.bgOpacity||0} onChange={v=>upd("bgOpacity",v)} min={0} max={1} step={0.05} t={t} isMobile={isMobile}/></div></div>}
        {isText&&<div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:9,color:t.text3}}>Texte en arc</span>
            <span style={{fontSize:11,color:t.accent,fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{(selL.curve||0)+"°"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?8:5}}>
            <button onClick={()=>upd("curve",Math.max(-180,(selL.curve||0)-1))} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text2,borderRadius:isMobile?7:5,padding:0,fontSize:isMobile?18:13,cursor:"pointer",fontWeight:700,lineHeight:1,width:isMobile?44:24,height:isMobile?44:undefined,flexShrink:0,fontFamily:"inherit"}}>−</button>
            <input type="range" min={-180} max={180} step={1} value={selL.curve||0} onChange={e=>upd("curve",+e.target.value)} style={{flex:1,minWidth:0,height:isMobile?28:undefined}}/>
            <button onClick={()=>upd("curve",Math.min(180,(selL.curve||0)+1))} className="viz-touch-btn" style={{background:t.bg4,border:"1px solid "+t.border2,color:t.text2,borderRadius:isMobile?7:5,padding:0,fontSize:isMobile?18:13,cursor:"pointer",fontWeight:700,lineHeight:1,width:isMobile?44:24,height:isMobile?44:undefined,flexShrink:0,fontFamily:"inherit"}}>+</button>
          </div>
          {(selL.curve||0)!==0&&<button onClick={()=>upd("curve",0)} style={{background:"none",border:"none",color:t.accent,cursor:"pointer",fontSize:9,padding:0,textDecoration:"underline",marginTop:3}}>Reset</button>}
        </div>}
        {selL.type==="watertext"&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Opacité filigrane ({selL.opacity||15}%)</div><TouchSlider value={selL.opacity||15} onChange={v=>upd("opacity",v)} min={1} max={60} step={1} t={t} isMobile={isMobile}/></div>}
        {selL.type==="overlay"&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Intensité ({selL.opacity||60}%)</div><TouchSlider value={selL.opacity||60} onChange={v=>upd("opacity",v)} min={0} max={100} step={1} t={t} isMobile={isMobile}/></div>}
        {selL.type==="stripe"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur 1</div><input type="color" value={selL.color||accent} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur 2</div><input type="color" value={selL.color2||accent2} onChange={e=>upd("color2",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div></div>}
        {selL.type==="colorblock"&&<>
          <div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div><input type="color" value={selL.color||"#ff5555"} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:32,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div>
          <div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Opacité ({selL.opacity==null?80:selL.opacity}%)</div><TouchSlider value={selL.opacity==null?80:selL.opacity} onChange={v=>upd("opacity",v)} min={0} max={100} step={1} t={t} isMobile={isMobile}/></div>
        </>}
        {selL.type==="sponsor"&&<>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:t.text3,marginBottom:4}}>Logo sponsor</div>
            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <UpBtn val={selL.url} on={url=>{pushHist();upd("url",url);}} w={64} h={48} r={6} label="Upload" t={t}/>
              {selL.url&&<button onClick={()=>{pushHist();upd("url",null);}} style={{fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer",padding:"4px 0",alignSelf:"center"}}>✕ Retirer</button>}
            </div>
          </div>
          {selL.url&&<CutoutBox tol={bgTol} setTol={setBgTol} onRun={removeBgOnSelected} busy={removingBg} t={t} accent={accent}/>}
        </>}
        {(selL.type==="logo"||selL.type==="logo2")&&<>
          <div style={{fontSize:9,color:t.text3,marginBottom:4}}>Fond derrière le logo</div>
          <div style={{display:"flex",gap:4,marginBottom:8}}>
            {[["none","Aucun"],["square","Carré"],["circle","Cercle"]].map(([v,lbl])=>{
              const on=(selL.bgShape||"none")===v;
              return <button key={v} onClick={()=>upd("bgShape",v)} style={{flex:1,background:on?accent:"transparent",border:"1px solid "+(on?accent:t.border2),borderRadius:6,padding:"5px 2px",color:on?contrastText(accent):t.text2,cursor:"pointer",fontSize:9,fontWeight:600}}>{lbl}</button>;
            })}
          </div>
          {(selL.bgShape&&selL.bgShape!=="none")&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
              <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div><input type="color" value={selL.bgColor||"#ffffff"} onChange={e=>upd("bgColor",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div>
              <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Marge ({selL.pad==null?12:selL.pad}%)</div><TouchSlider value={selL.pad==null?12:selL.pad} onChange={v=>upd("pad",v)} min={0} max={35} step={1} t={t} isMobile={isMobile}/></div>
            </div>
            {(selL.bgShape==="square")&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Arrondi ({selL.radius==null?12:selL.radius}%)</div><TouchSlider value={selL.radius==null?12:selL.radius} onChange={v=>upd("radius",v)} min={0} max={50} step={1} t={t} isMobile={isMobile}/></div>}
          </>}
          <button onClick={pickLogoBgColor} style={{width:"100%",background:t.bg4,color:t.text2,border:"1px solid "+t.border2,borderRadius:7,padding:"7px",fontSize:10,cursor:"pointer",marginBottom:8,fontFamily:"inherit"}}>
            🎯 Reprendre la couleur de fond du logo
          </button>
          <CutoutBox tol={bgTol} setTol={setBgTol} onRun={removeBgOnSelected} busy={removingBg} t={t} accent={accent}
            hint="Logos sans forme nette : préférez un bandeau ou une pastille."/>
        </>}
        {(selL.type==="scoreblock"||selL.type==="scorebig")&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Score domicile</div><input value={selL.scoreHome||"0"} onChange={e=>upd("scoreHome",e.target.value)} style={inp}/></div>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Score adversaire</div><input value={selL.scoreAway||"0"} onChange={e=>upd("scoreAway",e.target.value)} style={inp}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Nom domicile</div><input value={selL.homeLabel!=null?selL.homeLabel:(clubName||"")} onChange={e=>upd("homeLabel",e.target.value)} placeholder={clubName||"Mon club"} style={inp}/></div>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Nom adversaire</div><input value={selL.awayLabel!=null?selL.awayLabel:"Adversaire"} onChange={e=>upd("awayLabel",e.target.value)} placeholder="Adversaire" style={inp}/></div>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:t.text3,marginBottom:8,cursor:"pointer"}}>
            <input type="checkbox" checked={selL.showNames!==false} onChange={e=>upd("showNames",e.target.checked)}/>
            Afficher les noms d'équipe
          </label>
        </>}
        {selL.type==="resultlabel"&&<>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:9,color:t.text3,marginBottom:2}}>Texte (laisser vide = calcul auto VICTOIRE/NUL/DÉFAITE)</div>
            <input value={selL.text||""} onChange={e=>upd("text",e.target.value)} placeholder="(auto)" style={inp}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div><input type="color" value={selL.color||"#22c55e"} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div>
            <div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Taille</div><input type="number" value={selL.fontSize||11} onChange={e=>upd("fontSize",+e.target.value||11)} style={inp}/></div>
          </div>
          {selL.color&&<button onClick={()=>upd("color",null)} style={{background:"none",border:"none",color:t.accent,cursor:"pointer",fontSize:9,padding:0,textDecoration:"underline",marginBottom:8}}>Reset couleur auto</button>}
        </>}
        <div style={{background:t.bg3,borderRadius:8,padding:9,marginBottom:8}}><div style={{fontSize:9,color:t.text3,fontWeight:700,marginBottom:6}}>POSITION & TAILLE</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>X %</div><input type="number" value={Math.round(selL.x||0)} onChange={e=>upd("x",+e.target.value)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Y %</div><input type="number" value={Math.round(selL.y||0)} onChange={e=>upd("y",+e.target.value)} style={inp}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Larg %</div><input type="number" value={Math.round(selL.w||20)} onChange={e=>upd("w",+e.target.value)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Haut %</div><input type="number" value={Math.round(selL.h||10)} onChange={e=>upd("h",+e.target.value)} style={inp}/></div></div></div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Nom du calque</div><input value={selL.label||""} onChange={e=>upd("label",e.target.value)} style={inp}/></div>
        <button onClick={delSel} style={{width:"100%",background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.28)",borderRadius:7,padding:"7px",fontSize:11,cursor:"pointer"}}>🗑 Supprimer</button>
      </div>)}
      {!selL&&<div style={{fontSize:11,color:t.text3,textAlign:"center",lineHeight:1.6,marginTop:6}}>Cliquez un calque pour le modifier</div>}
    </div>
  </div>);
}
// ─── SMALL UI ATOMS ───────────────────────────────────────────
const TOLERANCE_CHOICES=[["low","Douce"],["normal","Normale"],["high","Forte"]];
function ToleranceRow({tol,setTol,t,accent,label}){
  return(<>
    <div style={{fontSize:9,color:t.text3,marginBottom:4}}>{label||"Détourage · intensité"}</div>
    <div style={{display:"flex",gap:4}}>
      {TOLERANCE_CHOICES.map(([v,lbl])=>{
        const on=tol===v;
        return <button key={v} onClick={()=>setTol(v)} style={{flex:1,background:on?accent:"transparent",border:"1px solid "+(on?accent:t.border2),borderRadius:6,padding:"5px 2px",color:on?contrastText(accent):t.text2,cursor:"pointer",fontSize:9,fontWeight:600}}>{lbl}</button>;
      })}
    </div>
  </>);
}
function CutoutBox({tol,setTol,onRun,busy,t,accent,hint}){
  return(<div style={{marginBottom:8}}>
    <ToleranceRow tol={tol} setTol={setTol} t={t} accent={accent}/>
    <button onClick={onRun} disabled={busy} style={{width:"100%",marginTop:6,background:rgba(accent,.12),color:accent,border:"1px solid "+rgba(accent,.3),borderRadius:7,padding:"7px",fontSize:11,fontWeight:600,cursor:busy?"wait":"pointer",fontFamily:"inherit"}}>
      {busy?"Traitement…":"✂ Détourer le fond"}
    </button>
    <div style={{fontSize:9,color:t.text3,marginTop:4,lineHeight:1.4}}>{hint||"Retire le fond uni quelle que soit sa couleur (pas seulement le blanc)."}</div>
  </div>);
}
function TIn({v,on,ph,type,t,st,min}){return<input value={v} type={type||"text"} placeholder={ph||""} min={min} onChange={e=>on(e.target.value)} style={Object.assign({},{background:t.bg3,border:"1px solid "+t.border2,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"},st||{})}/>;}
function TSel({v,on,opts,t}){return<select value={v} onChange={e=>on(e.target.value)} style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}>{opts.map(o=>typeof o==="string"?<option key={o} value={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select>;}
function UpBtn({val,on,w,h,r,label,t,preset}){
  w=w||52;h=h||44;r=r||8;
  const ref=useRef();
  const[busy,setBusy]=useState(false);
  const pick=async e=>{
    const f=e.target.files[0];
    e.target.value="";
    if(!f)return;
    setBusy(true);
    const url=await intakeImage(f,preset||"logo");
    setBusy(false);
    if(url)on(url);
  };
  return(<div onClick={()=>!busy&&ref.current.click()} style={{width:w,height:h,borderRadius:r,border:"2px dashed "+(val?t.accent:t.border2),background:t.bg3,cursor:busy?"wait":"pointer",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,gap:2,position:"relative"}}>
    {val?<img src={val} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<><span style={{color:t.text3,fontSize:20,lineHeight:1}}>+</span>{label&&<span style={{fontSize:9,color:t.text3,textAlign:"center",padding:"0 3px",lineHeight:1.2}}>{label}</span>}</>}
    {busy&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",letterSpacing:".04em"}}>…</div>}
    <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={pick}/>
  </div>);
}
function Av({photo,name,size}){size=size||40;const[err,setErr]=useState(false);const ini=(name||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();return(<div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#e63329,#1a1a2e)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:"#fff"}}>{photo&&!err?<img src={photo} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="" onError={()=>setErr(true)}/>:ini}</div>);}
// Bandeau de bascule d'équipe. Ne s'affiche qu'à partir de deux équipes :
// un club mono-équipe ne voit aucune différence avec l'existant.
function TeamBar({teams,teamId,onPick,t,label}){
  if(!teams||teams.length<2)return null;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16,padding:"9px 12px",background:t.bg3,borderRadius:9,border:"1px solid "+t.border}}>
      <span style={{fontSize:9,color:t.text3,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",flexShrink:0}}>{label||"Équipe"}</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",minWidth:0}}>
        {teams.map(tm=>{
          const on=tm.id===teamId;
          return(
            <button key={tm.id} onClick={()=>{if(!on)onPick(tm.id);}}
              style={{background:on?t.accent:t.bg4,color:on?contrastText(t.accent):t.text2,border:"1px solid "+(on?t.accent:t.border2),borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:on?700:500,cursor:on?"default":"pointer",fontFamily:"inherit",whiteSpace:"nowrap",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>
              {tm.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function PBox({children,t,mb}){return<div style={{background:t.bg3,borderRadius:10,padding:12,marginBottom:mb||10}}>{children}</div>;}
function SHdr({label,t}){return<div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+t.border}}>{label}</div>;}
function TplGrid({tpls,sel,onSel,t,maxTemplates}){
  const cats=[...new Set(tpls.map(x=>x.cat))];
  // Le quota porte sur le nombre total de gabarits accessibles, pas sur un
  // décompte remis à zéro à chaque catégorie : les gabarits sont donc
  // débloqués dans l'ordre d'affichage, toutes catégories confondues.
  const rank=Object.fromEntries(tpls.map((x,i)=>[x.id,i]));
  const limit=maxTemplates||999;
  return(<div>{cats.map(cat=>(
    <div key={cat} style={{marginBottom:8}}>
      <div style={{fontSize:9,color:t.text3,fontWeight:700,letterSpacing:".12em",marginBottom:5,textTransform:"uppercase"}}>{cat}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        {tpls.filter(x=>x.cat===cat).map(tpl=>{
          const locked=rank[tpl.id]>=limit;
          return(
            <div key={tpl.id} onClick={()=>!locked&&onSel(tpl.id)}
              style={{
                background:sel===tpl.id?rgba(t.accent,.18):t.bg3,
                border:"2px solid "+(sel===tpl.id?t.accent:t.border),
                borderRadius:8,padding:"12px 9px",
                cursor:locked?"not-allowed":"pointer",
                opacity:locked?0.4:1,
                position:"relative"
              }}>
              {locked&&<span style={{position:"absolute",top:4,right:6,fontSize:10}}>🔒</span>}
              <div style={{fontSize:11,fontWeight:sel===tpl.id?700:500,color:sel===tpl.id?t.accent:t.text}}>{tpl.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  ))}</div>);
}
function PhotoPanel({players,selId,onSel,selUrl,onSelUrl,onAdd,onAddUrl,onFav,onDelete,t,terms}){
  const T=terms||termsFor(DEFAULT_SPORT);
  const ref=useRef();
  const[removing,setRemoving]=useState(null);
  const[busy,setBusy]=useState(false);
  const[tol,setTol]=useState("normal");
  const player=players.find(p=>p.id===selId);
  const photos=player?sortPhotos(player.photos):[];
  // Les photos importées deux fois portent le même nom de fichier : on le
  // signale pour que le doublon soit identifiable avant suppression.
  const dupNames=new Set();
  {
    const seen=new Set();
    photos.forEach(ph=>{const n=(ph.name||"").toLowerCase();if(!n)return;if(seen.has(n))dupNames.add(n);else seen.add(n);});
  }
  async function pick(e){
    const files=[...e.target.files];
    e.target.value="";
    if(!files.length)return;
    setBusy(true);
    for(const f of files){ await onAdd(selId,f); }
    setBusy(false);
  }
  async function handleRemoveBg(ph){
    setRemoving(ph.id);
    try{
      const{url,removedRatio}=await removeBackground(ph.url,{tolerance:TOLERANCE_PRESETS[tol]});
      if(removedRatio<0.01){
        alert("Aucun fond uni détecté sur cette photo. Essayez l'intensité « Forte », ou partez d'une photo sur fond uni.");
      }else{
        await(onAddUrl&&onAddUrl(selId,url,(ph.name||"photo")+"_detoure"));
      }
    }catch(err){
      console.error("[removeBg] échec:",err);
      alert(err&&err.message?err.message:"Détourage impossible sur cette photo.");
    }
    setRemoving(null);
  }
  return(<div>
    <div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>{T.player}</div>
    <TSel v={selId?String(selId):""} on={v=>onSel(v?v:null)} t={t} opts={[{v:"",l:"Sélectionner un "+T.playerLower+"..."},...players.map(p=>({v:p.id,l:p.name+" · #"+p.number}))]}/>
    {player&&(<div style={{marginTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><span style={{fontSize:11,color:t.text2}}>{busy?"Import en cours…":photos.length+" photo"+(photos.length!==1?"s":"")}</span><button onClick={()=>ref.current.click()} disabled={busy} style={{fontSize:11,color:t.accent,background:rgba(t.accent,.12),border:"1px solid "+rgba(t.accent,.3),borderRadius:6,padding:"4px 10px",cursor:busy?"wait":"pointer",fontWeight:600}}>+ Photo</button></div>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pick}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
        {photos.map(ph=>{
          const isDup=dupNames.has((ph.name||"").toLowerCase());
          return(<div key={ph.id} style={{position:"relative"}}>
          <div onClick={()=>onSelUrl(ph.url)} style={{borderRadius:7,overflow:"hidden",border:"2px solid "+(selUrl===ph.url?t.accent:isDup?"rgba(245,158,11,.6)":t.border),cursor:"pointer",aspectRatio:"3/4"}}>
            <img src={thumbOf(ph)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>
          </div>
          {(ph.is_fav||ph.fav)&&<div style={{position:"absolute",top:3,left:3,background:t.accent,borderRadius:3,fontSize:8,color:contrastText(t.accent),padding:"1px 4px",fontWeight:700}}>FAV</div>}
          {isDup&&!(ph.is_fav||ph.fav)&&<div title="Même nom de fichier qu'une autre photo" style={{position:"absolute",top:3,left:3,background:"rgba(245,158,11,.9)",borderRadius:3,fontSize:8,color:"#1a1a1a",padding:"1px 4px",fontWeight:700}}>2×</div>}
          <div onClick={e=>{e.stopPropagation();onFav(selId,ph.id);}} style={{position:"absolute",top:3,right:3,fontSize:13,background:"rgba(0,0,0,.5)",borderRadius:3,padding:"1px 2px",cursor:"pointer"}}>{(ph.is_fav||ph.fav)?"★":"☆"}</div>
          <div style={{position:"absolute",bottom:3,left:0,right:0,display:"flex",justifyContent:"center",gap:3,padding:"0 3px"}}>
            <button onClick={e=>{e.stopPropagation();handleRemoveBg(ph);}} disabled={removing===ph.id} className="viz-touch-btn"
              style={{background:rgba(t.accent,.85),border:"none",borderRadius:4,fontSize:10,color:contrastText(t.accent),cursor:removing===ph.id?"wait":"pointer",padding:"4px 7px",whiteSpace:"nowrap",fontWeight:600,fontFamily:"inherit"}}>
              {removing===ph.id?"…":"✂"}
            </button>
            <button onClick={e=>{e.stopPropagation();if(window.confirm("Supprimer cette photo de "+(player.name||"ce "+T.playerLower)+" ?"))onDelete&&onDelete(selId,ph.id,ph.url);}} className="viz-touch-btn"
              title="Supprimer cette photo"
              style={{background:"rgba(0,0,0,.7)",border:"1px solid rgba(239,68,68,.5)",borderRadius:4,fontSize:10,color:"#fca5a5",cursor:"pointer",padding:"4px 7px",whiteSpace:"nowrap",fontWeight:600,fontFamily:"inherit"}}>
              🗑
            </button>
          </div>
        </div>);})}
      </div>
      {photos.length>0&&<div style={{marginTop:8}}>
        <ToleranceRow tol={tol} setTol={setTol} t={t} accent={t.accent} label="Détourage · intensité (bouton ✂)"/>
        <div style={{fontSize:9,color:t.text3,marginTop:4,lineHeight:1.4}}>Le détourage crée une nouvelle photo, l'originale est conservée.</div>
      </div>}
    </div>)}
  </div>);
}
function LineupEditor({ld,setLd,players,t,sport}){
  const F=formationsFor(sport);
  // La formation enregistrée peut venir d'un autre sport : on retombe sur la
  // première du sport courant plutôt que d'afficher une option inexistante.
  const fm=(ld.formation&&F[ld.formation])?ld.formation:(Object.keys(F)[0]||"4-4-2");
  const starters=ld.starters||[];const subs=ld.subs||[];
  const fRows=F[fm]||[{n:1},{n:4},{n:4},{n:2}];
  let gi=0;const rowDefs=fRows.map(r=>{const from=gi;gi+=r.n;return{label:r.l||"",from,count:r.n};});
  function setStarter(i,pid){const ns=[...starters];ns[i]=pid?players.find(p=>p.id===pid)||null:null;setLd(d=>Object.assign({},d,{starters:ns}));}
  function setSub(i,pid){const ns=[...subs];ns[i]=pid?players.find(p=>p.id===pid)||null:null;setLd(d=>Object.assign({},d,{subs:ns}));}
  function autoFill(){
    const used=new Set();
    const lineup=[];
    fRows.forEach(r=>{
      // Chaque rang puise dans les postes qu'il déclare, sans reprendre un
      // joueur déjà placé sur un rang précédent.
      const pool=players.filter(x=>(r.p||[r.l]).includes(x.position)&&!used.has(x.id));
      for(let i=0;i<r.n;i++){
        const pick=pool[i]||null;
        if(pick)used.add(pick.id);
        lineup.push(pick);
      }
    });
    setLd(d=>Object.assign({},d,{starters:lineup,subs:players.filter(p=>!used.has(p.id)).slice(0,7)}));
  }
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>{termsFor(sport).formationLabel}</div><TSel v={fm} on={v=>setLd(d=>Object.assign({},d,{formation:v,starters:[]}))} t={t} opts={Object.keys(F)}/></div><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>{termsFor(sport).opponent}</div><TIn v={ld.opponent||""} on={v=>setLd(d=>Object.assign({},d,{opponent:v}))} ph="vs..." t={t}/></div></div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TIn v={ld.competition||""} on={v=>setLd(d=>Object.assign({},d,{competition:v}))} ph="Ligue 1..." t={t}/></div>
    <button onClick={autoFill} style={{width:"100%",background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:7,padding:"7px",fontSize:11,cursor:"pointer",marginBottom:10,fontWeight:600}}>⚡ Remplissage auto</button>
    {rowDefs.map((row,ri)=>(<div key={ri} style={{marginBottom:7}}><div style={{fontSize:9,color:t.accent,letterSpacing:".1em",fontWeight:700,marginBottom:3,textTransform:"uppercase"}}>{row.label}</div>{Array.from({length:row.count}).map((_,pi)=>{const idx=row.from+pi;const cur=starters[idx];const ph=getPhoto(cur);return(<div key={pi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:24,height:24,borderRadius:5,overflow:"hidden",background:t.bg4,flexShrink:0,border:"1px solid "+(cur?t.accent:t.border)}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:9,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{idx+1}</span>}</div><TSel v={cur?cur.id:""} on={v=>setStarter(idx,v)} t={t} opts={[{v:"",l:"— Poste libre —"},...players.map(p=>({v:p.id,l:"#"+p.number+" "+p.name}))]}/></div>);})}</div>))}
    <div style={{fontSize:9,color:t.accent,letterSpacing:".1em",fontWeight:700,marginBottom:5,marginTop:8,textTransform:"uppercase"}}>Remplaçants</div>
    {Array.from({length:7}).map((_,i)=>{const cur=subs[i];const ph=getPhoto(cur);return(<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:24,height:24,borderRadius:5,overflow:"hidden",background:t.bg4,flexShrink:0,border:"1px solid "+(cur?t.accent:t.border)}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:9,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{i+12}</span>}</div><TSel v={cur?cur.id:""} on={v=>setSub(i,v)} t={t} opts={[{v:"",l:"— Remplaçant —"},...players.map(p=>({v:p.id,l:"#"+p.number+" "+p.name}))]}/></div>);})}
  </div>);
}
function GroupEditor({gd,setGd,players,t,sport}){
  // FIX Lucas : ne PAS faire `gd.title||"GROUPE A"` sur l'input.
  // Sinon dès que l'utilisateur efface le champ, la valeur retourne à "GROUPE A" et
  // il ne peut plus rien saisir. On garde le fallback uniquement pour le RENDU du visuel
  // (voir GroupCanvas). Ici on utilise le placeholder pour montrer la valeur par défaut.
  const title=gd.title??"";const competition=gd.competition??"";
  // Les clés (gk/def/mid/fwd/coaches) restent identiques d'un sport à l'autre :
  // seuls les libellés et les postes regroupés changent, pour que les visuels
  // déjà enregistrés continuent de s'afficher.
  const cats=getSport(sport).groupCats;
  const[impSel,setImpSel]=useState({});
  function add(k){setGd(d=>Object.assign({},d,{[k]:[...(d[k]||[]),{id:Date.now(),name:"",number:"",photo:null,captain:false}]}));}
  function rem(k,id){setGd(d=>Object.assign({},d,{[k]:(d[k]||[]).filter(p=>p.id!==id)}));}
  function upd(k,id,f,v){setGd(d=>Object.assign({},d,{[k]:(d[k]||[]).map(p=>p.id===id?Object.assign({},p,{[f]:v}):p)}));}
  function importOne(k){const pid=impSel[k];if(!pid)return;const p=players.find(x=>x.id===pid);if(!p||(gd[k]||[]).some(x=>x.id===p.id))return;setGd(d=>Object.assign({},d,{[k]:[...(d[k]||[]),{id:p.id,name:p.name,number:p.number,photo:getPhoto(p),captain:false}]}));setImpSel(s=>Object.assign({},s,{[k]:""}));}
  const inp={background:t.bg2,border:"1px solid "+t.border,borderRadius:4,padding:"2px 5px",color:t.text,fontSize:11,outline:"none"};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Titre</div><TIn v={title} on={v=>setGd(d=>Object.assign({},d,{title:v}))} ph="GROUPE A" t={t}/></div><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TIn v={competition} on={v=>setGd(d=>Object.assign({},d,{competition:v}))} ph="Ligue 1..." t={t}/></div></div>
    <div style={{background:t.bg3,borderRadius:8,padding:9,marginBottom:10}}>
      <div style={{fontSize:9,color:t.text3,fontWeight:700,letterSpacing:".1em",marginBottom:6,textTransform:"uppercase"}}>Style du titre</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div>
          <div style={{fontSize:9,color:t.text3,marginBottom:2}}>Police</div>
          <select value={gd.titleFont||"Impact"} onChange={e=>setGd(d=>Object.assign({},d,{titleFont:e.target.value}))} style={{background:t.bg4,border:"1px solid "+t.border2,borderRadius:6,padding:"5px 7px",color:t.text,fontSize:11,outline:"none",width:"100%",boxSizing:"border-box"}}>
            {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:9,color:t.text3,marginBottom:2}}>Taille (px, auto si vide)</div>
          <input type="number" value={gd.titleSize||""} placeholder="auto" min={8} max={120} onChange={e=>setGd(d=>Object.assign({},d,{titleSize:e.target.value?+e.target.value:null}))} style={{background:t.bg4,border:"1px solid "+t.border2,borderRadius:6,padding:"5px 7px",color:t.text,fontSize:11,outline:"none",width:"100%",boxSizing:"border-box"}}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div>
          <input type="color" value={gd.titleColor||"#ffffff"} onChange={e=>setGd(d=>Object.assign({},d,{titleColor:e.target.value}))} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/>
        </div>
        {(gd.titleColor||gd.titleSize||gd.titleFont)&&<button onClick={()=>setGd(d=>{const n=Object.assign({},d);delete n.titleFont;delete n.titleSize;delete n.titleColor;return n;})} style={{background:"none",border:"none",color:t.accent,cursor:"pointer",fontSize:9,padding:"4px 0",textDecoration:"underline",whiteSpace:"nowrap",alignSelf:"flex-end"}}>Reset défauts</button>}
      </div>
    </div>
    {cats.map(cat=>{const list=gd[cat.k]||[];const avail=players.filter(p=>(cat.pos?cat.pos.includes(p.position):true)&&!list.some(x=>x.id===p.id));return(<div key={cat.k} style={{marginBottom:7,background:t.bg3,borderRadius:8,padding:"9px 10px"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,color:t.text,fontWeight:600}}>{cat.l} <span style={{color:t.text3,fontWeight:400}}>({list.length})</span></span><button onClick={()=>add(cat.k)} style={{fontSize:10,color:t.accent,background:rgba(t.accent,.12),border:"1px solid "+rgba(t.accent,.3),borderRadius:5,padding:"3px 7px",cursor:"pointer"}}>+ Manuel</button></div>{avail.length>0&&(<div style={{display:"flex",gap:5,marginBottom:7}}><select value={impSel[cat.k]||""} onChange={e=>setImpSel(s=>Object.assign({},s,{[cat.k]:e.target.value}))} style={{flex:1,background:t.bg4,border:"1px solid "+t.border,borderRadius:5,padding:"5px 7px",color:t.text,fontSize:11,outline:"none"}}><option value="">— Ajouter depuis l'effectif —</option>{avail.map(p=><option key={p.id} value={p.id}>{"#"+p.number+" "+p.name}</option>)}</select><button onClick={()=>importOne(cat.k)} style={{background:impSel[cat.k]?t.accent:"#2a2a2a",color:"#fff",border:"none",borderRadius:5,padding:"5px 11px",fontSize:12,cursor:"pointer",fontWeight:600}}>↓</button></div>)}{list.length===0&&<div style={{fontSize:10,color:t.text3,textAlign:"center",padding:"3px 0",fontStyle:"italic"}}>Aucun joueur</div>}{list.map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,background:t.bg4,borderRadius:6,padding:"4px 6px"}}><div style={{width:24,height:24,borderRadius:4,overflow:"hidden",background:t.bg2,flexShrink:0,cursor:"pointer",border:"1px solid "+(p.photo?t.accent:t.border)}} onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=e=>{const f=e.target.files[0];if(!validateImageFile(f))return;const r=new FileReader();r.onload=ev=>upd(cat.k,p.id,"photo",ev.target.result);r.readAsDataURL(f);};i.click();}}>{p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:12,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>+</span>}</div><input value={p.number||""} onChange={e=>upd(cat.k,p.id,"number",e.target.value)} placeholder="#" style={Object.assign({},inp,{width:25})}/><input value={p.name||""} onChange={e=>upd(cat.k,p.id,"name",e.target.value)} placeholder="Nom" style={Object.assign({},inp,{flex:1})}/><span onClick={()=>upd(cat.k,p.id,"captain",!p.captain)} style={{cursor:"pointer",fontSize:14,opacity:p.captain?1:.2,color:t.accent}}>©</span><button onClick={()=>rem(cat.k,p.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:12,padding:0}}>✕</button></div>))}</div>);})}
  </div>);
}
function PostEditor({pd,setPd,t}){
  return(<div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Titre (grand)</div><TIn v={pd.title||""} on={v=>setPd(d=>Object.assign({},d,{title:v}))} ph="Titre de l'annonce" t={t}/></div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Sous-titre</div><TIn v={pd.subtitle||""} on={v=>setPd(d=>Object.assign({},d,{subtitle:v}))} ph="Catégorie / sous-titre" t={t}/></div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Corps du texte</div><textarea value={pd.body||""} onChange={e=>setPd(d=>Object.assign({},d,{body:e.target.value}))} placeholder="Message principal..." rows={3} style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Date</div><TIn v={pd.date||""} on={v=>setPd(d=>Object.assign({},d,{date:v}))} ph="12 avril 2025" t={t}/></div><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Hashtag</div><TIn v={pd.hashtag||""} on={v=>setPd(d=>Object.assign({},d,{hashtag:v}))} ph="#monclub" t={t}/></div></div>
  </div>);
}
// ─── INSERT TOLÉRANT ──────────────────────────────────────────
// Certaines colonnes sont ajoutées par des migrations qui peuvent ne pas être
// encore appliquées (thumb_url, migration 0003). Plutôt que de faire échouer
// l'import, on réessaie sans elles.
function isMissingColumn(error){
  return !!error && (error.code==="42703" || /column .* does not exist/i.test(error.message||""));
}
async function insertTolerant(table,payload,optionalCols){
  let res=await supabase.from(table).insert(payload).select().single();
  if(isMissingColumn(res.error)){
    console.warn("["+table+"] colonne optionnelle absente ("+optionalCols.join(", ")+") — migration non appliquée.");
    const rest=Object.assign({},payload);
    optionalCols.forEach(c=>delete rest[c]);
    res=await supabase.from(table).insert(rest).select().single();
  }
  return res;
}
// ─── PROJECTION D'UN VISUEL ───────────────────────────────────
// Ligne Supabase → objet manipulé par l'UI. Une seule définition : les trois
// copies précédentes divergeaient au moindre ajout de champ.
function mapVisual(v,sport){
  if(!v) return null;
  return{
    ...v,
    layers:v.layers||[],
    lineupData:v.lineup_data||{},
    groupData:v.group_data||{},
    postData:v.post_data||{},
    lineupTpl:v.lineup_tpl,
    groupTpl:v.group_tpl,
    postTpl:v.post_tpl,
    bgUrl:v.bg_url,
    logoUrl:v.logo_url,
    logo2Url:v.logo2_url,
    playerUrl:v.player_url,
    format:v.format||DEFAULT_FORMAT,
    // Le sport n'est pas stocké par visuel : la vignette d'historique utilise
    // celui du club, ce qui reste cohérent même après un changement de sport.
    sport,
    ct:ctypeInfo(sport,v.type),
  };
}
// ─── ÉCRITURE D'UN VISUEL ─────────────────────────────────────
// La colonne `format` est ajoutée par la migration
// supabase/migrations/0001_visuals_format.sql. Tant qu'elle n'est pas passée
// en base, on réécrit sans elle plutôt que de faire échouer la sauvegarde :
// l'app reste utilisable, seul le format retombe sur Story au rechargement.
async function writeVisual(mode,payload,id){
  const run=(body)=>mode==="update"
    ? supabase.from("visuals").update(body).eq("id",id).select().single()
    : supabase.from("visuals").insert(body).select().single();
  let res=await run(payload);
  // Deux colonnes peuvent manquer selon les migrations déjà passées :
  // `format` (0001) et `team_id` (0006). On retire celle que la base refuse
  // et on réessaie, plutôt que de perdre la sauvegarde du club.
  for(const[col,mig] of [["team_id","0006"],["format","0001"]]){
    if(res.error&&payload[col]!==undefined&&isMissingColumn(res.error)){
      console.warn("[writeVisual] colonne `"+col+"` absente — migration "+mig+" non appliquée.");
      const rest=Object.assign({},payload);
      delete rest[col];
      res=await run(rest);
      payload=rest;
    }
  }
  return res;
}
// ─── CHOIX DU SPORT ───────────────────────────────────────────
// Affiché une seule fois, à la première connexion : le sport détermine le
// vocabulaire, les postes, les formations et les types de visuels proposés.
function SportPicker({onPick,busy,t,clubName}){
  return(
    <div className="viz-minvh" style={{display:"flex",alignItems:"center",justifyContent:"center",background:t.bg,color:t.text,padding:"32px 20px",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
      <div style={{width:"100%",maxWidth:640}}>
        <div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".18em",textTransform:"uppercase",marginBottom:10}}>Première étape</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:44,fontWeight:400,letterSpacing:".02em",lineHeight:1,margin:"0 0 10px"}}>
          {clubName?"Quel sport pratique "+clubName+" ?":"Quel sport pratique votre club ?"}
        </h1>
        <p style={{color:t.text3,fontSize:13,lineHeight:1.6,margin:"0 0 20px"}}>
          Le vocabulaire, les postes, les formations et les types de visuels s'adaptent au sport choisi.
        </p>
        {/* Le choix est définitif : il faut le dire ici, et pas seulement une
            fois que le club a cliqué. */}
        <p style={{color:t.text2,fontSize:12,lineHeight:1.6,margin:"0 0 26px",padding:"10px 12px",background:t.bg3,border:"1px solid "+t.border,borderRadius:8}}>
          Ce choix est définitif. Il structure votre effectif et vos visuels, et ne pourra plus être modifié ensuite. Si vous pratiquez plusieurs disciplines, prenez un accès par discipline.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          {SPORT_LIST.map(sp=>(
            <button key={sp.id} onClick={()=>{if(busy)return;if(window.confirm("Confirmer « "+sp.label+" » comme sport du club ?\n\nCe choix est définitif et ne pourra plus être modifié."))onPick(sp.id);}} disabled={busy}
              style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:12,padding:"20px 16px",cursor:busy?"wait":"pointer",color:t.text,fontFamily:"inherit",textAlign:"left",display:"flex",flexDirection:"column",gap:6,transition:"border-color .15s,transform .15s"}}
              onMouseEnter={e=>{if(busy)return;e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";}}>
              <span style={{fontSize:28,lineHeight:1}}>{sp.icon}</span>
              <span style={{fontWeight:700,fontSize:14}}>{sp.label}</span>
              <span style={{fontSize:11,color:t.text3}}>{sp.kind==="team"?"Sport collectif":"Sport individuel"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── APP ──────────────────────────────────────────────────────
export default function App({session}){
  const[club,setClub]=useState(null);
  // Listes brutes telles que renvoyées par la base, toutes équipes confondues.
  // Les vues filtrées `players` et `history` sont dérivées plus bas : les
  // setters gardent leur nom, donc toutes les écritures existantes (ajout,
  // suppression, photos) continuent de porter sur la liste complète.
  const[allPlayers,setPlayers]=useState([]);
  const[media,setMedia]=useState([]);
  const[allHistory,setHistory]=useState([]);
  // Équipes du club et équipe active. teams vide = migration 0006 non
  // appliquée, l'app fonctionne alors en mode club unique.
  const[teams,setTeams]=useState([]);
  const[teamId,_setTeamId]=useState(null);
  const[loading,setLoading]=useState(true);
  // Écrans d'état de la connexion, pour ne plus déconnecter en silence :
  // "pending"  → club créé, en attente d'approbation admin
  // "error"    → la lecture du club a échoué (réseau, RLS, doublons)
  const[accessState,setAccessState]=useState(null);
  // Équipe active mémorisée par club : on retrouve la même en revenant.
  function setTeamId(id){
    _setTeamId(id);
    if(club&&id)lsSet("team_"+club.id,id);
  }
  // Un joueur ou un visuel sans équipe n'est pas perdu : il apparaît dans la
  // première équipe. Ce cas ne survient qu'après suppression d'une équipe
  // (on delete set null) ou sur des données antérieures à la migration 0006.
  const isDefaultTeam = teams.length>0 && teams[0].id===teamId;
  const players = useMemo(()=>{
    if(!teamId) return allPlayers;
    return allPlayers.filter(p=>p.team_id===teamId||(!p.team_id&&isDefaultTeam));
  },[allPlayers,teamId,isDefaultTeam]);
  const history = useMemo(()=>{
    if(!teamId) return allHistory;
    return allHistory.filter(h=>h.team_id===teamId||(!h.team_id&&isDefaultTeam));
  },[allHistory,teamId,isDefaultTeam]);
  const[nav,_setNav]=useState(navFromUrl);
  // Wrapper qui synchronise nav state + URL navigateur (pushState).
  // Back/forward natif : géré via popstate (useEffect ci-dessous).
  function setNav(navId){
    _setNav(navId);
    if(typeof window!=="undefined"){
      const targetPath=pathFromNav(navId);
      const currentPath=window.location.pathname.replace(/\/$/,"")||"/";
      if(currentPath!==targetPath){
        window.history.pushState({nav:navId},"",targetPath);
      }
    }
  }
  useEffect(()=>{
    function onPop(){_setNav(navFromUrl());}
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[]);
  const[selType,setSelType]=useState(null);
  const[editId,setEditId]=useState(null);
  const[pName,setPName]=useState("");const[pNum,setPNum]=useState("");const[pPos,setPPos]=useState("");
  const[layers,setLayers]=useState([]);
  const[bgUrl,setBgUrl]=useState(null);const[logoUrl,setLogoUrl]=useState(null);const[logo2Url,setLogo2Url]=useState(null);
  const[selPid,setSelPid]=useState(null);const[selPhoto,setSelPhoto]=useState(null);
  const[lineupData,setLineupData]=useState({formation:"4-4-2",starters:[],subs:[],opponent:"",competition:""});
  // FIX Lucas : on n'init pas title="GROUPE A" pour laisser le user taper.
  // Le placeholder "GROUPE A" (dans GroupEditor) + le fallback à l'affichage (GroupCanvas) suffisent.
  const[groupData,setGroupData]=useState({title:"",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
  const[postData,setPostData]=useState({title:"TITRE",subtitle:"Sous-titre",body:"Texte du message.",date:"",hashtag:""});
  const[lineupTpl,setLineupTpl]=useState("ln1");
  const[groupTpl,setGroupTpl]=useState("gr1");
  const[postTpl,setPostTpl]=useState("pt1");
  const[format,setFormat]=useState(DEFAULT_FORMAT);
  // Sport du club : un seul par club, choisi à la première connexion.
  // `null` en base = pas encore choisi → on affiche le sélecteur.
  const sport=club&&club.sport?club.sport:DEFAULT_SPORT;
  const T=termsFor(sport);
  const CT=useMemo(()=>ctypesFor(sport),[sport]);
  const NAVL=useMemo(()=>navFor(termsFor(sport)),[sport]);
  const[savingSport,setSavingSport]=useState(false);
  const[saveFlash,setSaveFlash]=useState(false);
  const[weeklyCount,setWeeklyCount]=useState(0);
  const[limitError,setLimitError]=useState("");
  const[onboardingSkipped,setOnboardingSkipped]=useState(()=>lsGet("onboarding_skipped")==="1");
  const[slotScale,setSlotScale]=useState(1);
  const[exportOverlay,setExportOverlay]=useState(null);  // {previewUrl, filename, blob} pour overlay iOS
  const[exporting,setExporting]=useState(false);
  const isMobile=useIsMobile();
  const F=fmt(format);
  const supportsFormat=FORMAT_TYPES.includes(selType);
  // Composition XI / Groupe restent en 9:16 (gabarits dessinés pour ce ratio).
  const canvasW=supportsFormat?F.w:FORMATS.story.w;
  const canvasH=supportsFormat?F.h:FORMATS.story.h;
  const canvasScale=useCanvasScale(canvasW,canvasH);
  const[mobileSheet,setMobileSheet]=useState(null);
  useEffect(()=>{
    if(!document.getElementById("viziona-landing-fonts")){
      const l=document.createElement("link");
      l.id="viziona-landing-fonts";
      l.rel="stylesheet";
      l.href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";
      document.head.appendChild(l);
    }
    if(document.getElementById("viz-mobile-css"))return;
    const s=document.createElement("style");
    s.id="viz-mobile-css";
    s.textContent='.viz-fullvh{height:100vh;height:100dvh;}.viz-minvh{min-height:100vh;min-height:100dvh;}'
      +'@media (max-width: 767px){'
      +'input:not([type="color"]):not([type="range"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]),'
      +'select,textarea{min-height:44px;font-size:14px;}'
      +'.viz-touch-btn{min-height:44px;}'
      +'}';
    document.head.appendChild(s);
  },[]);
  const mRef=useRef();
  const t=useMemo(()=>buildTheme(club?.color1,club?.color2,club?.theme_mode||"light"),[club]);
  // ── LOAD DATA ───────────────────────────────────────────────
  // Deux protections contre les données qui « disparaissent puis reviennent » :
  //  - l'effet est indexé sur l'id utilisateur, pas sur l'objet session (que
  //    Supabase remplace à chaque rafraîchissement de token) ;
  //  - un jeton de requête ignore le résultat d'un chargement périmé, pour
  //    qu'une réponse lente n'écrase pas un ajout fait entre-temps.
  const uid=session&&session.user?session.user.id:null;
  const loadTokenRef=useRef(0);
  useEffect(()=>{
    if(!uid)return;
    const token=++loadTokenRef.current;
    const stale=()=>loadTokenRef.current!==token;
    async function load(){
      setLoading(true);
      // ── Lecture du club ───────────────────────────────────────────────
      // NE PAS utiliser .single() ici : il lève une erreur si le résultat
      // n'est pas exactement une ligne — zéro, mais AUSSI deux ou plus.
      // L'ancien code ne lisait que `data` et ignorait l'erreur, donc toute
      // anomalie (doublon, RLS, réseau) tombait dans la branche « créer » et
      // ajoutait une ligne clubs + un mail admin à CHAQUE connexion.
      // On borne à 1 ligne, la plus ancienne, et on distingue les trois cas :
      // trouvé / aucun / échec.
      const{data:clubRows,error:selErr}=await supabase
        .from("clubs").select("*").eq("user_id",uid)
        .order("created_at",{ascending:true}).limit(1);
      if(stale())return;
      if(selErr){
        console.error("[load] lecture clubs échouée:",selErr);
        setAccessState("error");setLoading(false);return;
      }
      let clubData=(clubRows&&clubRows.length)?clubRows[0]:null;
      if(!clubData){
        // Première connexion via magic link : créer la ligne clubs avec le nom de club passé en user_metadata au signup.
        const meta=session.user.user_metadata||{};
        const newName=meta.club_name||"Mon Club";
        const newEmail=session.user.email||null;
        const{data:newClub,error:cErr}=await supabase.from("clubs").insert({user_id:uid,email:newEmail,name:newName}).select().single();
        if(stale())return;
        if(cErr){
          // 23505 = violation d'unicité sur clubs.user_id : une autre exécution
          // du même chargement a créé la ligne entre notre lecture et notre
          // insertion (constaté : deux insertions à 5 ms d'intervalle). Ce n'est
          // pas une erreur, c'est la course qu'on voulait empêcher — on relit.
          if(cErr.code==="23505"){
            const{data:again}=await supabase
              .from("clubs").select("*").eq("user_id",uid)
              .order("created_at",{ascending:true}).limit(1);
            if(stale())return;
            clubData=(again&&again.length)?again[0]:null;
          }
          if(!clubData){
            console.error("[load] insert clubs failed:",cErr);
            setAccessState("error");setLoading(false);return;
          }
        } else {
          clubData=newClub;
        }
        // Notifier l'admin uniquement à la création initiale (pas à chaque login).
        if(newClub){
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-signup`,{
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`},
            body:JSON.stringify({club_name:newName,email:newEmail}),
          }).catch(e=>console.warn("[load] notify-signup failed:",e));
        }
      }
      // Club connu mais pas encore validé : on l'affiche au lieu de déconnecter
      // sans explication. La session reste ouverte, un bouton permet de réessayer.
      if(!clubData?.approved){setAccessState("pending");setLoading(false);return;}
      if(stale())return;
      if(!clubData.sport){
        const local=lsGet("sport_"+clubData.id);
        if(local)clubData={...clubData,sport:local};
      }
      setClub(clubData);
      // Compter les visuels des 7 derniers jours
      const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
      const{count}=await supabase
        .from("visuals")
        .select("*",{count:"exact",head:true})
        .eq("club_id",clubData.id)
        .gte("created_at",since);
      if(stale())return;
      setWeeklyCount(count||0);

      // ── Équipes (migration 0006) ────────────────────────────────────────
      // Tant que la table n'existe pas, on reste en mode club unique : la
      // requête échoue, on garde une liste vide et rien n'est filtré. Le club
      // retrouve exactement le comportement d'avant.
      const{data:teamsData,error:teamsErr}=await supabase
        .from("teams").select("*").eq("club_id",clubData.id)
        .order("created_at",{ascending:true});
      if(stale())return;
      const teamList=teamsErr?[]:(teamsData||[]);
      if(teamsErr)console.warn("[load] teams indisponible (migration 0006 non appliquée ?) :",teamsErr.message);
      setTeams(teamList);
      // Équipe active : celle mémorisée pour ce club si elle existe encore,
      // sinon la plus ancienne.
      const savedTid=lsGet("team_"+clubData.id);
      const active=teamList.find(t=>t.id===savedTid)||teamList[0]||null;
      setTeamId(active?active.id:null);

      const{data:playersData}=await supabase.from("players").select("*, photos:player_photos(*)").eq("club_id",clubData.id);
      if(stale())return;
      setPlayers(sortPlayers(playersData));
      const{data:mediaData}=await supabase.from("media").select("*").eq("club_id",clubData.id);
      if(stale())return;
      setMedia(mediaData||[]);
      // Les visuels embarquent leurs images en base64 : sans limite, un club
      // actif téléchargerait des dizaines de Mo à chaque ouverture.
      const{data:visualsData}=await supabase.from("visuals").select("*").eq("club_id",clubData.id).order("created_at",{ascending:false}).limit(HISTORY_PAGE_SIZE);
      if(stale())return;
      const loadedSport=clubData.sport||DEFAULT_SPORT;
      setHistory((visualsData||[]).map(v=>mapVisual(v,loadedSport)));
      setLoading(false);
    }
    load();
    // Volontairement indexé sur `uid` seul : dépendre de `session` ferait
    // recharger toutes les données à chaque rafraîchissement de token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);
  async function updateClub(patch){const updated={...club,...patch};setClub(updated);await supabase.from("clubs").update(patch).eq("id",club.id);}
  // Le sport est stocké dans clubs.sport (migration 0004). Si la colonne
  // n'existe pas encore, on garde le choix en local pour ne pas bloquer le
  // club derrière un écran qu'il ne peut pas valider.
  async function chooseSport(next){
    setSavingSport(true);
    const{error}=await supabase.from("clubs").update({sport:next}).eq("id",club.id);
    if(error){
      console.warn("[chooseSport] colonne `sport` indisponible (migration 0004 non appliquée ?) :",error.message);
      lsSet("sport_"+club.id,next);
    }
    setClub(c=>({...c,sport:next}));
    setSavingSport(false);
  }
  // ─── ÉQUIPES ────────────────────────────────────────────────────────────
  // Le quota est aussi appliqué par un trigger côté base (migration 0006) :
  // ce contrôle-ci sert à donner un message utile, pas à faire respecter la
  // règle, qu'un appel direct à l'API contournerait.
  const maxTeams = club?.max_teams || 1;
  const teamQuotaReached = teams.length > 0 && teams.length >= maxTeams;
  async function addTeam(name){
    const label=(name||"").trim();
    if(!label)return;
    if(teamQuotaReached){
      setLimitError("Votre offre est limitée à "+maxTeams+(maxTeams>1?" équipes":" équipe")+". Passez à l'offre supérieure pour en ajouter.");
      setTimeout(()=>setLimitError(""),4000);return;
    }
    const{data,error}=await supabase.from("teams").insert({club_id:club.id,name:label}).select().single();
    if(error){
      console.error("[addTeam] échec:",error.message);
      setLimitError(error.code==="54000"?error.message:"Impossible de créer l'équipe : "+error.message);
      setTimeout(()=>setLimitError(""),4000);return;
    }
    setTeams(ts=>[...ts,data]);
    setTeamId(data.id);
  }
  async function renameTeam(id,name){
    const label=(name||"").trim();
    if(!label)return;
    setTeams(ts=>ts.map(x=>x.id===id?{...x,name:label}:x));
    const{error}=await supabase.from("teams").update({name:label}).eq("id",id);
    if(error)console.error("[renameTeam] échec:",error.message);
  }
  async function deleteTeam(id){
    // La base est en `on delete set null` : joueurs et visuels ne sont pas
    // détruits, ils basculent dans la première équipe. Le message le dit.
    const team=teams.find(x=>x.id===id);
    const n=allPlayers.filter(p=>p.team_id===id).length;
    const v=allHistory.filter(h=>h.team_id===id).length;
    const detail=(n||v)?"\n\nSes "+n+" "+T.playersLower+" et "+v+" visuel"+(v>1?"s":"")+" ne seront pas supprimés : ils rejoindront la première équipe.":"";
    if(!window.confirm("Supprimer l'équipe « "+(team?team.name:"")+" » ?"+detail))return;
    const{error}=await supabase.from("teams").delete().eq("id",id);
    if(error){console.error("[deleteTeam] échec:",error.message);return;}
    const rest=teams.filter(x=>x.id!==id);
    setTeams(rest);
    setPlayers(ps=>ps.map(p=>p.team_id===id?{...p,team_id:null}:p));
    setHistory(hs=>hs.map(h=>h.team_id===id?{...h,team_id:null}:h));
    if(teamId===id)setTeamId(rest[0]?rest[0].id:null);
  }
  async function addPlayer(){
    if(!pName.trim())return;
    const row={club_id:club.id,name:pName.trim(),number:pNum,position:pPos||getSport(sport).defaultPosition};
    // Rattaché à l'équipe active. Si la colonne n'existe pas encore
    // (migration 0006 non appliquée), on réessaie sans elle.
    if(teamId)row.team_id=teamId;
    const sel="*, photos:player_photos(*)";
    let{data,error}=await supabase.from("players").insert(row).select(sel).single();
    if(error&&row.team_id!==undefined&&isMissingColumn(error)){
      console.warn("[addPlayer] colonne `team_id` absente — migration 0006 non appliquée.");
      const rest=Object.assign({},row);delete rest.team_id;
      ({data,error}=await supabase.from("players").insert(rest).select(sel).single());
    }
    if(error){console.error("[addPlayer] échec:",error.message);return;}
    if(data)setPlayers(p=>sortPlayers([...p,data]));
    setPName("");setPNum("");
  }
  async function deletePlayer(id){
    const p=players.find(x=>x.id===id);
    const n=p&&p.photos?p.photos.length:0;
    if(!window.confirm("Retirer "+((p&&p.name)||"ce joueur")+" de l'effectif"+(n?" ainsi que ses "+n+" photo"+(n>1?"s":""):"")+" ?"))return;
    await supabase.from("players").delete().eq("id",id);
    setPlayers(prev=>prev.filter(x=>x.id!==id));
    if(selPid===id){setSelPid(null);setSelPhoto(null);}
  }
  // Les photos sont redimensionnées et recompressées ici : un fichier de 25 Mo
  // passe sans que l'utilisateur ait à préparer ses images en amont.
  const addPhoto=useCallback(async(playerId,file)=>{
    const img=await intakeImageWithThumb(file,"photo");
    if(!img)return;
    const{data,error}=await insertTolerant("player_photos",
      {player_id:playerId,url:img.url,thumb_url:img.thumbUrl,name:file.name,is_fav:false},["thumb_url"]);
    if(error){console.error("[addPhoto] échec:",error);alert("Enregistrement de la photo impossible : "+error.message);return;}
    if(data)setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:sortPhotos([...(p.photos||[]),data])}:p));
  },[]);
  const addPhotoUrl=useCallback(async(playerId,url,name)=>{
    let thumbUrl=null;
    try{ thumbUrl=await makeThumbnail(url); }catch(e){ console.warn("[addPhotoUrl] vignette non générée:",e); }
    const{data,error}=await insertTolerant("player_photos",
      {player_id:playerId,url,thumb_url:thumbUrl,name:name||"photo_nobg",is_fav:false},["thumb_url"]);
    if(error){console.error("[addPhotoUrl] échec:",error);alert("Enregistrement de la photo impossible : "+error.message);return;}
    if(data)setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:sortPhotos([...(p.photos||[]),data])}:p));
  },[]);
  const deletePhoto=useCallback(async(playerId,photoId,photoUrl)=>{
    const{error}=await supabase.from("player_photos").delete().eq("id",photoId);
    if(error){console.error("[deletePhoto] échec:",error);alert("Suppression impossible : "+error.message);return;}
    setPlayers(prev=>prev.map(p=>p.id===playerId
      ?{...p,photos:(p.photos||[]).filter(ph=>ph.id!==photoId)}
      :p));
    // Si la photo supprimée était posée sur le visuel en cours, on la retire du canvas.
    setSelPhoto(cur=>(photoUrl&&cur===photoUrl)?null:cur);
  },[]);
  const toggleFav=useCallback(async(playerId,photoId)=>{
    const player=players.find(p=>p.id===playerId);
    const photo=player?.photos?.find(ph=>ph.id===photoId);
    if(!photo)return;
    await supabase.from("player_photos").update({is_fav:!photo.is_fav}).eq("id",photoId);
    setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:p.photos.map(ph=>ph.id===photoId?{...ph,is_fav:!ph.is_fav}:ph)}:p));
  },[players]);
  async function pickMedia(e){
    const files=[...e.target.files];
    e.target.value="";
    for(const file of files){
      const img=await intakeImageWithThumb(file,"media");
      if(!img)continue;
      const{data,error}=await insertTolerant("media",
        {club_id:club.id,url:img.url,thumb_url:img.thumbUrl,name:file.name},["thumb_url"]);
      if(error){console.error("[pickMedia] échec:",error);alert("Enregistrement du média impossible : "+error.message);continue;}
      if(data)setMedia(m=>[...m,data]);
    }
  }
  async function deleteMedia(id){await supabase.from("media").delete().eq("id",id);setMedia(m=>m.filter(x=>x.id!==id));}
  // Changer de format ne recrée pas le visuel : les calques sont positionnés
  // en %, seules les tailles de texte suivent la hauteur du canvas.
  function changeFormat(next){
    if(next===format)return;
    setLayers(cur=>scaleLayersToFormat(cur,format,next));
    setFormat(next);
  }
  function selPlayer(id){
    const prev=players.find(x=>x.id===selPid)||null;
    setSelPid(id||null);
    if(id){
      const p=players.find(x=>x.id===id);
      setSelPhoto(p?getPhoto(p)||null:null);
      // Le nom et le poste du joueur se posent tout seuls sur le visuel, tant
      // que ces textes n'ont pas été personnalisés à la main.
      if(p)setLayers(cur=>applyPlayerToLayers(cur,p,prev,sport));
    }
    else setSelPhoto(null);
  }
  function postDataToLayers(pd,c1){
    // Conversion rétrocompatible : postData legacy → layers libres
    const layers=[
      {id:"bg",z:0,type:"bg",x:0,y:0,w:100,h:100,locked:true,label:"Fond",fillColor:"#000000"},
      {id:"lg",z:1,type:"logo",x:4,y:4,w:14,h:14,locked:false,label:"Logo club"},
    ];
    if(pd&&pd.title)layers.push({id:"h1",z:2,type:"text",x:6,y:30,w:88,h:16,locked:false,label:"Titre",text:pd.title,font:"Impact",fontSize:38,color:"#ffffff",bold:true,italic:false,upper:true,letterSpacing:1,lineHeight:1.2,bgColor:"#000000",bgOpacity:0,textShadow:8,align:"center",curve:0});
    if(pd&&pd.subtitle)layers.push({id:"h2",z:3,type:"text",x:6,y:48,w:88,h:9,locked:false,label:"Sous-titre",text:pd.subtitle,font:"Impact",fontSize:18,color:c1,bold:false,italic:false,upper:false,letterSpacing:0,lineHeight:1.2,bgColor:"#000000",bgOpacity:0,textShadow:8,align:"center",curve:0});
    if(pd&&pd.body)layers.push({id:"bd",z:4,type:"text",x:6,y:60,w:88,h:18,locked:false,label:"Corps",text:pd.body,font:"Impact",fontSize:14,color:"rgba(255,255,255,0.7)",bold:false,italic:false,upper:false,letterSpacing:0,lineHeight:1.5,bgColor:"#000000",bgOpacity:0,textShadow:8,align:"left",curve:0});
    if(pd&&(pd.date||pd.hashtag))layers.push({id:"dt",z:5,type:"text",x:6,y:88,w:88,h:6,locked:false,label:"Date / Hashtag",text:(pd.date||"")+(pd.date&&pd.hashtag?" · ":"")+(pd.hashtag||""),font:"Impact",fontSize:11,color:"rgba(255,255,255,0.55)",bold:false,italic:false,upper:false,letterSpacing:0,lineHeight:1.2,bgColor:"#000000",bgOpacity:0,textShadow:6,align:"center",curve:0});
    return layers;
  }
  function openCreate(type,fromH){
    setSelType(type);setNav("create");
    setFormat(fromH&&fromH.format?fromH.format:DEFAULT_FORMAT);
    if(fromH){
      setEditId(fromH.id);setBgUrl(fromH.bgUrl||null);setLogoUrl(fromH.logoUrl||null);setLogo2Url(fromH.logo2Url||null);
      setSelPhoto(fromH.playerUrl||null);setSelPid(null);
      // Rétrocompat post : si layers absents/vides ET postData présent → conversion automatique
      if(type==="post"&&(!fromH.layers||fromH.layers.length===0)&&fromH.postData){
        setLayers(postDataToLayers(fromH.postData,club?.color1||"#e63329"));
      }else if(fromH.layers){
        setLayers(fromH.layers);
      }
      if(fromH.lineupData)setLineupData(fromH.lineupData);
      if(fromH.groupData)setGroupData(fromH.groupData);
      if(fromH.postData)setPostData(fromH.postData);
      if(fromH.lineupTpl)setLineupTpl(fromH.lineupTpl);
      if(fromH.groupTpl)setGroupTpl(fromH.groupTpl);
      if(fromH.postTpl)setPostTpl(fromH.postTpl);
    } else {
      setEditId(null);setBgUrl(null);setLogoUrl(club?.logo_url||null);setLogo2Url(null);setSelPid(null);setSelPhoto(null);
      // Post est désormais un éditeur libre : utilise makeLayers comme goal/result/match/recruit
      if(type!=="lineup"&&type!=="group")setLayers(makeLayers(type,club?.color1||"#e63329",club?.color2||"#1a1a2e",sport));
      if(type==="lineup")setLineupData({formation:firstFormation(sport),starters:[],subs:[],opponent:"",competition:""});
      if(type==="group")setGroupData({title:"",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
    }
  }
  async function save(){
    if(!editId){
      if(weeklyCount>=(club.max_visuals_per_week||5)){
        setLimitError("Limite hebdomadaire atteinte. Passez à l'offre supérieure pour continuer.");
        setTimeout(()=>setLimitError(""),3000);
        return;
      }
    }
    const ct=ctypeInfo(sport,selType);
    const payload={club_id:club.id,type:selType,label:ct?.label||"",icon:ct?.icon||"",layers,lineup_data:lineupData,group_data:groupData,post_data:postData,lineup_tpl:lineupTpl,group_tpl:groupTpl,post_tpl:postTpl,bg_url:bgUrl,logo_url:logoUrl,logo2_url:logo2Url,player_url:selPhoto,format:supportsFormat?format:DEFAULT_FORMAT,updated_at:new Date().toISOString()};
    // Le visuel appartient à l'équipe active. Omis si aucune équipe n'existe
    // (migration 0006 non appliquée) : writeVisual retire la colonne au besoin.
    if(teamId)payload.team_id=teamId;
    let saved;
    if(editId){
      const{data,error}=await writeVisual("update",payload,editId);
      if(error){console.error("[save] update failed:",error.message);setLimitError("Erreur lors de la sauvegarde : "+error.message);setTimeout(()=>setLimitError(""),4000);return;}
      saved=data;
      if(saved)setHistory(h=>h.map(x=>x.id===editId?mapVisual(saved,sport):x));
    } else {
      const{data,error}=await writeVisual("insert",payload);
      if(error){console.error("[save] insert failed:",error.message);setLimitError("Erreur lors de la sauvegarde : "+error.message);setTimeout(()=>setLimitError(""),4000);return;}
      saved=data;
      if(saved)setHistory(h=>[mapVisual(saved,sport),...h]);
    }
    if(saved&&!editId)setWeeklyCount(w=>w+1);
    if(saved)setEditId(saved.id);
    setSaveFlash(true);setTimeout(()=>setSaveFlash(false),2000);
  }
  async function deleteVisual(id){await supabase.from("visuals").delete().eq("id",id);setHistory(h=>h.filter(x=>x.id!==id));}
  async function signOut(){await supabase.auth.signOut();}
  async function downloadPng(){
    const el=document.querySelector(".visium-canvas");
    if(!el){setLimitError("Aperçu introuvable.");setTimeout(()=>setLimitError(""),2000);return;}
    // FIX Lucas Test 27 : télécharger doit aussi sauvegarder dans l'historique.
    // Si le visuel n'a jamais été enregistré (editId null), on save AVANT le PNG
    // pour qu'il apparaisse dans "Visuels" côté user. Une erreur de save ne bloque pas l'export.
    if(!editId){
      try{ await save(); }catch(e){ console.warn("[downloadPng] auto-save a échoué:",e); }
    }
    setExporting(true);
    try{
      // Chargé à la demande : html2canvas pèse ~200 Ko et ne sert qu'à l'export.
      const html2canvas=(await import("html2canvas")).default;
      const filename="viziona-"+(selType||"visuel")+"-"+Date.now()+".png";
      const ua=navigator.userAgent;
      const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
      const isSafari=/Safari/.test(ua)&&!/CriOS|FxiOS|Chrome|Edg/.test(ua);

      // Échelle d'export : 4 vise 1080 px de large (le canvas fait 270).
      // `navigator.deviceMemory` n'existe pas sur Safari, donc l'ancien
      // `||4` retenait justement l'échelle la plus lourde sur l'appareil le
      // plus contraint. On part plus bas sur mobile et on redescend encore si
      // le rendu échoue, plutôt que de laisser l'onglet se faire tuer.
      const memGB=navigator.deviceMemory;
      const ladder = memGB&&memGB<4 ? [2.5,2,1.5]
                   : isMobile       ? [3,2,1.5]
                   :                  [4,3,2];

      let blob=null, usedScale=null;
      for(const scale of ladder){
        let canvas=null;
        try{
          canvas=await html2canvas(el,{backgroundColor:null,scale,useCORS:true,allowTaint:true,logging:false,imageTimeout:15000});
          blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
        }catch(err){
          console.warn("[downloadPng] échec à l'échelle "+scale+" :",err&&err.message);
        }finally{
          // Libère explicitement le backing store : Safari ne le rend pas
          // avant longtemps si on se contente de perdre la référence.
          if(canvas){canvas.width=0;canvas.height=0;}
        }
        if(blob){usedScale=scale;break;}
      }
      if(!blob){
        setLimitError("Export impossible sur cet appareil. Fermez les autres onglets et réessayez.");
        setTimeout(()=>setLimitError(""),5000);
        return;
      }
      if(usedScale!==ladder[0])console.info("[downloadPng] export réalisé à l'échelle réduite "+usedScale);

      // iOS Safari : overlay React pour conserver le contexte de geste
      // utilisateur (le clic sur « Enregistrer »). On passe un blob URL et non
      // une data URL : le base64 d'un PNG 1080×1920 pèse plusieurs Mo en
      // mémoire, et il finissait stocké dans le state React en plus du blob.
      if(isIOS&&isSafari){
        setExportOverlay({previewUrl:URL.createObjectURL(blob),filename,blob});
        return;
      }
      // Tous les autres navigateurs : <a download> standard
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=filename;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){
      console.error("[downloadPng] échec:",e);
      setLimitError("Erreur lors de l'export PNG.");
      setTimeout(()=>setLimitError(""),3000);
    }finally{
      setExporting(false);
    }
  }
  // Ferme l'overlay en libérant le blob URL de l'aperçu.
  function closeExportOverlay(){
    setExportOverlay(cur=>{
      if(cur&&cur.previewUrl)URL.revokeObjectURL(cur.previewUrl);
      return null;
    });
  }
  async function handleOverlayShare(){
    if(!exportOverlay)return;
    const{blob,filename}=exportOverlay;
    try{
      const file=new File([blob],filename,{type:"image/png"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Visuel Viziona"});
        closeExportOverlay();
        return;
      }
    }catch(e){
      if(e&&e.name==="AbortError"){return;}
      console.warn("[overlay share] fallback:",e);
    }
    // Repli : on ouvre l'image seule dans un onglet (appui long → Ajouter aux
    // Photos). Un blob URL plutôt que document.write, déprécié et bloqué par
    // certaines CSP.
    const viewUrl=URL.createObjectURL(blob);
    const w=window.open(viewUrl,"_blank","noopener");
    if(w){
      setTimeout(()=>URL.revokeObjectURL(viewUrl),60000);
      closeExportOverlay();return;
    }
    URL.revokeObjectURL(viewUrl);
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=filename;a.target="_blank";a.rel="noopener";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    closeExportOverlay();
  }
  // Sport pas encore choisi → on le demande avant tout le reste.
  if(!loading&&club&&!club.sport)return <SportPicker onPick={chooseSport} busy={savingSport} t={t} clubName={club.name}/>;
  if(loading)return(<div className="viz-fullvh" style={{display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",color:"rgba(240,240,248,.4)",fontFamily:"system-ui",flexDirection:"column",gap:12}}><div style={{fontSize:28}}>⚡</div><div>Chargement de vos données...</div></div>);
  // Compte connu mais accès pas encore ouvert, ou lecture impossible.
  // On garde la session : l'utilisateur peut réessayer sans redemander un lien.
  if(accessState){
    const isPending=accessState==="pending";
    return(<div className="viz-fullvh" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#FAFAFA",color:"#0A0A0A",padding:24,textAlign:"center",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,letterSpacing:".02em",marginBottom:10}}>{isPending?"PRESQUE.":"OUPS."}</div>
      <p style={{fontSize:15,color:"#555",maxWidth:430,lineHeight:1.6,marginBottom:8}}>
        {isPending
          ? "Votre compte existe bien. Il attend encore la validation manuelle de votre accès — vous recevrez un e-mail dès qu'il est ouvert."
          : "Nous n'avons pas réussi à charger votre club. C'est temporaire, votre compte et vos visuels sont intacts."}
      </p>
      <p style={{fontSize:13,color:"#888",marginBottom:28}}>{session?.user?.email||""}</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={()=>{setAccessState(null);setLoading(true);loadTokenRef.current++;window.location.reload();}} style={{background:"#0A0A0A",color:"#FAFAFA",border:"none",padding:"14px 32px",borderRadius:2,fontSize:12,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>Réessayer</button>
        <button onClick={()=>supabase.auth.signOut()} style={{background:"transparent",color:"#0A0A0A",border:"1px solid #0A0A0A",padding:"14px 32px",borderRadius:2,fontSize:12,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>Se déconnecter</button>
      </div>
    </div>);
  }
  const card={background:t.bg2,border:"1px solid "+t.border,borderRadius:13,padding:20};
  // Fragments rendus par appel, pas des composants : les redéfinir à chaque
  // rendu créerait un nouveau type de composant et remonterait le sous-arbre.
  function saveBtn(){return(<>
    {limitError&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:8,padding:"10px 14px",color:"#fca5a5",fontSize:12,marginBottom:10}}>{limitError}</div>}
    <button onClick={save} style={{background:saveFlash?"#22c55e":"#0a0a0a",color:"#fff",border:"none",borderRadius:2,padding:"13px 16px",fontSize:11,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:".12em",textTransform:"uppercase",transition:"background .3s,transform .15s",fontFamily:"inherit"}}>{saveFlash?"Sauvegardé ✓":"Sauvegarder"}</button>
    <button onClick={downloadPng} disabled={exporting} style={{marginTop:8,background:"transparent",color:t.text,border:"1px solid "+t.text,borderRadius:2,padding:"12px 16px",fontSize:11,fontWeight:600,cursor:exporting?"wait":"pointer",width:"100%",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"inherit",opacity:exporting?.6:1}}>{exporting?"Génération…":"Télécharger PNG"}</button>
  </>);}
  function backBtn(){return<button onClick={()=>setSelType(null)} style={{display:"inline-flex",alignItems:"center",gap:7,background:t.bg3,border:"1px solid "+t.border2,borderRadius:8,padding:"7px 13px",color:t.text2,cursor:"pointer",fontSize:12,marginBottom:14,fontWeight:500}}>↩ Retour</button>;}
  function renderSpecial(){
    const isL=selType==="lineup",isP=selType==="post",isG=selType==="group";
    const tpls=isL?LINEUP_TPLS:isP?POST_TPLS:GROUP_TPLS;
    const tpl=isL?lineupTpl:isP?postTpl:groupTpl;
    const setTpl=isL?setLineupTpl:isP?setPostTpl:setGroupTpl;
    const panelStyle=isMobile?{position:"fixed",bottom:0,left:0,right:0,maxHeight:"75vh",background:t.bg2,borderTop:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0,zIndex:200,transform:mobileSheet==="options"?"translateY(0)":"translateY(100%)",transition:"transform .25s ease",boxShadow:mobileSheet==="options"?"0 -8px 24px rgba(0,0,0,.4)":"none",borderTopLeftRadius:16,borderTopRightRadius:16}:{width:268,background:t.bg2,borderRight:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0};
    return(<div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",flexDirection:isMobile?"column":"row"}}>
      {isMobile&&mobileSheet==="options"&&<div onClick={()=>setMobileSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:150}}/>}
      <div data-bottom-sheet="options" style={panelStyle}>
        {isMobile&&<div {...makeSwipeClose(()=>setMobileSheet(null))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"1px solid "+t.border,touchAction:"none",cursor:"grab",userSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:4,background:"rgba(255,255,255,.2)",borderRadius:3}}/><div style={{fontSize:13,fontWeight:700,color:t.text}}>Options</div></div><button onClick={()=>setMobileSheet(null)} style={{background:"none",border:"none",color:t.text3,fontSize:18,cursor:"pointer",padding:4}}>✕</button></div>}
        {!isMobile&&backBtn()}
        <PBox t={t}><SHdr label="Template" t={t}/><TplGrid tpls={tpls} sel={tpl} onSel={setTpl} t={t} maxTemplates={club?.max_templates}/></PBox>
        <PBox t={t}>
          <SHdr label="Image de fond" t={t}/>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.slice(0,6).map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:"2px solid "+(bgUrl===m.url?t.accent:t.border),cursor:"pointer"}}><img src={thumbOf(m)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <div style={{display:"flex",gap:8,alignItems:"center"}}><UpBtn val={null} on={v=>setBgUrl(v)} w={48} h={34} r={6} label="Uploader" t={t} preset="media"/>{bgUrl&&<button onClick={()=>setBgUrl(null)} style={{fontSize:11,color:t.text3,background:"none",border:"none",cursor:"pointer"}}>✕ Retirer</button>}</div>
        </PBox>
        <PBox t={t}>
          <SHdr label="Logo club" t={t}/>
          <UpBtn val={logoUrl} on={setLogoUrl} w={56} h={56} r={8} label="Upload" t={t}/>
          {club?.logo_url&&<button onClick={()=>setLogoUrl(club.logo_url)} style={{fontSize:10,color:t.accent,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>← Logo club</button>}
          {isL&&<div style={{marginTop:10}}><div style={{fontSize:10,color:t.text3,marginBottom:5}}>Logo adversaire</div><UpBtn val={logo2Url} on={setLogo2Url} w={56} h={56} r={8} label="Upload ADV" t={t}/>{logo2Url&&<button onClick={()=>setLogo2Url(null)} style={{fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>✕ Retirer</button>}</div>}
        </PBox>
        {isL&&(
          <PBox t={t}>
            <SHdr label={"Taille des avatars · "+Math.round(slotScale*100)+"%"} t={t}/>
            <TouchSlider value={slotScale} onChange={v=>setSlotScale(v)} min={0.5} max={2.0} step={0.05} t={t} isMobile={isMobile}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:t.text3,marginTop:2}}><span>50%</span><span>200%</span></div>
          </PBox>
        )}
        <PBox t={t} mb={12}>
          <SHdr label={isL?T.lineupTitle:isP?"Contenu":T.squadSection} t={t}/>
          {isL&&<LineupEditor ld={lineupData} setLd={setLineupData} players={players} t={t} sport={sport}/>}
          {isG&&<GroupEditor gd={groupData} setGd={setGroupData} players={players} t={t} sport={sport}/>}
          {isP&&<PostEditor pd={postData} setPd={setPostData} t={t}/>}
        </PBox>
        {saveBtn()}
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#030306",flexDirection:"column",gap:14,padding:isMobile?"12px 8px 70px":0,overflow:"auto"}}>
        <div style={isMobile?{width:270*canvasScale,height:480*canvasScale,position:"relative",overflow:"visible",flexShrink:0}:{display:"inline-block"}}>
          <div style={isMobile?{position:"absolute",top:0,left:0,width:270,height:480,transform:"scale("+canvasScale+")",transformOrigin:"top left"}:{display:"contents"}}>
            <div className="visium-canvas" style={{display:"inline-block"}}>
              {isL&&<LineupCanvas ld={lineupData} tpl={lineupTpl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl} slotScale={slotScale} sport={sport}/>}
              {isG&&<GroupCanvas gd={groupData} tpl={groupTpl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl}/>}
              {isP&&<PostCanvas pd={postData} tpl={postTpl} logoUrl={logoUrl||club?.logo_url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl}/>}
            </div>
          </div>
        </div>
        {!isMobile&&<div style={{fontSize:11,color:"rgba(255,255,255,.18)",letterSpacing:".1em",textTransform:"uppercase"}}>Aperçu en temps réel</div>}
      </div>
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:t.bg2,borderTop:"1px solid "+t.border,display:"flex",gap:8,alignItems:"center",padding:"0 12px",zIndex:90}}>
          <button onClick={()=>setSelType(null)} className="viz-touch-btn" style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:8,padding:"10px 14px",color:t.text2,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>↩</button>
          <button onClick={()=>setMobileSheet("options")} className="viz-touch-btn" style={{flex:1,background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>⚙ Options</button>
          <button onClick={save} className="viz-touch-btn" style={{flex:1,background:saveFlash?"#22c55e":t.accent,color:saveFlash?"#fff":contrastText(t.accent),border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{saveFlash?"✓":"💾 Sauver"}</button>
        </div>
      )}
    </div>);
  }
  function renderStandard(){
    const stdPanelStyle=isMobile?{position:"fixed",bottom:0,left:0,right:0,maxHeight:"75vh",background:t.bg2,borderTop:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0,zIndex:200,transform:mobileSheet==="options"?"translateY(0)":"translateY(100%)",transition:"transform .25s ease",boxShadow:mobileSheet==="options"?"0 -8px 24px rgba(0,0,0,.4)":"none",borderTopLeftRadius:16,borderTopRightRadius:16}:{width:250,background:t.bg2,borderRight:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0};
    return(<div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",flexDirection:isMobile?"column":"row"}}>
      {isMobile&&mobileSheet==="options"&&<div onClick={()=>setMobileSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:150}}/>}
      <div data-bottom-sheet="options" style={stdPanelStyle}>
        {isMobile&&<div {...makeSwipeClose(()=>setMobileSheet(null))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"1px solid "+t.border,touchAction:"none",cursor:"grab",userSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:34,height:4,background:"rgba(255,255,255,.2)",borderRadius:3}}/><div style={{fontSize:13,fontWeight:700,color:t.text}}>Options</div></div><button onClick={()=>setMobileSheet(null)} style={{background:"none",border:"none",color:t.text3,fontSize:18,cursor:"pointer",padding:4}}>✕</button></div>}
        {!isMobile&&backBtn()}
        <PBox t={t}>
          <SHdr label="Format de publication" t={t}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
            {Object.values(FORMATS).map(f=>{
              const on=format===f.id;
              return(
                <button key={f.id} onClick={()=>changeFormat(f.id)} title={f.desc}
                  style={{background:on?rgba(t.accent,.18):t.bg3,border:"2px solid "+(on?t.accent:t.border),borderRadius:8,padding:"9px 4px",cursor:"pointer",color:t.text,fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{display:"block",width:f.id==="story"?13:f.id==="post"?17:20,height:f.id==="story"?23:f.id==="post"?21:20,border:"1.5px solid "+(on?t.accent:t.text3),borderRadius:2}}/>
                  <span style={{fontSize:11,fontWeight:on?700:500,color:on?t.accent:t.text}}>{f.label}</span>
                  <span style={{fontSize:9,color:t.text3}}>{f.sub}</span>
                </button>
              );
            })}
          </div>
          <div style={{fontSize:9,color:t.text3,marginTop:6,lineHeight:1.4}}>{fmt(format).desc}</div>
        </PBox>
        <PBox t={t}><SHdr label={T.player+" & photo"} t={t}/><PhotoPanel players={players} selId={selPid} onSel={selPlayer} selUrl={selPhoto} onSelUrl={setSelPhoto} onAdd={addPhoto} onAddUrl={addPhotoUrl} onFav={toggleFav} onDelete={deletePhoto} t={t} terms={T}/></PBox>
        <PBox t={t}>
          <SHdr label="Image de fond" t={t}/>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:"2px solid "+(bgUrl===m.url?t.accent:t.border),cursor:"pointer"}}><img src={thumbOf(m)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <UpBtn val={null} on={v=>setBgUrl(v)} w={52} h={36} r={6} label="Uploader" t={t} preset="media"/>
            {bgUrl&&<button onClick={()=>setBgUrl(null)} style={{fontSize:11,color:t.text3,background:"none",border:"none",cursor:"pointer"}}>✕ Retirer</button>}
          </div>
        </PBox>
        {selType==="post"&&(()=>{
          const bgLay=layers.find(l=>l.type==="bg");
          const curColor=(bgLay&&bgLay.fillColor)||"#000000";
          return(
            <PBox t={t}>
              <SHdr label="Couleur de fond" t={t}/>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={curColor} onChange={e=>setLayers(prev=>prev.map(l=>l.type==="bg"?{...l,fillColor:e.target.value}:l))} style={{width:60,height:36,borderRadius:6,border:"1px solid "+t.border2,background:t.bg3,cursor:"pointer",padding:2}}/>
                <span style={{fontSize:11,color:t.text3}}>Visible si pas d'image de fond</span>
              </div>
            </PBox>
          );
        })()}
        <PBox t={t}>
          <SHdr label={selType==="recruit"?"Logo club":"Logos"} t={t}/>
          <div style={{display:"grid",gridTemplateColumns:(selType==="result"||selType==="match")?"1fr 1fr":"1fr",gap:10}}>
            <div><div style={{fontSize:10,color:t.text3,marginBottom:5}}>Club</div><UpBtn val={logoUrl} on={setLogoUrl} w={52} h={52} r={8} label="Upload" t={t}/>{club?.logo_url&&<button onClick={()=>setLogoUrl(club.logo_url)} style={{fontSize:10,color:t.accent,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>← Logo club</button>}</div>
            {(selType==="result"||selType==="match")&&<div><div style={{fontSize:10,color:t.text3,marginBottom:5}}>Adversaire</div><UpBtn val={logo2Url} on={setLogo2Url} w={52} h={52} r={8} label="Upload" t={t}/>{logo2Url&&<button onClick={()=>setLogo2Url(null)} style={{fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>✕</button>}</div>}
          </div>
        </PBox>
        {saveBtn()}
      </div>
      <DragCanvas key={editId||("new_"+selType)} layers={layers} setLayers={setLayers} bgUrl={bgUrl} playerUrl={selPhoto} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={t.accent} accent2={t.accent2} t={t} isMobile={isMobile} mobileSheet={mobileSheet} setMobileSheet={setMobileSheet} canvasScale={canvasScale} clubName={club?.name} cw={canvasW} ch={canvasH} onLogoChange={(kind,url)=>{if(kind==="logo2")setLogo2Url(url);else setLogoUrl(url);}}/>
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:t.bg2,borderTop:"1px solid "+t.border,display:"flex",gap:6,alignItems:"center",padding:"0 10px",zIndex:90}}>
          <button onClick={()=>setSelType(null)} className="viz-touch-btn" style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:8,padding:"10px 12px",color:t.text2,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>↩</button>
          <button onClick={()=>setMobileSheet("options")} className="viz-touch-btn" style={{flex:1,background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:8,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>⚙ Options</button>
          <button onClick={()=>setMobileSheet("layers")} className="viz-touch-btn" style={{flex:1,background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:8,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>≡ Calques</button>
          <button onClick={save} className="viz-touch-btn" style={{flex:1,background:saveFlash?"#22c55e":t.accent,color:saveFlash?"#fff":contrastText(t.accent),border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{saveFlash?"✓":"💾"}</button>
        </div>
      )}
    </div>);
  }
  return(
    <div className="viz-fullvh" style={{display:"flex",background:t.bg,color:t.text,fontFamily:"'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif",fontSize:13,overflow:"hidden",letterSpacing:"-0.005em"}}>
      {!isMobile&&!(nav==="create"&&selType)&&(<div style={{width:192,background:t.bg2,borderRight:"1px solid "+t.border,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"15px 14px 13px",borderBottom:"1px solid "+t.border,display:"flex",alignItems:"center",gap:10}}>
          {club?.logo_url?<img src={club.logo_url} style={{width:34,height:34,objectFit:"contain",borderRadius:7}} alt=""/>:<div style={{width:34,height:34,borderRadius:7,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:contrastText(mixC(club?.color1||"#e63329",club?.color2||"#1a1a2e",.5)),flexShrink:0}}>{(club?.name||"E")[0].toUpperCase()}</div>}
          <div style={{overflow:"hidden",flex:1}}><div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,fontWeight:400,letterSpacing:".06em",color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{club?.name||"Viziona"}</div><div style={{fontFamily:"'DM Mono',ui-monospace,monospace",fontSize:9,color:t.text3,marginTop:2,letterSpacing:".1em",textTransform:"uppercase"}}>Studio visuel</div></div>
        </div>
        <nav style={{padding:"10px 8px",flex:1}}>
          {NAVL.map(n=>(<button key={n.id} onClick={()=>{setNav(n.id);if(n.id!=="create")setSelType(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:nav===n.id?rgba(t.accent,.15):"transparent",border:"none",borderRadius:9,padding:"9px 11px",color:nav===n.id?t.accent:t.text2,cursor:"pointer",fontSize:13,marginBottom:1,textAlign:"left",fontWeight:nav===n.id?600:400}}><span style={{fontSize:15,lineHeight:1}}>{n.icon}</span><span>{n.label}</span>{n.id==="history"&&history.length>0&&<span style={{marginLeft:"auto",background:rgba(t.accent,.2),color:t.accent,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10}}>{history.length}</span>}</button>))}
        </nav>
        <div style={{padding:12,borderTop:"1px solid "+t.border,display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>openCreate("goal")} style={{background:"#0a0a0a",color:"#fff",border:"2px solid "+(club?.color1||"#e63329"),borderRadius:2,padding:"10px 10px",fontSize:11,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:".12em",textTransform:"uppercase",fontFamily:"inherit"}}>Créer un visuel</button>
          <button onClick={signOut} style={{background:"transparent",color:t.text3,border:"1px solid "+t.border,borderRadius:8,padding:"7px",fontSize:11,cursor:"pointer",width:"100%"}}>Déconnexion</button>
        </div>
      </div>)}
      <div style={{flex:1,display:"flex",overflow:"hidden",paddingBottom:isMobile&&!(nav==="create"&&selType)?60:0,boxSizing:"border-box"}}>
        {nav==="home"&&(<div style={{flex:1,overflowY:"auto",background:t.bg}}>
          <div style={{padding:"28px 28px 0"}}><h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:44,fontWeight:400,color:t.text,marginBottom:4,letterSpacing:".015em",lineHeight:1}}>{"Bonjour"+(club?.name?", "+club.name:"")}</h1><p style={{color:t.text3,marginBottom:24,fontSize:14}}>Que souhaitez-vous créer aujourd'hui ?</p></div>
          {(()=>{
            if(onboardingSkipped)return null;
            const clubDone=club?.is_configured===true;
            const playersDone=players.length>0;
            const visualsDone=history.length>0;
            if(clubDone&&playersDone&&visualsDone)return null;
            const steps=[
              {done:clubDone,label:"Configurer mon club",icon:"🎨",onClick:()=>setNav("club")},
              {done:playersDone,label:"Ajouter mes "+T.playersLower,icon:"👥",onClick:()=>setNav("players")},
              {done:visualsDone,label:"Créer mon premier visuel",icon:"✨",onClick:()=>setNav("create")},
            ];
            return(
              <div style={{padding:"0 28px 24px"}}>
                <div style={{background:t.bg2,border:"1px solid "+rgba(t.accent,.25),borderRadius:12,padding:20}}>
                  <div data-section="premiers-pas" style={{fontSize:11,color:t.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>Premiers pas</div>
                  <div style={{fontSize:14,color:t.text,marginBottom:14}}>Bienvenue ! Configurez votre club en 3 étapes.</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
                    {steps.map((s,i)=>(
                      <button key={i} onClick={s.done?undefined:s.onClick} disabled={s.done}
                        style={{
                          background:s.done?rgba(t.accent,.08):t.bg3,
                          border:"1px solid "+(s.done?rgba(t.accent,.3):t.border),
                          borderRadius:9,padding:"12px 14px",textAlign:"left",
                          cursor:s.done?"default":"pointer",opacity:s.done?0.55:1,
                          color:t.text,fontSize:13,fontFamily:"inherit",
                          display:"flex",alignItems:"center",gap:10
                        }}>
                        <span style={{fontSize:16,flexShrink:0}}>{s.done?"✓":s.icon}</span>
                        <span style={{fontWeight:600,lineHeight:1.3}}>{(i+1)+". "+s.label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{textAlign:"center",marginTop:12}}>
                    <button onClick={()=>{lsSet("onboarding_skipped","1");setOnboardingSkipped(true);}}
                      style={{background:"none",border:"none",color:t.text3,fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0}}>
                      Passer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{padding:"0 28px",display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:12,marginBottom:28}}>{CT.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:12,padding:"20px 18px",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=rgba(club?.color1||"#e63329",.55);e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";}}><div style={{fontSize:26,marginBottom:8}}>{c.icon}</div><div style={{fontWeight:700,color:t.text,fontSize:13,marginBottom:3}}>{c.label}</div><div style={{fontSize:11,color:t.text3,lineHeight:1.4}}>{c.desc}</div></div>))}</div>
          <div style={{padding:"0 28px 28px",display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10}}>{[[history.length,"Visuels"],[players.length,T.players],[media.length,"Médias"],[LINEUP_TPLS.length+GROUP_TPLS.length+POST_TPLS.length,"Templates"]].map(([v,l])=>(<div key={l} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:10,padding:"14px 16px"}}><div style={{fontSize:22,fontWeight:700,color:t.accent,lineHeight:1}}>{v}</div><div style={{fontSize:11,color:t.text3,marginTop:4}}>{l}</div></div>))}</div>
        </div>)}
        {nav==="club"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>Mon Club</h2>
          <p style={{color:t.text3,marginBottom:24,fontSize:13}}>Appliqué automatiquement à tous vos visuels.</p>
          {teams.length>0&&(
          <div style={Object.assign({},card,{maxWidth:650,marginBottom:16})}>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:10,marginBottom:6}}>
              <div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>Équipes</div>
              <div style={{fontSize:11,color:teamQuotaReached?t.accent:t.text3,fontVariantNumeric:"tabular-nums"}}>{teams.length} / {maxTeams>=999?"illimité":maxTeams}</div>
            </div>
            <div style={{fontSize:12,color:t.text3,marginBottom:12,lineHeight:1.5}}>
              Chaque équipe a son propre {T.playersLower.replace(/s$/,"")} et ses propres visuels. Le logo, les couleurs et le sport restent communs au club.
            </div>
            {teams.map(tm=>{
              const on=tm.id===teamId;
              const nb=allPlayers.filter(p=>p.team_id===tm.id||(!p.team_id&&teams[0].id===tm.id)).length;
              return(
                <div key={tm.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,background:on?rgba(t.accent,.1):t.bg3,border:"1px solid "+(on?rgba(t.accent,.4):t.border),borderRadius:8,padding:"8px 10px"}}>
                  <button onClick={()=>setTeamId(tm.id)} title={on?"Équipe active":"Activer cette équipe"}
                    style={{width:16,height:16,flexShrink:0,borderRadius:"50%",border:"2px solid "+(on?t.accent:t.border2),background:on?t.accent:"transparent",cursor:on?"default":"pointer",padding:0}}/>
                  <input value={tm.name} onChange={e=>renameTeam(tm.id,e.target.value)}
                    style={{flex:1,minWidth:0,background:"transparent",border:"none",color:t.text,fontSize:13,fontWeight:on?600:400,outline:"none",fontFamily:"inherit"}}/>
                  <span style={{fontSize:11,color:t.text3,flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{nb}</span>
                  {teams.length>1&&<button onClick={()=>deleteTeam(tm.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:13,padding:"0 2px",flexShrink:0}}>✕</button>}
                </div>
              );
            })}
            {teamQuotaReached
              ? <div style={{fontSize:11,color:t.text3,marginTop:8,lineHeight:1.5}}>Votre offre est limitée à {maxTeams}&nbsp;{maxTeams>1?"équipes":"équipe"}. Passez à l'offre supérieure pour en ajouter.</div>
              : <button onClick={()=>{const n=window.prompt("Nom de la nouvelle équipe","Équipe "+(teams.length+1));if(n)addTeam(n);}}
                  style={{marginTop:6,background:rgba(t.accent,.14),color:t.accent,border:"1px solid "+rgba(t.accent,.35),borderRadius:7,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter une équipe</button>}
          </div>)}
          {/* Le sport est choisi une seule fois, à la première connexion, et
              n'est plus modifiable ensuite : il détermine les postes, les
              formations et les types de visuels, donc en changer laisserait
              derrière lui un effectif et des visuels incohérents. Affichage en
              lecture seule. Un administrateur peut le corriger en base si un
              club s'est trompé (voir la migration 0007). */}
          <div style={Object.assign({},card,{maxWidth:650,marginBottom:16})}>
            <div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Sport du club</div>
            {(()=>{
              const sp=SPORT_LIST.find(x=>x.id===sport);
              return(
                <div style={{display:"flex",alignItems:"center",gap:12,background:t.bg3,border:"1px solid "+t.border,borderRadius:9,padding:"12px 14px"}}>
                  <span style={{fontSize:26,lineHeight:1,flexShrink:0}}>{sp?sp.icon:"🏅"}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:t.text}}>{sp?sp.label:"Non défini"}</div>
                    <div style={{fontSize:11,color:t.text3,marginTop:2,lineHeight:1.45}}>
                      Défini à la création du club. Il fixe le vocabulaire, les postes, les formations et les types de visuels, et n'est plus modifiable ensuite. Écrivez-nous si vous devez le corriger.
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,maxWidth:650}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Identité</div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Nom du club</label><TIn v={club?.name||""} on={v=>updateClub({name:v,is_configured:true})} ph="FC Mon Club" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"14px 0 10px"}}><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Couleur principale</label><input type="color" value={club?.color1||"#e63329"} onChange={e=>updateClub({color1:e.target.value,is_configured:true})} style={{width:"100%",height:40,borderRadius:8,border:"1px solid "+t.border2,background:t.bg3,cursor:"pointer",padding:3}}/></div><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Couleur secondaire</label><input type="color" value={club?.color2||"#1a1a2e"} onChange={e=>updateClub({color2:e.target.value,is_configured:true})} style={{width:"100%",height:40,borderRadius:8,border:"1px solid "+t.border2,background:t.bg3,cursor:"pointer",padding:3}}/></div></div><div style={{height:24,borderRadius:8,background:"linear-gradient(90deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",marginBottom:4}}/><div style={{fontSize:10,color:t.text3,textAlign:"center"}}>Sauvegardé en temps réel ✓</div></div>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Logo du club</div><UpBtn val={club?.logo_url} on={v=>updateClub({logo_url:v,is_configured:true})} w={110} h={110} r={14} label="Cliquer pour uploader" t={t}/>{club?.logo_url&&<><div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}><div style={{width:36,height:36,borderRadius:7,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center"}}><img src={club.logo_url} style={{width:28,height:28,objectFit:"contain"}} alt=""/></div><div style={{fontSize:11,color:t.text2}}>Logo configuré ✓</div></div><button onClick={()=>updateClub({logo_url:null,is_configured:true})} style={{marginTop:8,fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer"}}>✕ Supprimer</button></>}</div>
          </div>
        </div>)}
        {nav==="players"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>{T.squadTitle}</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>{T.squadDesc}</p>
          <TeamBar teams={teams} teamId={teamId} onPick={setTeamId} t={t}/>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"275px 1fr",gap:18}}>
            <div>
              <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>{T.newPlayer}</div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Nom complet</label><TIn v={pName} on={setPName} ph="Prénom Nom" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0"}}><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>{T.numberLabel}</label><TIn v={pNum} on={v=>setPNum(v===""?"":String(Math.max(0,parseInt(v)||0)))} ph={T.numberPlaceholder} type="number" min={0} t={t}/></div><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>{T.positionLabel}</label><TSel v={pPos||getSport(sport).defaultPosition} on={setPPos} t={t} opts={positionsFor(sport)}/></div></div><button onClick={addPlayer} style={{background:t.accent,color:contrastText(t.accent),border:"none",borderRadius:8,padding:9,fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>{T.addToSquad}</button></div>
              {players.length>0&&<div style={Object.assign({},card,{marginTop:14})}><PhotoPanel players={players} selId={selPid} onSel={id=>{setSelPid(id||null);setSelPhoto(null);}} selUrl={selPhoto} onSelUrl={setSelPhoto} onAdd={addPhoto} onAddUrl={addPhotoUrl} onFav={toggleFav} onDelete={deletePhoto} t={t} terms={T}/></div>}
            </div>
            <div><div style={{fontSize:13,fontWeight:600,color:t.text2,marginBottom:12}}>{players.length+" "+T.playerLower+(players.length!==1?"s":"")+" · "+T.squad}</div>
              {players.length===0?<div style={Object.assign({},card,{padding:"40px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:32,marginBottom:10}}>👥</div><div>{T.emptySquad}</div></div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>{players.map(p=>{const fv=getPhoto(p);return(<div key={p.id} onClick={()=>{setSelPid(p.id);setSelPhoto(null);}} style={Object.assign({},card,{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12})}><Av photo={fv} name={p.name} size={44}/><div style={{flex:1}}><div style={{fontWeight:600,color:t.text,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:t.text3,marginTop:2}}>{p.position+" · #"+p.number+" · "+(p.photos||[]).length+" photo"+(p.photos&&p.photos.length!==1?"s":"")}</div></div><button onClick={e=>{e.stopPropagation();deletePlayer(p.id);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:16,padding:4}}>✕</button></div>);})}</div>)}
            </div>
          </div>
        </div>)}
        {nav==="media"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>Médiathèque</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>Fonds, stades et ambiances.</p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"220px 1fr",gap:18}}>
            <div style={card}><div onClick={()=>mRef.current.click()} style={{border:"2px dashed "+t.border2,borderRadius:10,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:t.bg3}} onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border2}><div style={{fontSize:28,marginBottom:8}}>🖼️</div><div style={{fontSize:13,color:t.text2,fontWeight:600}}>Uploader des images</div><div style={{fontSize:11,color:t.text3,marginTop:4}}>JPG, PNG · Multiple</div></div><input ref={mRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pickMedia}/></div>
            <div>{media.length===0?<div style={Object.assign({},card,{padding:"40px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:32,marginBottom:10}}>🖼️</div><div>Médiathèque vide</div></div>:(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{media.map(m=>(<div key={m.id} style={{borderRadius:11,overflow:"hidden",border:"1px solid "+t.border}}><div style={{aspectRatio:"16/9",overflow:"hidden"}}><img src={thumbOf(m)} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div><div style={{padding:"6px 10px",fontSize:11,color:t.text2,background:t.bg2,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80%"}}>{m.name||"Image"}</span><button onClick={()=>deleteMedia(m.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:14}}>✕</button></div></div>))}</div>)}</div>
          </div>
        </div>)}
        {nav==="create"&&(!selType?(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}><h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>Choisir un type</h2><p style={{color:t.text3,marginBottom:22,fontSize:13}}>Sélectionnez ce que vous souhaitez créer.</p><TeamBar teams={teams} teamId={teamId} onPick={setTeamId} t={t} label="Créer pour"/><div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:14,maxWidth:680}}>{CT.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:13,padding:"22px 18px",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=rgba(t.accent,.55);e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";}}>  <div style={{fontSize:28,marginBottom:10}}>{c.icon}</div><div style={{fontWeight:700,color:t.text,fontSize:14,marginBottom:4}}>{c.label}</div><div style={{fontSize:11,color:t.text3,lineHeight:1.5}}>{c.desc}</div></div>))}</div></div>):(selType==="lineup"||selType==="group")?renderSpecial():renderStandard())}
        {nav==="history"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>Historique</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>{history.length+" visuel"+(history.length!==1?"s":"")+" · Cloud ☁️"}</p>
          <TeamBar teams={teams} teamId={teamId} onPick={setTeamId} t={t}/>
          {history.length===0?<div style={Object.assign({},card,{padding:"60px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:36,marginBottom:12}}>📁</div><div style={{fontSize:14}}>Aucun visuel sauvegardé</div></div>:(<div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:14}}>{history.map(h=>(<div key={h.id} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:12,overflow:"hidden"}}><div style={{background:"#030306",display:"flex",alignItems:"center",justifyContent:"center",padding:10}}><WhenVisible minHeight={140}><HistoryThumb h={h} c1={club?.color1||"#e63329"} c2={club?.color2||"#1a1a2e"}/></WhenVisible></div><div style={{padding:"10px 12px",borderTop:"1px solid "+t.border}}><div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:6}}>{(h.ct&&h.ct.icon?h.ct.icon:"📄")+" "+(h.ct&&h.ct.label?h.ct.label:"Visuel")}</div><div style={{display:"flex",gap:6}}><button onClick={()=>{openCreate(h.type,h);setNav("create");}} style={{flex:1,background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}>↩ Modifier</button><button onClick={()=>deleteVisual(h.id)} style={{background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.25)",borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer"}}>✕</button></div></div></div>))}</div>)}
        </div>)}
        {nav==="settings"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,fontWeight:400,letterSpacing:".02em",lineHeight:1,marginBottom:6,color:t.text}}>Paramètres</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>Interface et données.</p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,maxWidth:650}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Thème</div>{[["dark","🌑 Sombre","Interface noire premium"],["light","☀️ Clair","Interface blanche minimaliste"],["club","🎨 Couleurs du club","Adapté à vos couleurs"]].map(([mode,label,desc])=>(<div key={mode} onClick={()=>updateClub({theme_mode:mode})} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:10,border:"2px solid "+((club?.theme_mode||"dark")===mode?t.accent:t.border),background:(club?.theme_mode||"dark")===mode?rgba(t.accent,.12):t.bg3,cursor:"pointer",marginBottom:8}}><div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+t.accent,background:(club?.theme_mode||"dark")===mode?t.accent:"transparent",flexShrink:0}}/><div><div style={{fontSize:13,fontWeight:600,color:t.text}}>{label}</div><div style={{fontSize:11,color:t.text3,marginTop:2}}>{desc}</div></div></div>))}</div>
            <div style={Object.assign({},card,{display:"flex",flexDirection:"column",gap:14})}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>Votre club</div><div style={{display:"flex",alignItems:"center",gap:12}}>{club?.logo_url?<img src={club.logo_url} style={{width:52,height:52,objectFit:"contain",borderRadius:8}} alt=""/>:<div style={{width:52,height:52,borderRadius:8,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:contrastText(mixC(club?.color1||"#e63329",club?.color2||"#1a1a2e",.5))}}>{(club?.name||"?")[0].toUpperCase()}</div>}<div><div style={{fontSize:16,fontWeight:700,color:t.text}}>{club?.name||"Club non configuré"}</div><div style={{fontSize:12,color:t.text3,marginTop:3}}>{session.user.email}</div><div style={{fontSize:12,color:t.text3}}>{players.length+" "+T.playersLower+" · "+media.length+" médias · "+history.length+" visuels"}</div></div></div><button onClick={()=>setNav("club")} style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:9,padding:"9px 16px",color:t.text2,cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left"}}>Modifier les infos du club →</button><button onClick={signOut} style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9,padding:"9px 16px",color:"#fca5a5",cursor:"pointer",fontSize:12,textAlign:"left"}}>Se déconnecter</button></div>
          </div>
          <div style={{marginTop:28,paddingTop:18,borderTop:"1px solid "+t.border,maxWidth:650}}>
            <a href="/#cgu" target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:t.text3,textDecoration:"underline",letterSpacing:".02em"}}>Conditions générales d'utilisation</a>
          </div>
        </div>)}
      </div>
      {isMobile&&!(nav==="create"&&selType)&&(()=>{
        // Mobile nav : on garde 6 onglets (Médias retiré, faute de place). Historique réintégré.
        const MOBILE_LABELS={home:"Accueil",club:"Club",players:T.players,create:"Créer",history:"Visuels",settings:"Réglages"};
        const mobileNav=NAVL.filter(n=>n.id!=="media").map(n=>({...n,label:MOBILE_LABELS[n.id]||n.label}));
        return(
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:t.bg2,borderTop:"1px solid "+t.border,display:"flex",alignItems:"stretch",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0)"}}>
          {mobileNav.map(n=>{
            const isCreate=n.id==="create";
            const active=nav===n.id;
            return(
              <button key={n.id} onClick={()=>{setNav(n.id);if(n.id!=="create")setSelType(null);}}
                style={{flex:isCreate?1.25:1,minWidth:0,background:isCreate?(active?t.accent:rgba(t.accent,.18)):"none",border:"none",padding:"4px 2px",color:isCreate?(active?contrastText(t.accent):t.accent):(active?t.accent:t.text2),cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,fontWeight:active?700:500,position:"relative",margin:isCreate?"4px":0,borderRadius:isCreate?12:0,transition:"all .15s",overflow:"hidden"}}>
                <span style={{fontSize:isCreate?18:16,lineHeight:1}}>{n.icon}</span>
                <span style={{fontSize:isCreate?9:8,letterSpacing:isCreate?".04em":0,textTransform:isCreate?"uppercase":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{n.label}</span>
                {n.id==="history"&&history.length>0&&<span style={{position:"absolute",top:3,right:"15%",background:t.accent,color:contrastText(t.accent),fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:7,minWidth:12,textAlign:"center",lineHeight:1.2}}>{history.length}</span>}
              </button>
            );
          })}
        </div>);
      })()}
      {exportOverlay&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
          <div style={{fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:14}}>Visuel prêt</div>
          <img src={exportOverlay.previewUrl} alt="Aperçu" style={{maxWidth:"min(420px,86vw)",maxHeight:"55vh",borderRadius:8,boxShadow:"0 20px 50px rgba(0,0,0,.6)",marginBottom:24}}/>
          <p style={{fontSize:13,color:"rgba(255,255,255,.7)",textAlign:"center",maxWidth:340,marginBottom:18,lineHeight:1.5}}>Appuyez sur « Enregistrer » puis « Enregistrer dans Photos » pour le sauvegarder sur votre appareil.</p>
          <button onClick={handleOverlayShare} style={{background:"#fff",color:"#000",border:"none",borderRadius:2,padding:"15px 38px",fontSize:12,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit",minHeight:48,marginBottom:12}}>Enregistrer dans les photos</button>
          <button onClick={closeExportOverlay} style={{background:"none",color:"rgba(255,255,255,.5)",border:"none",fontSize:11,cursor:"pointer",padding:10,fontFamily:"inherit",letterSpacing:".06em",textTransform:"uppercase"}}>Annuler</button>
        </div>
      )}
    </div>);
}
