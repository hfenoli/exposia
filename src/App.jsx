import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import html2canvas from "html2canvas";
import { supabase } from "./supabase";
// ─── CONSTANTS ────────────────────────────────────────────────
const POSITIONS = ["Attaquant","Milieu","Défenseur","Gardien"];
const FONTS = ["Impact","Arial Black","Georgia","Helvetica Neue","Courier New","Montserrat"];
const FORMATIONS = {
  "4-4-2": [{n:1},{n:4},{n:4},{n:2}],
  "4-3-3": [{n:1},{n:4},{n:3},{n:3}],
  "4-2-3-1":[{n:1},{n:4},{n:2},{n:3},{n:1}],
  "3-5-2": [{n:1},{n:3},{n:5},{n:2}],
  "5-3-2": [{n:1},{n:5},{n:3},{n:2}],
  "3-4-3": [{n:1},{n:3},{n:4},{n:3}],
};
const CTYPES = [
  {id:"goal",   icon:"⚽", label:"But",             desc:"Célébration d'un but"},
  {id:"result", icon:"🏁", label:"Score Final",      desc:"Résultat du match"},
  {id:"match",  icon:"📅", label:"Affiche Match",    desc:"Avant-match"},
  {id:"group",  icon:"📋", label:"Groupe",           desc:"Convocation officielle"},
  {id:"lineup", icon:"🎽", label:"Composition XI",   desc:"11 de départ"},
  {id:"recruit",icon:"⭐", label:"Nouvelle Recrue",  desc:"Arrivée d'un joueur"},
  {id:"post",   icon:"📢", label:"Poste / Annonce",  desc:"Publication libre"},
];
const NAV = [
  {id:"home",    icon:"🏠", label:"Accueil"},
  {id:"club",    icon:"🏟️", label:"Mon Club"},
  {id:"players", icon:"👥", label:"Joueurs"},
  {id:"media",   icon:"🖼️", label:"Médias"},
  {id:"create",  icon:"✨", label:"Créer"},
  {id:"history", icon:"📁", label:"Historique"},
  {id:"settings",icon:"⚙️", label:"Paramètres"},
];
const LINEUP_TPLS = [
  {id:"ln1",label:"Noir Absolu",  cat:"Sombre"},
  {id:"ln2",label:"Feu & Braise", cat:"Sombre"},
  {id:"ln3",label:"Minuit Doré",  cat:"Sombre"},
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
function makeLayers(type,c1,c2){
  function L(id,z,tp,x,y,w,h,label,extra){
    return Object.assign({id,z,type:tp,x,y,w,h,locked:false,label},extra||{});
  }
  const sets = {
    goal:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:70}),
      L("wm",2,"watertext",-5,18,110,32,"Filigrane",Object.assign({},TD,{text:"BUT",fontSize:120,color:c1,opacity:12})),
      L("pl",3,"photo",5,5,90,72,"Photo joueur"),
      L("lg",4,"logo",4,4,13,13,"Logo club"),
      L("st",5,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("bt",6,"text",4,73,92,14,"Texte BUT",Object.assign({},TD,{text:"BUT !",fontSize:58,color:"#ffffff",bold:true})),
      L("nm",7,"text",4,86,92,8,"Nom joueur",Object.assign({},TD,{text:"Prénom Nom",fontSize:22,color:c2})),
      L("sc",8,"scoreblock",18,92,64,7,"Score",{font:"Impact",color:c1,scoreHome:"1",scoreAway:"0"}),
    ],
    result:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:65}),
      L("pl",2,"photo",5,5,90,62,"Photo joueur"),
      L("lg",3,"logo",4,4,12,12,"Logo club"),
      L("lg2",4,"logo2",84,4,12,12,"Logo adversaire"),
      L("st",5,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("lb",6,"text",10,5,75,7,"Étiquette",Object.assign({},TD,{text:"SCORE FINAL",fontSize:18,color:"rgba(255,255,255,0.8)",italic:true})),
      L("rl",7,"resultlabel",8,66,84,6,"Résultat auto",{scoreHome:"0",scoreAway:"0"}),
      L("sb",8,"scorebig",4,71,92,17,"Score",{font:"Impact",color:"#ffffff",scoreHome:"2",scoreAway:"0",fontSize:44}),
      L("op",9,"text",8,88,84,6,"Adversaire",Object.assign({},TD,{text:"vs Adversaire",fontSize:14,color:"rgba(255,255,255,0.4)"})),
    ],
    match:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:58}),
      L("st",2,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("cp",3,"text",8,6,84,6,"Compétition",Object.assign({},TD,{text:"LIGUE 1",fontSize:11,color:"rgba(255,255,255,0.4)"})),
      L("cn",4,"text",4,22,92,16,"Mon club",Object.assign({},TD,{text:"MON CLUB",fontSize:40,color:"#ffffff",bold:true})),
      L("vs",5,"text",26,38,48,10,"VS",Object.assign({},TD,{text:"vs",fontSize:26,color:"rgba(255,255,255,0.35)",italic:true})),
      L("op",6,"text",4,47,92,13,"Adversaire",Object.assign({},TD,{text:"Adversaire",fontSize:32,color:"#ffffff",bold:true,italic:true})),
      L("lg",7,"logo",3,62,14,14,"Logo club"),
      L("lg2",8,"logo2",83,62,14,14,"Logo adversaire"),
      L("dt",9,"text",4,78,92,7,"Date",Object.assign({},TD,{text:"Samedi 12 Avril · 21h00",fontSize:14,color:"rgba(255,255,255,0.6)"})),
      L("vn",10,"text",4,85,92,6,"Stade",Object.assign({},TD,{text:"Nom du stade",fontSize:12,color:"rgba(255,255,255,0.28)"})),
    ],
    recruit:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:52}),
      L("st",2,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("pl",3,"photo",5,4,90,66,"Photo joueur"),
      L("lg",4,"logo",4,4,12,12,"Logo club"),
      L("tg",5,"text",6,72,88,6,"Étiquette",Object.assign({},TD,{text:"NOUVELLE RECRUE",fontSize:11,color:c1,bold:true,letterSpacing:4})),
      L("nm",6,"text",6,78,88,13,"Nom joueur",Object.assign({},TD,{text:"Prénom Nom",fontSize:32,color:"#ffffff",bold:true})),
      L("ps",7,"text",6,90,88,7,"Poste",Object.assign({},TD,{text:"Attaquant · #9",fontSize:14,color:c2})),
    ],
    post:[
      L("bg",0,"bg",0,0,100,100,"Fond",{locked:true}),
      L("ov",1,"overlay",0,0,100,100,"Assombrissement",{locked:true,opacity:40}),
      L("lg",2,"logo",4,4,13,13,"Logo club"),
      L("st",3,"stripe",0,0,100,1.5,"Bande",{color:c1,color2:c2}),
      L("h1",4,"text",4,28,92,18,"Titre principal",Object.assign({},TD,{text:"TITRE DE L'ANNONCE",fontSize:38,color:"#ffffff",bold:true,upper:true,letterSpacing:2})),
      L("h2",5,"text",4,48,92,10,"Sous-titre",Object.assign({},TD,{text:"Sous-titre ou description",fontSize:18,color:c1})),
      L("h3",6,"text",4,60,92,8,"Corps de texte",Object.assign({},TD,{text:"Texte complémentaire ici",fontSize:14,color:"rgba(255,255,255,0.65)"})),
      L("dv",7,"stripe",35,45,30,0.6,"Séparateur",{color:c1,color2:c2}),
      L("dt",8,"text",4,88,92,6,"Date / Hashtag",Object.assign({},TD,{text:"#monclub · 12 avril 2025",fontSize:11,color:"rgba(255,255,255,0.35)"})),
    ],
  };
  return JSON.parse(JSON.stringify(sets[type]||sets.goal));
}
// ─── CURVED TEXT ──────────────────────────────────────────────
function CurvedText({lay,containerW}){
  if(!lay.text) return null;
  const txt = lay.upper ? lay.text.toUpperCase() : lay.text;
  const curve = lay.curve||0;
  if(curve===0) return null;
  const fontSize = lay.fontSize||20;
  const font = (lay.font||"Impact")+",sans-serif";
  const color = lay.color||"#fff";
  const lsp = lay.letterSpacing||0;
  const W = containerW||270;
  const cx = W/2;
  const r = Math.max(W*0.35, W*180/(Math.abs(curve)*2));
  const isUp = curve>0;
  const cy = isUp ? r*0.9 : -r*0.9+fontSize*1.4;
  const halfAngle = (Math.abs(curve)*Math.PI/180)/2;
  const x1 = cx + r*Math.sin(-halfAngle);
  const y1 = cy - r*Math.cos(-halfAngle);
  const x2 = cx + r*Math.sin(halfAngle);
  const y2 = cy - r*Math.cos(halfAngle);
  const large = Math.abs(curve)>180?1:0;
  const sweep = isUp?1:0;
  const pid = "arc_"+lay.id;
  const svgH = Math.abs(cy)+r+fontSize*2;
  return(
    <svg width={W} height={svgH} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",overflow:"visible",pointerEvents:"none"}}>
      <defs><path id={pid} d={"M "+x1+" "+y1+" A "+r+" "+r+" 0 "+large+" "+sweep+" "+x2+" "+y2}/></defs>
      <text fontFamily={font} fontSize={fontSize} fontWeight={lay.bold?"900":"400"} fontStyle={lay.italic?"italic":"normal"} fill={color} letterSpacing={lsp}>
        <textPath href={"#"+pid} startOffset="50%" textAnchor="middle">{txt}</textPath>
      </text>
    </svg>
  );
}
// ─── LAYER RENDERER ───────────────────────────────────────────
function renderLayerContent(lay, bgUrl, playerUrl, logoUrl, logo2Url, accent, accent2){
  const isTextType = ["text","watertext","heading","subtext"].includes(lay.type);
  if(lay.type==="bg") return(<div style={{width:"100%",height:"100%",overflow:"hidden"}}>{bgUrl?<img src={bgUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(160deg,#0a0a1a,#1a0a2e)"}}/>}</div>);
  if(lay.type==="overlay") return(<div style={{width:"100%",height:"100%",background:"linear-gradient(to bottom,rgba(0,0,0,"+((lay.opacity||60)/200)+"),rgba(0,0,0,"+((lay.opacity||60)/100)+")"}}/>);
  if(lay.type==="stripe") return(<div style={{width:"100%",height:"100%",background:"linear-gradient(90deg,"+(lay.color||accent)+","+(lay.color2||accent2)+")"}}/>);
  if(lay.type==="photo") return(<div style={{width:"100%",height:"100%",overflow:"hidden"}}>{playerUrl?<img src={playerUrl} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>👤</div>}</div>);
  if(lay.type==="logo") return(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>{logoUrl?<img src={logoUrl} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:<div style={{width:"100%",height:"100%",background:rgba(accent,.2),borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:accent}}>LOGO</div>}</div>);
  if(lay.type==="logo2") return(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>{logo2Url?<img src={logo2Url} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:<div style={{width:"100%",height:"100%",background:"rgba(255,255,255,.07)",borderRadius:4,border:"1px solid rgba(255,255,255,.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,.3)"}}>ADV</div>}</div>);
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
    return(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"5%"}}><span style={{fontSize:fs,fontWeight:900,color:lay.color||"#fff",fontFamily:(lay.font||"Impact")+",sans-serif"}}>{lay.scoreHome||"0"}</span><span style={{fontSize:fs*.5,color:"rgba(255,255,255,.3)",fontFamily:"Impact,sans-serif"}}>-</span><span style={{fontSize:fs,fontWeight:900,color:lay.color||"#fff",fontFamily:(lay.font||"Impact")+",sans-serif"}}>{lay.scoreAway||"0"}</span></div>);
  }
  if(lay.type==="resultlabel"){
    const sh=parseInt(lay.scoreHome||"0"), sa=parseInt(lay.scoreAway||"0");
    const lbl=sh>sa?"VICTOIRE":sh===sa?"MATCH NUL":"DÉFAITE";
    const lc=sh>sa?"#22c55e":sh===sa?"#f59e0b":"#ef4444";
    return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:11,fontWeight:700,color:lc,letterSpacing:".16em"}}>{lbl}</span></div>;
  }
  return null;
}
function LayerView({lay,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,isSel,onMD}){
  const s={position:"absolute",left:lay.x+"%",top:lay.y+"%",width:lay.w+"%",height:lay.h+"%",cursor:lay.locked?"default":"grab",boxSizing:"border-box",outline:isSel&&!lay.locked?"2px solid "+accent:"none",outlineOffset:1,zIndex:lay.z};
  return(<div style={s} onMouseDown={lay.locked?undefined:e=>onMD(e,lay.id)}>{renderLayerContent(lay,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2)}</div>);
}
// ─── LINEUP CANVAS ────────────────────────────────────────────
function LineupCanvas({ld,tpl,logoUrl,logo2Url,accent,accent2,bgUrl,W,H,slotScale}){
  W=W||270; H=H||480; slotScale=slotScale||1;
  const fm=ld&&ld.formation?ld.formation:"4-4-2";
  const starters=ld&&ld.starters?ld.starters:[];
  const subs=ld&&ld.subs?ld.subs.filter(Boolean):[];
  const opponent=ld&&ld.opponent?ld.opponent:"Adversaire";
  const competition=ld&&ld.competition?ld.competition:"";
  const fRows=FORMATIONS[fm]||FORMATIONS["4-4-2"];
  let li=0;
  const rows=fRows.map(function(r,ri){const lbls=["GB","DEF","MIL","ATT"];const players=starters.slice(li,li+r.n);li+=r.n;return{n:r.n,label:lbls[Math.min(ri,3)],players:players};});
  const dark=tpl!=="ln5"&&tpl!=="ln6";
  const root={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<160?6:14,flexShrink:0,display:"flex",flexDirection:"column",userSelect:"none"};
  function Logo(props){const sz=props.sz||W*.1;if(!props.url)return<div style={{width:sz,height:sz,borderRadius:4,background:rgba(accent,.25),display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontSize:sz*.3}}>◈</div>;return<img src={props.url} style={{width:sz,height:sz,objectFit:"contain"}} alt=""/>;}
  function Slot(props){const p=props.p;const sz=props.sz||W*.09;const square=props.square;const ph=getPhoto(p);return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:sz*1.3}}><div style={{width:sz,height:sz,borderRadius:square?6:"50%",overflow:"hidden",border:"2px solid "+accent,background:dark?"rgba(0,0,0,.5)":"#e0e0e8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:sz*.34,fontWeight:900,color:accent,fontFamily:"Impact,sans-serif"}}>{p&&p.number?p.number:"?"}</span>}</div><span style={{fontSize:W*.024,color:dark?"#fff":"#111",fontWeight:700,textAlign:"center",maxWidth:sz*1.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:dark?"0 1px 5px #000":"none"}}>{p&&p.name?p.name.split(" ").pop():"—"}</span></div>);}
  const bg={ln1:"#030305",ln2:"#0a0000",ln3:"#02040a",ln4:"#060408",ln5:"#f2f2f4",ln6:"#fafafa"}[tpl]||"#030305";
  return(<div style={Object.assign({},root,{background:bg})}>
    {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:dark?.14:.06}} alt=""/>}
    {dark&&<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.88),rgba(0,0,0,.55),rgba(0,0,0,.82))"}}/>}
    {tpl==="ln2"&&<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 100%,"+rgba(accent,.5)+" 0%,transparent 65%)"}}/>}
    {tpl==="ln4"&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.06}} viewBox="0 0 270 480"><polygon points="0,0 200,0 0,240" fill={rgba(accent,.2)}/><polygon points="270,480 70,480 270,240" fill={rgba(accent2,.2)}/></svg>}
    {(tpl==="ln1"||tpl==="ln3")&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.1}} viewBox="0 0 270 480"><rect x="18" y="6" width="234" height="375" rx="3" fill="none" stroke={accent} strokeWidth="1"/><line x1="18" y1="193" x2="252" y2="193" stroke={accent} strokeWidth=".8"/><ellipse cx="135" cy="193" rx="36" ry="36" fill="none" stroke={accent} strokeWidth=".8"/></svg>}
    {tpl==="ln6"&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:"linear-gradient(to bottom,"+accent+","+accent2+")",zIndex:3}}/>}
    {tpl==="ln5"&&<div style={{position:"absolute",top:0,left:0,right:0,height:"27%",background:"linear-gradient(135deg,"+accent+","+accent2+")",zIndex:1}}/>}
    {dark&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+accent+","+accent2+","+accent+",transparent)",zIndex:4}}/>}
    <div style={{position:"relative",zIndex:3,padding:(W*.03)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Logo url={logoUrl} sz={W*.09}/>
      <div style={{textAlign:"center"}}>{competition&&<div style={{fontSize:W*.022,color:dark?rgba(accent,.7):"#666",letterSpacing:".13em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.03,fontWeight:700,color:dark?"#fff":"#111",fontFamily:"Impact,sans-serif",letterSpacing:".05em"}}>XI · {fm}</div></div>
      <Logo url={logo2Url} sz={W*.08}/>
    </div>
    <div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:"0 "+(W*.018)+"px"}}>
      {[].concat(rows).reverse().map(function(row,ri){return(<div key={ri} style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>{Array.from({length:row.n}).map(function(_,pi){return<Slot key={pi} p={row.players[pi]} sz={W*.088*slotScale} square={tpl==="ln4"}/>})}</div>);})}
    </div>
    {subs.length>0&&<div style={{position:"relative",zIndex:3,borderTop:"1px solid "+rgba(accent,.3),background:rgba(dark?"#000":"#f0f0f0",.55),padding:(W*.012)+"px "+(W*.035)+"px"}}><div style={{fontSize:W*.02,color:rgba(dark?"#fff":"#000",.38),letterSpacing:".1em",marginBottom:2}}>REMPLAÇANTS</div><div style={{display:"flex",gap:W*.016,flexWrap:"wrap",alignItems:"center"}}>{subs.map(function(s,i){const ph=getPhoto(s);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.009}}>{ph?<img src={ph} style={{width:W*.046,height:W*.046,borderRadius:"50%",objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(accent,.4)}} alt=""/>:<div style={{width:W*.046,height:W*.046,borderRadius:"50%",background:rgba(accent,.2),display:"flex",alignItems:"center",justifyContent:"center",fontSize:W*.018,color:accent}}>{s.number||"?"}</div>}<span style={{fontSize:W*.023,color:rgba(dark?"#fff":"#000",.5)}}>{s.name?s.name.split(" ").pop():""}</span></div>);})}</div></div>}
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
  const root={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<160?6:14,flexShrink:0,display:"flex",flexDirection:"column",userSelect:"none"};
  function Logo(props){const sz=props.sz||W*.1;if(!props.url)return<div style={{width:sz,height:sz,borderRadius:4,background:rgba(accent,.25),display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontSize:sz*.3}}>◈</div>;return<img src={props.url} style={{width:sz,height:sz,objectFit:"contain"}} alt=""/>;}
  function PlayerRow(props){const p=props.p;const col=props.col||accent;const ph=p.photo||getPhoto(p);return(<div style={{display:"flex",alignItems:"center",gap:W*.018,marginBottom:W*.009,padding:(W*.005)+"px",borderRadius:3,background:rgba("#fff",.025)}}>{ph?<img src={ph} style={{width:W*.074,height:W*.074,borderRadius:W*.009,objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(col,.3)}} alt=""/>:<div style={{width:W*.074,height:W*.074,borderRadius:W*.009,background:rgba(col,.13),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:W*.026,fontWeight:900,color:col}}>{p.number||"?"}</div>}<span style={{flex:1,color:"rgba(255,255,255,.82)",fontSize:W*.032}}>{p.name||"—"}{p.captain&&<span style={{color:col,fontSize:W*.024,marginLeft:W*.009}}> ©</span>}</span>{p.number&&<span style={{fontSize:W*.028,color:rgba("#fff",.16),fontFamily:"Impact,sans-serif"}}>#{p.number}</span>}</div>);}
  if(tpl==="gr3"){const allP=[].concat(gk,def,mid,fwd).slice(0,16);return(<div style={Object.assign({},root,{background:"#fff"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.05}} alt=""/>}<div style={{position:"relative",zIndex:2,background:"linear-gradient(135deg,"+accent+","+accent2+")",padding:(W*.028)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo url={logoUrl} sz={W*.09}/><div style={{textAlign:"center"}}>{competition&&<div style={{fontSize:W*.022,color:"rgba(255,255,255,.76)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.052,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",letterSpacing:".05em"}}>{title}</div></div><Logo url={logo2Url} sz={W*.08}/></div><div style={{position:"relative",zIndex:2,flex:1,padding:(W*.018)+"px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:W*.012,alignContent:"start",overflowY:"auto"}}>{allP.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:W*.18,height:W*.22,borderRadius:W*.016,overflow:"hidden",border:"2px solid "+rgba(accent,.25),background:"#eee",display:"flex",alignItems:"center",justifyContent:"center"}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<div style={{fontSize:W*.05,color:"#ccc"}}>👤</div>}</div><span style={{fontSize:W*.024,fontWeight:700,color:"#111",textAlign:"center",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</span>{p.number&&<span style={{fontSize:W*.019,color:accent,fontWeight:700}}>#{p.number}</span>}</div>);})}</div></div>);}
  if(tpl==="gr4"){const left=[].concat(gk,def),right=[].concat(mid,fwd);return(<div style={Object.assign({},root,{background:"#f5f5f7"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.06}} alt=""/>}<div style={{position:"relative",zIndex:2,background:"linear-gradient(90deg,"+accent+","+accent2+")",padding:(W*.025)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo url={logoUrl} sz={W*.085}/><div style={{textAlign:"center"}}>{competition&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.76)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.04,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif"}}>{title}</div></div><Logo url={logo2Url} sz={W*.07}/></div><div style={{position:"relative",zIndex:2,flex:1,display:"grid",gridTemplateColumns:"1fr 1px 1fr",overflowY:"auto"}}><div style={{padding:(W*.016)+"px "+(W*.018)+"px"}}><div style={{fontSize:W*.019,color:accent,fontWeight:700,letterSpacing:".1em",marginBottom:W*.012}}>GK · DEF</div>{left.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.012,marginBottom:W*.012,paddingBottom:W*.012,borderBottom:"1px solid rgba(0,0,0,.05)"}}><div style={{width:W*.078,height:W*.078,borderRadius:"50%",overflow:"hidden",border:"2px solid "+rgba(accent,.28),background:"#ddd",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.026,fontWeight:900,color:accent,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{p.number||""}</span>}</div><div><div style={{fontSize:W*.028,fontWeight:700,color:"#111",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</div>{p.number&&<div style={{fontSize:W*.018,color:accent}}>#{p.number}</div>}</div></div>);})}</div><div style={{background:"rgba(0,0,0,.08)"}}/><div style={{padding:(W*.016)+"px "+(W*.018)+"px"}}><div style={{fontSize:W*.019,color:accent2,fontWeight:700,letterSpacing:".1em",marginBottom:W*.012}}>MIL · ATT</div>{right.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.012,marginBottom:W*.012,paddingBottom:W*.012,borderBottom:"1px solid rgba(0,0,0,.05)"}}><div style={{width:W*.078,height:W*.078,borderRadius:"50%",overflow:"hidden",border:"2px solid "+rgba(accent2,.28),background:"#ddd",flexShrink:0}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.026,fontWeight:900,color:accent2,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{p.number||""}</span>}</div><div><div style={{fontSize:W*.028,fontWeight:700,color:"#111",maxWidth:W*.19,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name?p.name.split(" ").pop():"—"}</div>{p.number&&<div style={{fontSize:W*.018,color:accent2}}>#{p.number}</div>}</div></div>);})}</div></div></div>);}
  if(tpl==="gr5"){const cats=[{l:"GARDIENS",list:gk,c:accent},{l:"DÉFENSEURS",list:def,c:accent2},{l:"MILIEUX",list:mid,c:accent},{l:"ATTAQUANTS",list:fwd,c:accent2}];if(coaches.length)cats.push({l:"STAFF",list:coaches,c:"rgba(255,255,255,.5)"});return(<div style={Object.assign({},root,{background:"#f8f9fa"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.06}} alt=""/>}<div style={{position:"relative",zIndex:2,padding:(W*.03)+"px "+(W*.04)+"px",background:"#fff",borderBottom:"1px solid #e8e8e8",display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:W*.025}}><Logo url={logoUrl} sz={W*.1}/><div><div style={{fontSize:W*.048,fontWeight:900,color:"#111",fontFamily:"Impact,sans-serif",letterSpacing:".04em"}}>{title}</div>{competition&&<div style={{fontSize:W*.019,color:"#888",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}</div></div><Logo url={logo2Url} sz={W*.082}/></div><div style={{height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")"}}/>  <div style={{position:"relative",zIndex:2,flex:1,overflowY:"auto",padding:(W*.022)+"px "+(W*.03)+"px"}}>{cats.map(function(cat,ci){if(!cat.list.length)return null;return(<div key={ci} style={{marginBottom:W*.018}}><div style={{display:"flex",alignItems:"center",gap:W*.014,marginBottom:W*.012}}><div style={{width:3,height:W*.03,borderRadius:2,background:cat.c}}/><span style={{fontSize:W*.022,color:cat.c,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>{cat.l}</span><span style={{fontSize:W*.019,color:"#bbb",marginLeft:"auto"}}>{cat.list.length}</span></div>{cat.list.map(function(p,i){const ph=p.photo||getPhoto(p);return(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.018,background:"#fff",borderRadius:W*.016,padding:(W*.01)+"px "+(W*.018)+"px",border:"1px solid #f0f0f0",marginBottom:W*.007}}>{ph?<img src={ph} style={{width:W*.072,height:W*.072,borderRadius:W*.012,objectFit:"cover",objectPosition:"top",border:"1px solid "+rgba(cat.c,.3)}} alt=""/>:<div style={{width:W*.072,height:W*.072,borderRadius:W*.012,background:rgba(cat.c,.12),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:W*.026,fontWeight:900,color:cat.c}}>{p.number||"?"}</div>}<span style={{flex:1,fontSize:W*.032,color:"#111",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name||"—"}{p.captain&&<span style={{color:cat.c,fontSize:W*.022,marginLeft:W*.009}}>©</span>}</span>{p.number&&<span style={{fontSize:W*.028,fontWeight:700,color:cat.c,fontFamily:"Impact,sans-serif"}}>#{p.number}</span>}</div>);})}</div>);})}</div></div>);}
  const isNeon=tpl==="gr6";
  const cats2=[{l:"GARDIENS",list:gk,c:isNeon?"#00ffaa":accent},{l:"DÉFENSEURS",list:def,c:isNeon?"#4488ff":accent2},{l:"MILIEUX",list:mid,c:isNeon?"#ff4499":accent},{l:"ATTAQUANTS",list:fwd,c:isNeon?"#ffcc00":accent2}];
  if(coaches.length)cats2.push({l:"STAFF / COACHS",list:coaches,c:"rgba(255,255,255,.45)"});
  const bg2={gr1:"#020208",gr2:"#02020a",gr6:"#04040c"}[tpl]||"#020208";
  return(<div style={Object.assign({},root,{background:bg2})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.12}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,"+rgba(accent,.11)+",transparent 50%,"+rgba(accent2,.08)+")"}}/>  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/><div style={{position:"relative",zIndex:3,padding:(W*.03)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo url={logoUrl} sz={W*.105}/><div style={{textAlign:"right"}}>{competition&&<div style={{fontSize:W*.019,color:rgba("#fff",.32),letterSpacing:".12em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.054,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",letterSpacing:".05em",textShadow:isNeon?"0 0 20px "+rgba(accent,.5):"none"}}>{title}</div></div></div><div style={{position:"relative",zIndex:3,flex:1,overflowY:"auto",padding:(W*.005)+"px "+(W*.04)+"px "+(W*.018)+"px"}}>{cats2.map(function(cat,ci){if(!cat.list.length)return null;return(<div key={ci} style={{marginBottom:W*.018}}><div style={{display:"flex",alignItems:"center",gap:W*.014,marginBottom:W*.008}}><div style={{width:W*.04,height:1,background:cat.c}}/><span style={{fontSize:W*.022,color:cat.c,fontWeight:700,letterSpacing:".12em"}}>{cat.l} ({cat.list.length})</span><div style={{flex:1,height:1,background:rgba(cat.c,.2)}}/></div>{cat.list.map(function(p,i){return<PlayerRow key={i} p={p} col={cat.c}/>;})}</div>);})}</div></div>);
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
  if(tpl==="pt2")return(<div style={Object.assign({},root,{background:"#06060e"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,"+rgba(accent,.12)+",transparent 50%,"+rgba(accent2,.08)+")"}}/>  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.1}/>{date&&<div style={{fontSize:W*.022,color:"rgba(255,255,255,.3)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:(W*.05)+"px"}}><div style={{fontSize:W*.022,color:accent,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",marginBottom:W*.02}}>{subtitle}</div><div style={{fontSize:W*.06,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,textTransform:"uppercase",marginBottom:W*.025}}>{title}</div><div style={{width:W*.08,height:2,background:accent,marginBottom:W*.025,borderRadius:2}}/><div style={{fontSize:W*.028,color:"rgba(255,255,255,.58)",lineHeight:1.5}}>{body}</div>{hashtag&&<div style={{marginTop:W*.04,fontSize:W*.022,color:rgba(accent,.6)}}>{hashtag}</div>}</div></div>);
  if(tpl==="pt3")return(<div style={Object.assign({},root,{background:"#0a0000"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.2}} alt=""/>}<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,"+rgba(accent,.4)+" 0%,rgba(0,0,0,.9) 60%)"}}/><div style={{position:"relative",zIndex:3,background:"rgba(0,0,0,.7)",padding:(W*.022)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",gap:W*.02}}><div style={{background:accent,borderRadius:3,padding:(W*.008)+"px "+(W*.018)+"px",fontSize:W*.024,fontWeight:900,color:"#fff",letterSpacing:".08em"}}>BREAKING</div><div style={{flex:1,height:1,background:rgba(accent,.3)}}/><Logo sz={W*.07}/></div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.05)+"px",gap:W*.03}}><div style={{fontSize:W*.019,color:rgba(accent,.8),fontWeight:700,letterSpacing:".16em",textTransform:"uppercase"}}>{subtitle}</div><div style={{fontSize:W*.056,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,textTransform:"uppercase"}}>{title}</div><div style={{width:"100%",height:1,background:rgba(accent,.25)}}/><div style={{fontSize:W*.03,color:"rgba(255,255,255,.62)",lineHeight:1.5}}>{body}</div></div>{(date||hashtag)&&<div style={{position:"relative",zIndex:3,background:"rgba(0,0,0,.7)",padding:(W*.022)+"px "+(W*.04)+"px",display:"flex",justifyContent:"space-between",fontSize:W*.022,color:"rgba(255,255,255,.3)"}}><span>{date}</span><span>{hashtag}</span></div>}</div>);
  if(tpl==="pt4")return(<div style={Object.assign({},root,{background:"#f8f9fa"})}><div style={{position:"absolute",left:0,top:0,bottom:0,width:5,background:"linear-gradient(to bottom,"+accent+","+accent2+")",zIndex:3}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.05)+"px "+(W*.03)+"px "+(W*.065)+"px",borderBottom:"1px solid rgba(0,0,0,.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(0,0,0,.3)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.05)+"px "+(W*.05)+"px "+(W*.05)+"px "+(W*.065)+"px"}}><div style={{fontSize:W*.022,color:accent,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:W*.02}}>{subtitle}</div><div style={{fontSize:W*.052,fontWeight:900,color:"#111",fontFamily:"Impact,sans-serif",lineHeight:1.08,letterSpacing:".01em",marginBottom:W*.025}}>{title}</div><div style={{width:W*.06,height:3,background:accent,marginBottom:W*.025,borderRadius:2}}/><div style={{fontSize:W*.028,color:"rgba(0,0,0,.56)",lineHeight:1.55}}>{body}</div>{hashtag&&<div style={{marginTop:W*.04,fontSize:W*.022,color:rgba(accent,.7)}}>{hashtag}</div>}</div></div>);
  if(tpl==="pt5")return(<div style={Object.assign({},root,{background:"#f0f0f2"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.07}} alt=""/>}<div style={{position:"absolute",left:0,top:0,right:0,height:"45%",background:"linear-gradient(135deg,"+accent+","+accent2+")",zIndex:1}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.65)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:(W*.04)+"px"}}><div style={{fontSize:W*.019,color:"rgba(255,255,255,.7)",fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",marginBottom:W*.015}}>{subtitle}</div><div style={{fontSize:W*.052,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,marginBottom:W*.015}}>{title}</div></div><div style={{position:"relative",zIndex:3,background:"#fff",padding:(W*.04)+"px",flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:W*.018}}><div style={{fontSize:W*.028,color:"#333",lineHeight:1.55}}>{body}</div>{hashtag&&<div style={{fontSize:W*.022,color:accent}}>{hashtag}</div>}</div></div>);
  if(tpl==="pt6")return(<div style={Object.assign({},root,{background:"#000"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.3}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.92) 65%)"}}/><div style={{position:"relative",zIndex:3,padding:(W*.035)+"px "+(W*.04)+"px",display:"flex",alignItems:"center",justifyContent:"space-between"}}><Logo sz={W*.09}/>{date&&<div style={{fontSize:W*.019,color:"rgba(255,255,255,.5)",letterSpacing:".08em"}}>{date}</div>}</div><div style={{position:"relative",zIndex:3,flex:1}}/><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.04)+"px "+(W*.05)+"px"}}><div style={{fontSize:W*.019,color:accent,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",marginBottom:W*.015}}>{subtitle}</div><div style={{fontSize:W*.054,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.08,marginBottom:W*.018}}>{title}</div><div style={{width:W*.07,height:2,background:accent,marginBottom:W*.018,borderRadius:2}}/><div style={{fontSize:W*.026,color:"rgba(255,255,255,.6)",lineHeight:1.5}}>{body}</div>{hashtag&&<div style={{marginTop:W*.025,fontSize:W*.022,color:rgba(accent,.6)}}>{hashtag}</div>}</div></div>);
  return(<div style={Object.assign({},root,{background:"#030308"})}>{bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18}} alt=""/>}<div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.85),rgba(0,0,0,.5),rgba(0,0,0,.85))"}}/><div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,"+accent+","+accent2+")",zIndex:4}}/><div style={{position:"relative",zIndex:3,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:(W*.06)+"px"}}><div style={{width:W*.1,height:3,background:accent,marginBottom:W*.04,borderRadius:2}}/><div style={{fontSize:W*.065,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1.05,textTransform:"uppercase",marginBottom:W*.03}}>{title}</div><div style={{fontSize:W*.036,color:accent,fontWeight:600,marginBottom:W*.04}}>{subtitle}</div><div style={{fontSize:W*.028,color:"rgba(255,255,255,.6)",lineHeight:1.55}}>{body}</div>{(date||hashtag)&&<div style={{marginTop:W*.05,fontSize:W*.022,color:"rgba(255,255,255,.3)",letterSpacing:".08em"}}>{date}{date&&hashtag?" · ":""}{hashtag}</div>}</div><div style={{position:"relative",zIndex:3,padding:(W*.04)+"px "+(W*.06)+"px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:W*.025}}><Logo sz={W*.09}/><div style={{fontSize:W*.022,color:"rgba(255,255,255,.35)",letterSpacing:".06em"}}>OFFICIEL</div></div></div>);
}
// ─── HISTORY THUMB ────────────────────────────────────────────
function HistoryThumb({h,c1,c2}){
  const W=108,H=192;
  const wr={width:W,height:H,overflow:"hidden",borderRadius:8,flexShrink:0,position:"relative"};
  const inn={width:270,height:480,transformOrigin:"top left",transform:"scale("+(W/270)+")",position:"absolute",top:0,left:0};
  try{
    if(h.type==="lineup")return<div style={wr}><div style={inn}><LineupCanvas ld={h.lineupData} tpl={h.lineupTpl||"ln1"} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    if(h.type==="group")return<div style={wr}><div style={inn}><GroupCanvas gd={h.groupData} tpl={h.groupTpl||"gr1"} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    if(h.type==="post")return<div style={wr}><div style={inn}><PostCanvas pd={h.postData} tpl={h.postTpl||"pt1"} logoUrl={h.logoUrl} accent={h.accent||c1} accent2={h.accent2||c2} bgUrl={h.bgUrl}/></div></div>;
    const sorted=[...(h.layers||[])].sort((a,b)=>a.z-b.z);
    return(<div style={Object.assign({},wr,{background:"#111"})}><div style={inn}>{sorted.map(lay=><LayerView key={lay.id} lay={lay} bgUrl={h.bgUrl} playerUrl={h.playerUrl} logoUrl={h.logoUrl} logo2Url={h.logo2Url} accent={h.accent||c1} accent2={h.accent2||c2} isSel={false} onMD={()=>{}}/>)}</div></div>);
  }catch(e){return<div style={Object.assign({},wr,{background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20})}>{h.ct&&h.ct.icon?h.ct.icon:"📄"}</div>;}
}
// ─── DRAG CANVAS ──────────────────────────────────────────────
function DragCanvas({layers,setLayers,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,t}){
  const cvRef=useRef(null);const dragRef=useRef(null);const[sel,setSel]=useState(null);const selL=sel?layers.find(l=>l.id===sel):null;
  const onMD=useCallback((e,id)=>{const l=layers.find(x=>x.id===id);if(!l||l.locked)return;e.preventDefault();e.stopPropagation();setSel(id);const rect=cvRef.current.getBoundingClientRect();dragRef.current={id,ox:l.x,oy:l.y,mx0:(e.clientX-rect.left)/rect.width*100,my0:(e.clientY-rect.top)/rect.height*100};},[layers]);
  const onMM=useCallback(e=>{if(!dragRef.current||!cvRef.current)return;const rect=cvRef.current.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*100,my=(e.clientY-rect.top)/rect.height*100;setLayers(prev=>prev.map(l=>l.id===dragRef.current.id?{...l,x:Math.max(0,Math.min(90,dragRef.current.ox+(mx-dragRef.current.mx0))),y:Math.max(0,Math.min(95,dragRef.current.oy+(my-dragRef.current.my0)))}:l));},[setLayers]);
  const onMU=useCallback(()=>{dragRef.current=null;},[]);
  function upd(f,v){setLayers(p=>p.map(l=>l.id===sel?Object.assign({},l,{[f]:v}):l));}
  function moveZ(id,d){setLayers(prev=>{const s=[...prev].sort((a,b)=>a.z-b.z);const i=s.findIndex(l=>l.id===id),j=i+d;if(j<0||j>=s.length)return prev;const za=s[i].z,zb=s[j].z;return prev.map(l=>l.id===s[i].id?{...l,z:zb}:l.id===s[j].id?{...l,z:za}:l);});}
  function delSel(){if(!selL||selL.locked)return;setLayers(p=>p.filter(l=>l.id!==sel));setSel(null);}
  function layerHit(e){const rect=cvRef.current.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*100,my=(e.clientY-rect.top)/rect.height*100;const c=[...layers].filter(l=>!l.locked&&mx>=l.x&&mx<=l.x+l.w&&my>=l.y&&my<=l.y+l.h).sort((a,b)=>b.z-a.z);setSel(c.length?c[0].id:null);}
  const sorted=[...layers].sort((a,b)=>a.z-b.z);
  const inp={background:t.bg4,border:"1px solid "+t.border2,borderRadius:6,padding:"5px 7px",color:t.text,fontSize:11,outline:"none",boxSizing:"border-box",width:"100%"};
  const isText=selL&&["text","watertext","heading","subtext"].includes(selL.type);
  return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#030306",padding:20,gap:10}}>
      <div ref={cvRef} className="visium-canvas" onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU} onClick={layerHit} style={{width:270,height:480,position:"relative",overflow:"hidden",borderRadius:16,border:"1px solid "+t.border,background:"#111",cursor:"default",userSelect:"none",flexShrink:0}}>
        {sorted.map(lay=>(<LayerView key={lay.id} lay={lay} bgUrl={bgUrl} playerUrl={playerUrl} logoUrl={logoUrl} logo2Url={logo2Url} accent={accent} accent2={accent2} isSel={sel===lay.id} onMD={onMD}/>))}
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.2)"}}>Cliquer · Glisser pour déplacer</div>
    </div>
    <div style={{width:230,background:t.bg2,borderLeft:"1px solid "+t.border,overflowY:"auto",padding:12,flexShrink:0}}>
      <div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>Calques</div>
      <div style={{marginBottom:12}}>{[...sorted].reverse().map(lay=>(<div key={lay.id} onClick={()=>setSel(lay.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 7px",borderRadius:6,marginBottom:2,background:sel===lay.id?rgba(accent,.14):t.bg3,border:"1px solid "+(sel===lay.id?rgba(accent,.45):t.border),cursor:"pointer"}}><span style={{fontSize:10,color:t.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lay.label||lay.type}</span>{!lay.locked&&<><button onClick={e=>{e.stopPropagation();moveZ(lay.id,1);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:11,padding:0}}>↑</button><button onClick={e=>{e.stopPropagation();moveZ(lay.id,-1);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:11,padding:0}}>↓</button></>}</div>))}</div>
      {selL&&!selL.locked&&(<div>
        <div style={{fontSize:10,color:accent,fontWeight:700,letterSpacing:".1em",marginBottom:10,textTransform:"uppercase"}}>✏️ {selL.label}</div>
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Texte affiché</div><textarea value={selL.text||""} onChange={e=>upd("text",e.target.value)} rows={2} style={Object.assign({},inp,{resize:"none",fontFamily:"inherit"})}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Police</div><select value={selL.font||"Impact"} onChange={e=>upd("font",e.target.value)} style={inp}>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select></div>}
        {isText&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Taille</div><input type="number" value={selL.fontSize||20} onChange={e=>upd("fontSize",+e.target.value||12)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur</div><input type="color" value={(selL.color||"#ffffff").startsWith("rgba")?"#ffffff":selL.color||"#ffffff"} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:32,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div></div>}
        {isText&&<div style={{display:"flex",gap:4,marginBottom:8}}>{[["bold","G","Gras"],["italic","I","Italic"],["upper","AA","Majusc."]].map(([f,sym,lbl])=>(<button key={f} onClick={()=>upd(f,!selL[f])} style={{flex:1,background:selL[f]?accent:"transparent",border:"1px solid "+(selL[f]?accent:t.border2),borderRadius:6,padding:"5px 2px",color:selL[f]?"#fff":t.text2,cursor:"pointer",fontSize:9,fontWeight:600,textAlign:"center"}}><div style={{fontSize:11,fontWeight:700}}>{sym}</div><div style={{fontSize:8,opacity:.7}}>{lbl}</div></button>))}</div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:3}}>Alignement</div><div style={{display:"flex",gap:4}}>{["left","center","right"].map(al=>(<button key={al} onClick={()=>upd("align",al)} style={{flex:1,background:(selL.align||"center")===al?accent:"transparent",border:"1px solid "+((selL.align||"center")===al?accent:t.border2),borderRadius:6,padding:"5px 2px",color:(selL.align||"center")===al?"#fff":t.text2,cursor:"pointer",fontSize:12}}>{al==="left"?"←":al==="center"?"≡":"→"}</button>))}</div></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Espacement lettres ({selL.letterSpacing||0}px)</div><input type="range" min={-2} max={20} step={0.5} value={selL.letterSpacing||0} onChange={e=>upd("letterSpacing",+e.target.value)} style={{width:"100%"}}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Interligne ({selL.lineHeight||1.2})</div><input type="range" min={0.8} max={3} step={0.1} value={selL.lineHeight||1.2} onChange={e=>upd("lineHeight",+e.target.value)} style={{width:"100%"}}/></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Ombre ({selL.textShadow||0}px)</div><input type="range" min={0} max={40} value={selL.textShadow||0} onChange={e=>upd("textShadow",+e.target.value)} style={{width:"100%"}}/></div>}
        {isText&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Fond texte</div><input type="color" value={selL.bgColor||"#000000"} onChange={e=>upd("bgColor",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Opacité fond</div><input type="range" min={0} max={1} step={0.05} value={selL.bgOpacity||0} onChange={e=>upd("bgOpacity",+e.target.value)} style={{width:"100%"}}/></div></div>}
        {isText&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Texte en arc ({selL.curve||0}°)</div><input type="range" min={-180} max={180} step={5} value={selL.curve||0} onChange={e=>upd("curve",+e.target.value)} style={{width:"100%"}}/>{(selL.curve||0)!==0&&<button onClick={()=>upd("curve",0)} style={{background:"none",border:"none",color:t.accent,cursor:"pointer",fontSize:9,padding:0,textDecoration:"underline"}}>Reset</button>}</div>}
        {selL.type==="watertext"&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Opacité filigrane ({selL.opacity||15}%)</div><input type="range" min={1} max={60} value={selL.opacity||15} onChange={e=>upd("opacity",+e.target.value)} style={{width:"100%"}}/></div>}
        {selL.type==="overlay"&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Intensité ({selL.opacity||60}%)</div><input type="range" min={0} max={100} value={selL.opacity||60} onChange={e=>upd("opacity",+e.target.value)} style={{width:"100%"}}/></div>}
        {selL.type==="stripe"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur 1</div><input type="color" value={selL.color||accent} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Couleur 2</div><input type="color" value={selL.color2||accent2} onChange={e=>upd("color2",e.target.value)} style={{width:"100%",height:30,borderRadius:6,border:"1px solid "+t.border2,background:t.bg4,cursor:"pointer",padding:2}}/></div></div>}
        {(selL.type==="scoreblock"||selL.type==="scorebig")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Nous</div><input value={selL.scoreHome||"0"} onChange={e=>upd("scoreHome",e.target.value)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Eux</div><input value={selL.scoreAway||"0"} onChange={e=>upd("scoreAway",e.target.value)} style={inp}/></div></div>}
        <div style={{background:t.bg3,borderRadius:8,padding:9,marginBottom:8}}><div style={{fontSize:9,color:t.text3,fontWeight:700,marginBottom:6}}>POSITION & TAILLE</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>X %</div><input type="number" value={Math.round(selL.x||0)} onChange={e=>upd("x",+e.target.value)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Y %</div><input type="number" value={Math.round(selL.y||0)} onChange={e=>upd("y",+e.target.value)} style={inp}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Larg %</div><input type="number" value={Math.round(selL.w||20)} onChange={e=>upd("w",+e.target.value)} style={inp}/></div><div><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Haut %</div><input type="number" value={Math.round(selL.h||10)} onChange={e=>upd("h",+e.target.value)} style={inp}/></div></div></div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:t.text3,marginBottom:2}}>Nom du calque</div><input value={selL.label||""} onChange={e=>upd("label",e.target.value)} style={inp}/></div>
        <button onClick={delSel} style={{width:"100%",background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.28)",borderRadius:7,padding:"7px",fontSize:11,cursor:"pointer"}}>🗑 Supprimer</button>
      </div>)}
      {!selL&&<div style={{fontSize:11,color:t.text3,textAlign:"center",lineHeight:1.6,marginTop:6}}>Cliquez un calque pour le modifier</div>}
    </div>
  </div>);
}
// ─── SMALL UI ATOMS ───────────────────────────────────────────
function TIn({v,on,ph,type,t,st,min}){return<input value={v} type={type||"text"} placeholder={ph||""} min={min} onChange={e=>on(e.target.value)} style={Object.assign({},{background:t.bg3,border:"1px solid "+t.border2,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"},st||{})}/>;}
function TSel({v,on,opts,t}){return<select value={v} onChange={e=>on(e.target.value)} style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}>{opts.map(o=>typeof o==="string"?<option key={o} value={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select>;}
function UpBtn({val,on,w,h,r,label,t}){w=w||52;h=h||44;r=r||8;const ref=useRef();const pick=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=ev=>on(ev.target.result);rd.readAsDataURL(f);};return(<div onClick={()=>ref.current.click()} style={{width:w,height:h,borderRadius:r,border:"2px dashed "+(val?t.accent:t.border2),background:t.bg3,cursor:"pointer",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,gap:2}}>{val?<img src={val} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<><span style={{color:t.text3,fontSize:20,lineHeight:1}}>+</span>{label&&<span style={{fontSize:9,color:t.text3,textAlign:"center",padding:"0 3px",lineHeight:1.2}}>{label}</span>}</>}<input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={pick}/></div>);}
function Av({photo,name,size}){size=size||40;const[err,setErr]=useState(false);const ini=(name||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();return(<div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#e63329,#1a1a2e)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:"#fff"}}>{photo&&!err?<img src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="" onError={()=>setErr(true)}/>:ini}</div>);}
function PBox({children,t,mb}){return<div style={{background:t.bg3,borderRadius:10,padding:12,marginBottom:mb||10}}>{children}</div>;}
function SHdr({label,t}){return<div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+t.border}}>{label}</div>;}
function TplGrid({tpls,sel,onSel,t,maxTemplates}){
  const cats=[...new Set(tpls.map(x=>x.cat))];
  return(<div>{cats.map(cat=>(
    <div key={cat} style={{marginBottom:8}}>
      <div style={{fontSize:9,color:t.text3,fontWeight:700,letterSpacing:".12em",marginBottom:5,textTransform:"uppercase"}}>{cat}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        {tpls.filter(x=>x.cat===cat).map((tpl,idx)=>{
          const locked=idx>=(maxTemplates||999);
          return(
            <div key={tpl.id} onClick={()=>!locked&&onSel(tpl.id)}
              style={{
                background:sel===tpl.id?rgba(t.accent,.18):t.bg3,
                border:"2px solid "+(sel===tpl.id?t.accent:t.border),
                borderRadius:8,padding:"7px 9px",
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
function PhotoPanel({players,selId,onSel,selUrl,onSelUrl,onAdd,onAddUrl,onFav,t}){
  const ref=useRef();
  const[removing,setRemoving]=useState(null);
  const player=players.find(p=>p.id===selId);
  const photos=player?[...(player.photos||[])].sort((a,b)=>((b.is_fav||b.fav)?1:0)-((a.is_fav||a.fav)?1:0)):[];
  const pick=e=>[...e.target.files].forEach(f=>{const r=new FileReader();r.onload=ev=>onAdd(selId,f);r.readAsDataURL(f);});
  function handleRemoveBg(ph){
    setRemoving(ph.id);
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{
      try{
        const c=document.createElement("canvas");
        c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height;
        const ctx=c.getContext("2d");
        ctx.drawImage(img,0,0);
        const d=ctx.getImageData(0,0,c.width,c.height);
        const data=d.data;
        for(let i=0;i<data.length;i+=4){
          const r=data[i],g=data[i+1],b=data[i+2];
          const avg=(r+g+b)/3;
          const variance=Math.max(r,g,b)-Math.min(r,g,b);
          if(avg>220&&variance<30) data[i+3]=0;
        }
        ctx.putImageData(d,0,0);
        const newUrl=c.toDataURL("image/png");
        Promise.resolve(onAddUrl&&onAddUrl(selId,newUrl,(ph.name||"photo")+"_nobg")).finally(()=>setRemoving(null));
      }catch(e){
        console.error("removeBg failed:",e);
        setRemoving(null);
      }
    };
    img.onerror=()=>setRemoving(null);
    img.src=ph.url;
  }
  return(<div>
    <div style={{fontSize:10,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Joueur</div>
    <TSel v={selId?String(selId):""} on={v=>onSel(v?v:null)} t={t} opts={[{v:"",l:"Sélectionner un joueur..."},...players.map(p=>({v:p.id,l:p.name+" · #"+p.number}))]}/>
    {player&&(<div style={{marginTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><span style={{fontSize:11,color:t.text2}}>{photos.length} photo{photos.length!==1?"s":""}</span><button onClick={()=>ref.current.click()} style={{fontSize:11,color:t.accent,background:rgba(t.accent,.12),border:"1px solid "+rgba(t.accent,.3),borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>+ Photo</button></div>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pick}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
        {photos.map(ph=>(<div key={ph.id} style={{position:"relative"}}>
          <div onClick={()=>onSelUrl(ph.url)} style={{borderRadius:7,overflow:"hidden",border:"2px solid "+(selUrl===ph.url?t.accent:t.border),cursor:"pointer",aspectRatio:"3/4"}}>
            <img src={ph.url} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>
          </div>
          {(ph.is_fav||ph.fav)&&<div style={{position:"absolute",top:3,left:3,background:t.accent,borderRadius:3,fontSize:8,color:contrastText(t.accent),padding:"1px 4px",fontWeight:700}}>FAV</div>}
          <div onClick={e=>{e.stopPropagation();onFav(selId,ph.id);}} style={{position:"absolute",top:3,right:3,fontSize:13,background:"rgba(0,0,0,.5)",borderRadius:3,padding:"1px 2px",cursor:"pointer"}}>{(ph.is_fav||ph.fav)?"★":"☆"}</div>
          <button onClick={e=>{e.stopPropagation();handleRemoveBg(ph);}} disabled={removing===ph.id}
            style={{position:"absolute",bottom:3,left:"50%",transform:"translateX(-50%)",background:rgba(t.accent,.85),border:"none",borderRadius:4,fontSize:9,color:contrastText(t.accent),cursor:removing===ph.id?"wait":"pointer",padding:"2px 5px",whiteSpace:"nowrap",fontWeight:600}}>
            {removing===ph.id?"...":"✂ fond"}
          </button>
        </div>))}
      </div>
    </div>)}
  </div>);
}
function LineupEditor({ld,setLd,players,t}){
  const fm=ld.formation||"4-4-2";const starters=ld.starters||[];const subs=ld.subs||[];
  const fRows=FORMATIONS[fm]||FORMATIONS["4-4-2"];const labels=["Gardien","Défenseur","Milieu","Attaquant"];
  let gi=0;const rowDefs=fRows.map((r,ri)=>{const from=gi;gi+=r.n;return{label:labels[Math.min(ri,3)],from,count:r.n};});
  function setStarter(i,pid){const ns=[...starters];ns[i]=pid?players.find(p=>p.id===pid)||null:null;setLd(d=>Object.assign({},d,{starters:ns}));}
  function setSub(i,pid){const ns=[...subs];ns[i]=pid?players.find(p=>p.id===pid)||null:null;setLd(d=>Object.assign({},d,{subs:ns}));}
  function autoFill(){const byPos={};POSITIONS.forEach(p=>{byPos[p]=players.filter(x=>x.position===p);});const lineup=[];fRows.forEach((r,ri)=>{const pos=labels[Math.min(ri,3)];(byPos[pos]||[]).slice(0,r.n).forEach(p=>lineup.push(p));const got=Math.min((byPos[pos]||[]).length,r.n);for(let i=got;i<r.n;i++)lineup.push(null);});const ids=lineup.filter(Boolean).map(p=>p.id);setLd(d=>Object.assign({},d,{starters:lineup,subs:players.filter(p=>!ids.includes(p.id)).slice(0,7)}));}
  const inp={background:t.bg4,border:"1px solid "+t.border,borderRadius:5,padding:"4px 6px",color:t.text,fontSize:11,outline:"none",boxSizing:"border-box",width:"100%"};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Formation</div><TSel v={fm} on={v=>setLd(d=>Object.assign({},d,{formation:v,starters:[]}))} t={t} opts={Object.keys(FORMATIONS)}/></div><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Adversaire</div><TIn v={ld.opponent||""} on={v=>setLd(d=>Object.assign({},d,{opponent:v}))} ph="vs..." t={t}/></div></div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TIn v={ld.competition||""} on={v=>setLd(d=>Object.assign({},d,{competition:v}))} ph="Ligue 1..." t={t}/></div>
    <button onClick={autoFill} style={{width:"100%",background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:7,padding:"7px",fontSize:11,cursor:"pointer",marginBottom:10,fontWeight:600}}>⚡ Remplissage auto</button>
    {rowDefs.map((row,ri)=>(<div key={ri} style={{marginBottom:7}}><div style={{fontSize:9,color:t.accent,letterSpacing:".1em",fontWeight:700,marginBottom:3,textTransform:"uppercase"}}>{row.label}</div>{Array.from({length:row.count}).map((_,pi)=>{const idx=row.from+pi;const cur=starters[idx];const ph=getPhoto(cur);return(<div key={pi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:24,height:24,borderRadius:5,overflow:"hidden",background:t.bg4,flexShrink:0,border:"1px solid "+(cur?t.accent:t.border)}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:9,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{idx+1}</span>}</div><TSel v={cur?cur.id:""} on={v=>setStarter(idx,v)} t={t} opts={[{v:"",l:"— Poste libre —"},...players.map(p=>({v:p.id,l:"#"+p.number+" "+p.name}))]}/></div>);})}</div>))}
    <div style={{fontSize:9,color:t.accent,letterSpacing:".1em",fontWeight:700,marginBottom:5,marginTop:8,textTransform:"uppercase"}}>Remplaçants</div>
    {Array.from({length:7}).map((_,i)=>{const cur=subs[i];const ph=getPhoto(cur);return(<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:24,height:24,borderRadius:5,overflow:"hidden",background:t.bg4,flexShrink:0,border:"1px solid "+(cur?t.accent:t.border)}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:9,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>{i+12}</span>}</div><TSel v={cur?cur.id:""} on={v=>setSub(i,v)} t={t} opts={[{v:"",l:"— Remplaçant —"},...players.map(p=>({v:p.id,l:"#"+p.number+" "+p.name}))]}/></div>);})}
  </div>);
}
function GroupEditor({gd,setGd,players,t}){
  const title=gd.title||"GROUPE A";const competition=gd.competition||"";
  const cats=[{k:"gk",l:"🧤 Gardiens",pos:"Gardien"},{k:"def",l:"🛡 Défenseurs",pos:"Défenseur"},{k:"mid",l:"⚙️ Milieux",pos:"Milieu"},{k:"fwd",l:"⚡ Attaquants",pos:"Attaquant"},{k:"coaches",l:"👔 Staff",pos:null}];
  const[impSel,setImpSel]=useState({});
  function add(k){setGd(d=>Object.assign({},d,{[k]:[...(d[k]||[]),{id:Date.now(),name:"",number:"",photo:null,captain:false}]}));}
  function rem(k,id){setGd(d=>Object.assign({},d,{[k]:(d[k]||[]).filter(p=>p.id!==id)}));}
  function upd(k,id,f,v){setGd(d=>Object.assign({},d,{[k]:(d[k]||[]).map(p=>p.id===id?Object.assign({},p,{[f]:v}):p)}));}
  function importOne(k){const pid=impSel[k];if(!pid)return;const p=players.find(x=>x.id===pid);if(!p||(gd[k]||[]).some(x=>x.id===p.id))return;setGd(d=>Object.assign({},d,{[k]:[...(d[k]||[]),{id:p.id,name:p.name,number:p.number,photo:getPhoto(p),captain:false}]}));setImpSel(s=>Object.assign({},s,{[k]:""}));}
  const inp={background:t.bg2,border:"1px solid "+t.border,borderRadius:4,padding:"2px 5px",color:t.text,fontSize:11,outline:"none"};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Titre</div><TIn v={title} on={v=>setGd(d=>Object.assign({},d,{title:v}))} ph="GROUPE A" t={t}/></div><div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TIn v={competition} on={v=>setGd(d=>Object.assign({},d,{competition:v}))} ph="Ligue 1..." t={t}/></div></div>
    {cats.map(cat=>{const list=gd[cat.k]||[];const avail=players.filter(p=>(cat.pos?p.position===cat.pos:true)&&!list.some(x=>x.id===p.id));return(<div key={cat.k} style={{marginBottom:7,background:t.bg3,borderRadius:8,padding:"9px 10px"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,color:t.text,fontWeight:600}}>{cat.l} <span style={{color:t.text3,fontWeight:400}}>({list.length})</span></span><button onClick={()=>add(cat.k)} style={{fontSize:10,color:t.accent,background:rgba(t.accent,.12),border:"1px solid "+rgba(t.accent,.3),borderRadius:5,padding:"3px 7px",cursor:"pointer"}}>+ Manuel</button></div>{avail.length>0&&(<div style={{display:"flex",gap:5,marginBottom:7}}><select value={impSel[cat.k]||""} onChange={e=>setImpSel(s=>Object.assign({},s,{[cat.k]:e.target.value}))} style={{flex:1,background:t.bg4,border:"1px solid "+t.border,borderRadius:5,padding:"5px 7px",color:t.text,fontSize:11,outline:"none"}}><option value="">— Ajouter depuis l'effectif —</option>{avail.map(p=><option key={p.id} value={p.id}>{"#"+p.number+" "+p.name}</option>)}</select><button onClick={()=>importOne(cat.k)} style={{background:impSel[cat.k]?t.accent:"#2a2a2a",color:"#fff",border:"none",borderRadius:5,padding:"5px 11px",fontSize:12,cursor:"pointer",fontWeight:600}}>↓</button></div>)}{list.length===0&&<div style={{fontSize:10,color:t.text3,textAlign:"center",padding:"3px 0",fontStyle:"italic"}}>Aucun joueur</div>}{list.map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,background:t.bg4,borderRadius:6,padding:"4px 6px"}}><div style={{width:24,height:24,borderRadius:4,overflow:"hidden",background:t.bg2,flexShrink:0,cursor:"pointer",border:"1px solid "+(p.photo?t.accent:t.border)}} onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>upd(cat.k,p.id,"photo",ev.target.result);r.readAsDataURL(f);};i.click();}}>{p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:12,color:t.text3,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>+</span>}</div><input value={p.number||""} onChange={e=>upd(cat.k,p.id,"number",e.target.value)} placeholder="#" style={Object.assign({},inp,{width:25})}/><input value={p.name||""} onChange={e=>upd(cat.k,p.id,"name",e.target.value)} placeholder="Nom" style={Object.assign({},inp,{flex:1})}/><span onClick={()=>upd(cat.k,p.id,"captain",!p.captain)} style={{cursor:"pointer",fontSize:14,opacity:p.captain?1:.2,color:t.accent}}>©</span><button onClick={()=>rem(cat.k,p.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:12,padding:0}}>✕</button></div>))}</div>);})}
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
// ─── APP ──────────────────────────────────────────────────────
export default function App({session}){
  const[club,setClub]=useState(null);
  const[players,setPlayers]=useState([]);
  const[media,setMedia]=useState([]);
  const[history,setHistory]=useState([]);
  const[loading,setLoading]=useState(true);
  const[nav,setNav]=useState("home");
  const[selType,setSelType]=useState(null);
  const[editId,setEditId]=useState(null);
  const[pName,setPName]=useState("");const[pNum,setPNum]=useState("");const[pPos,setPPos]=useState("Attaquant");
  const[layers,setLayers]=useState([]);
  const[bgUrl,setBgUrl]=useState(null);const[logoUrl,setLogoUrl]=useState(null);const[logo2Url,setLogo2Url]=useState(null);
  const[selPid,setSelPid]=useState(null);const[selPhoto,setSelPhoto]=useState(null);
  const[lineupData,setLineupData]=useState({formation:"4-4-2",starters:[],subs:[],opponent:"",competition:""});
  const[groupData,setGroupData]=useState({title:"GROUPE A",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
  const[postData,setPostData]=useState({title:"TITRE",subtitle:"Sous-titre",body:"Texte du message.",date:"",hashtag:""});
  const[lineupTpl,setLineupTpl]=useState("ln1");
  const[groupTpl,setGroupTpl]=useState("gr1");
  const[postTpl,setPostTpl]=useState("pt1");
  const[saveFlash,setSaveFlash]=useState(false);
  const[weeklyCount,setWeeklyCount]=useState(0);
  const[limitError,setLimitError]=useState("");
  const[onboardingSkipped,setOnboardingSkipped]=useState(()=>localStorage.getItem("onboarding_skipped")==="1");
  const[slotScale,setSlotScale]=useState(1);
  const mRef=useRef();
  const t=useMemo(()=>buildTheme(club?.color1,club?.color2,club?.theme_mode||"dark"),[club]);
  // ── LOAD DATA ───────────────────────────────────────────────
  useEffect(()=>{
    if(!session)return;
    async function load(){
      setLoading(true);
      const uid=session.user.id;
      let{data:clubData}=await supabase.from("clubs").select("*").eq("user_id",uid).single();
      if(!clubData){
        const{data:newClub}=await supabase.from("clubs").insert({user_id:uid,name:"Mon Club",approved:false}).select().single();
        clubData=newClub;
      }
      if(!clubData?.approved){await supabase.auth.signOut();return;}
      setClub(clubData);
      // Compter les visuels des 7 derniers jours
      const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
      const{count}=await supabase
        .from("visuals")
        .select("*",{count:"exact",head:true})
        .eq("club_id",clubData.id)
        .gte("created_at",since);
      setWeeklyCount(count||0);
      const{data:playersData}=await supabase.from("players").select("*, photos:player_photos(*)").eq("club_id",clubData.id);
      setPlayers(playersData||[]);
      const{data:mediaData}=await supabase.from("media").select("*").eq("club_id",clubData.id);
      setMedia(mediaData||[]);
      const{data:visualsData}=await supabase.from("visuals").select("*").eq("club_id",clubData.id).order("created_at",{ascending:false});
      setHistory((visualsData||[]).map(v=>({...v,layers:v.layers||[],lineupData:v.lineup_data||{},groupData:v.group_data||{},postData:v.post_data||{},lineupTpl:v.lineup_tpl,groupTpl:v.group_tpl,postTpl:v.post_tpl,bgUrl:v.bg_url,logoUrl:v.logo_url,logo2Url:v.logo2_url,playerUrl:v.player_url,ct:CTYPES.find(c=>c.id===v.type)})));
      setLoading(false);
    }
    load();
  },[session]);
  async function updateClub(patch){const updated={...club,...patch};setClub(updated);await supabase.from("clubs").update(patch).eq("id",club.id);}
  async function addPlayer(){
    if(!pName.trim())return;
    const{data}=await supabase.from("players").insert({club_id:club.id,name:pName.trim(),number:pNum,position:pPos}).select("*, photos:player_photos(*)").single();
    if(data)setPlayers(p=>[...p,data]);
    setPName("");setPNum("");
  }
  async function deletePlayer(id){await supabase.from("players").delete().eq("id",id);setPlayers(p=>p.filter(x=>x.id!==id));}
  const addPhoto=useCallback((playerId,file)=>{
    const reader=new FileReader();
    reader.onload=async(e)=>{
      const url=e.target.result;
      const{data}=await supabase.from("player_photos").insert({player_id:playerId,url,name:file.name,is_fav:false}).select().single();
      if(data)setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:[...(p.photos||[]),data]}:p));
    };
    reader.readAsDataURL(file);
  },[]);
  const addPhotoUrl=useCallback(async(playerId,url,name)=>{
    const{data}=await supabase.from("player_photos").insert({player_id:playerId,url,name:name||"photo_nobg",is_fav:false}).select().single();
    if(data)setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:[...(p.photos||[]),data]}:p));
  },[]);
  const toggleFav=useCallback(async(playerId,photoId)=>{
    const player=players.find(p=>p.id===playerId);
    const photo=player?.photos?.find(ph=>ph.id===photoId);
    if(!photo)return;
    await supabase.from("player_photos").update({is_fav:!photo.is_fav}).eq("id",photoId);
    setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:p.photos.map(ph=>ph.id===photoId?{...ph,is_fav:!ph.is_fav}:ph)}:p));
  },[players]);
  async function pickMedia(e){
    [...e.target.files].forEach(file=>{
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        const url=ev.target.result;
        const{data}=await supabase.from("media").insert({club_id:club.id,url,name:file.name}).select().single();
        if(data)setMedia(m=>[...m,data]);
      };
      reader.readAsDataURL(file);
    });
  }
  async function deleteMedia(id){await supabase.from("media").delete().eq("id",id);setMedia(m=>m.filter(x=>x.id!==id));}
  function selPlayer(id){
    setSelPid(id||null);
    if(id){const p=players.find(x=>x.id===id);setSelPhoto(p?getPhoto(p)||null:null);}
    else setSelPhoto(null);
  }
  function openCreate(type,fromH){
    setSelType(type);setNav("create");
    if(fromH){
      setEditId(fromH.id);setBgUrl(fromH.bgUrl||null);setLogoUrl(fromH.logoUrl||null);setLogo2Url(fromH.logo2Url||null);
      setSelPhoto(fromH.playerUrl||null);setSelPid(null);
      if(fromH.layers)setLayers(fromH.layers);
      if(fromH.lineupData)setLineupData(fromH.lineupData);
      if(fromH.groupData)setGroupData(fromH.groupData);
      if(fromH.postData)setPostData(fromH.postData);
      if(fromH.lineupTpl)setLineupTpl(fromH.lineupTpl);
      if(fromH.groupTpl)setGroupTpl(fromH.groupTpl);
      if(fromH.postTpl)setPostTpl(fromH.postTpl);
    } else {
      setEditId(null);setBgUrl(null);setLogoUrl(club?.logo_url||null);setLogo2Url(null);setSelPid(null);setSelPhoto(null);
      if(type!=="lineup"&&type!=="group"&&type!=="post")setLayers(makeLayers(type,club?.color1||"#e63329",club?.color2||"#1a1a2e"));
      if(type==="lineup")setLineupData({formation:"4-4-2",starters:[],subs:[],opponent:"",competition:""});
      if(type==="group")setGroupData({title:"GROUPE A",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
      if(type==="post")setPostData({title:"TITRE",subtitle:"Sous-titre",body:"Texte du message.",date:"",hashtag:""});
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
    const ct=CTYPES.find(c=>c.id===selType);
    const payload={club_id:club.id,type:selType,label:ct?.label||"",icon:ct?.icon||"",layers,lineup_data:lineupData,group_data:groupData,post_data:postData,lineup_tpl:lineupTpl,group_tpl:groupTpl,post_tpl:postTpl,bg_url:bgUrl,logo_url:logoUrl,logo2_url:logo2Url,player_url:selPhoto,updated_at:new Date().toISOString()};
    let saved;
    if(editId){
      const{data}=await supabase.from("visuals").update(payload).eq("id",editId).select().single();
      saved=data;
      if(saved)setHistory(h=>h.map(x=>x.id===editId?{...saved,layers:saved.layers||[],lineupData:saved.lineup_data||{},groupData:saved.group_data||{},postData:saved.post_data||{},lineupTpl:saved.lineup_tpl,groupTpl:saved.group_tpl,postTpl:saved.post_tpl,bgUrl:saved.bg_url,logoUrl:saved.logo_url,logo2Url:saved.logo2_url,playerUrl:saved.player_url,ct}:x));
    } else {
      const{data}=await supabase.from("visuals").insert(payload).select().single();
      saved=data;
      if(saved)setHistory(h=>[{...saved,layers:saved.layers||[],lineupData:saved.lineup_data||{},groupData:saved.group_data||{},postData:saved.post_data||{},lineupTpl:saved.lineup_tpl,groupTpl:saved.group_tpl,postTpl:saved.post_tpl,bgUrl:saved.bg_url,logoUrl:saved.logo_url,logo2Url:saved.logo2_url,playerUrl:saved.player_url,ct},...h]);
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
    try{
      const canvas=await html2canvas(el,{backgroundColor:null,scale:4,useCORS:true,allowTaint:true,logging:false});
      const filename="visium-"+(selType||"visuel")+"-"+Date.now()+".png";
      const ua=navigator.userAgent;
      const isIOS=/iPad|iPhone|iPod/.test(ua);
      const isSafari=/Safari/.test(ua)&&!/CriOS|FxiOS|Chrome/.test(ua);
      if(isIOS&&isSafari){
        const dataUrl=canvas.toDataURL("image/png");
        const w=window.open();
        if(w&&w.document){
          w.document.write('<html><head><title>'+filename+'</title><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;font-family:system-ui;"><img src="'+dataUrl+'" style="max-width:100%;height:auto;display:block"/><p style="color:#fff;text-align:center;font-size:14px;padding:16px;">Appuyez longuement sur l\'image puis « Ajouter aux Photos ».</p></body></html>');
          w.document.close();
        }else{
          window.location.href=dataUrl;
        }
      }else{
        canvas.toBlob(blob=>{
          if(!blob)return;
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=url;a.download=filename;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          setTimeout(()=>URL.revokeObjectURL(url),1000);
        },"image/png");
      }
    }catch(e){
      console.error("Download failed:",e);
      setLimitError("Erreur lors de l'export PNG.");
      setTimeout(()=>setLimitError(""),3000);
    }
  }
  if(loading)return(<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080810",color:"rgba(240,240,248,.4)",fontFamily:"system-ui",flexDirection:"column",gap:12}}><div style={{fontSize:28}}>⚡</div><div>Chargement de vos données...</div></div>);
  const card={background:t.bg2,border:"1px solid "+t.border,borderRadius:13,padding:20};
  function SaveBtn(){return(<>
    {limitError&&<div style={{background:"#450a0a",border:"1px solid #7f1d1d",borderRadius:8,padding:"10px 14px",color:"#fca5a5",fontSize:12,marginBottom:10}}>{limitError}</div>}
    <button onClick={save} style={{background:saveFlash?"#22c55e":t.accent,color:saveFlash?"#fff":contrastText(t.accent),border:"none",borderRadius:9,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:".04em",transition:"background .3s"}}>{saveFlash?"✓ Sauvegardé !":"✨ Sauvegarder le visuel"}</button>
    <button onClick={downloadPng} style={{marginTop:8,background:"transparent",color:t.text,border:"1px solid "+t.border2,borderRadius:9,padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",letterSpacing:".04em"}}>⬇ Télécharger en PNG</button>
  </>);}
  function BackBtn(){return<button onClick={()=>setSelType(null)} style={{display:"inline-flex",alignItems:"center",gap:7,background:t.bg3,border:"1px solid "+t.border2,borderRadius:8,padding:"7px 13px",color:t.text2,cursor:"pointer",fontSize:12,marginBottom:14,fontWeight:500}}>↩ Retour</button>;}
  function renderSpecial(){
    const isL=selType==="lineup",isP=selType==="post",isG=selType==="group";
    const tpls=isL?LINEUP_TPLS:isP?POST_TPLS:GROUP_TPLS;
    const tpl=isL?lineupTpl:isP?postTpl:groupTpl;
    const setTpl=isL?setLineupTpl:isP?setPostTpl:setGroupTpl;
    return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:268,background:t.bg2,borderRight:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0}}>
        <BackBtn/>
        <PBox t={t}><SHdr label="Template" t={t}/><TplGrid tpls={tpls} sel={tpl} onSel={setTpl} t={t} maxTemplates={club?.max_templates}/></PBox>
        <PBox t={t}>
          <SHdr label="Image de fond" t={t}/>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.slice(0,6).map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:"2px solid "+(bgUrl===m.url?t.accent:t.border),cursor:"pointer"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <div style={{display:"flex",gap:8,alignItems:"center"}}><UpBtn val={null} on={v=>setBgUrl(v)} w={48} h={34} r={6} label="Uploader" t={t}/>{bgUrl&&<button onClick={()=>setBgUrl(null)} style={{fontSize:11,color:t.text3,background:"none",border:"none",cursor:"pointer"}}>✕ Retirer</button>}</div>
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
            <input type="range" min={0.5} max={2.0} step={0.05} value={slotScale} onChange={e=>setSlotScale(+e.target.value)} style={{width:"100%"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:t.text3,marginTop:2}}><span>50%</span><span>200%</span></div>
          </PBox>
        )}
        <PBox t={t} mb={12}>
          <SHdr label={isL?"Composition XI":isP?"Contenu":"Joueurs & groupe"} t={t}/>
          {isL&&<LineupEditor ld={lineupData} setLd={setLineupData} players={players} t={t}/>}
          {isG&&<GroupEditor gd={groupData} setGd={setGroupData} players={players} t={t}/>}
          {isP&&<PostEditor pd={postData} setPd={setPostData} t={t}/>}
        </PBox>
        <SaveBtn/>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#030306",flexDirection:"column",gap:14}}>
        <div className="visium-canvas" style={{display:"inline-block"}}>
          {isL&&<LineupCanvas ld={lineupData} tpl={lineupTpl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl} slotScale={slotScale}/>}
          {isG&&<GroupCanvas gd={groupData} tpl={groupTpl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl}/>}
          {isP&&<PostCanvas pd={postData} tpl={postTpl} logoUrl={logoUrl||club?.logo_url} accent={club?.color1||"#e63329"} accent2={club?.color2||"#1a1a2e"} bgUrl={bgUrl}/>}
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.18)",letterSpacing:".1em",textTransform:"uppercase"}}>Aperçu en temps réel</div>
      </div>
    </div>);
  }
  function renderStandard(){
    return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:250,background:t.bg2,borderRight:"1px solid "+t.border,overflowY:"auto",padding:14,flexShrink:0}}>
        <BackBtn/>
        <PBox t={t}><SHdr label="Joueur & photo" t={t}/><PhotoPanel players={players} selId={selPid} onSel={selPlayer} selUrl={selPhoto} onSelUrl={setSelPhoto} onAdd={addPhoto} onAddUrl={addPhotoUrl} onFav={toggleFav} t={t}/></PBox>
        <PBox t={t}>
          <SHdr label="Image de fond" t={t}/>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:"2px solid "+(bgUrl===m.url?t.accent:t.border),cursor:"pointer"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <UpBtn val={null} on={v=>setBgUrl(v)} w={52} h={36} r={6} label="Uploader" t={t}/>
        </PBox>
        <PBox t={t}>
          <SHdr label={selType==="recruit"?"Logo club":"Logos"} t={t}/>
          <div style={{display:"grid",gridTemplateColumns:(selType==="result"||selType==="match")?"1fr 1fr":"1fr",gap:10}}>
            <div><div style={{fontSize:10,color:t.text3,marginBottom:5}}>Club</div><UpBtn val={logoUrl} on={setLogoUrl} w={52} h={52} r={8} label="Upload" t={t}/>{club?.logo_url&&<button onClick={()=>setLogoUrl(club.logo_url)} style={{fontSize:10,color:t.accent,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>← Logo club</button>}</div>
            {(selType==="result"||selType==="match")&&<div><div style={{fontSize:10,color:t.text3,marginBottom:5}}>Adversaire</div><UpBtn val={logo2Url} on={setLogo2Url} w={52} h={52} r={8} label="Upload" t={t}/>{logo2Url&&<button onClick={()=>setLogo2Url(null)} style={{fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer",marginTop:4,display:"block"}}>✕</button>}</div>}
          </div>
        </PBox>
        <SaveBtn/>
      </div>
      <DragCanvas layers={layers} setLayers={setLayers} bgUrl={bgUrl} playerUrl={selPhoto} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={t.accent} accent2={t.accent2} t={t}/>
    </div>);
  }
  return(
    <div style={{height:"100vh",display:"flex",background:t.bg,color:t.text,fontFamily:"system-ui,-apple-system,sans-serif",fontSize:13,overflow:"hidden"}}>
      <div style={{width:192,background:t.bg2,borderRight:"1px solid "+t.border,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"15px 14px 13px",borderBottom:"1px solid "+t.border,display:"flex",alignItems:"center",gap:10}}>
          {club?.logo_url?<img src={club.logo_url} style={{width:34,height:34,objectFit:"contain",borderRadius:7}} alt=""/>:<div style={{width:34,height:34,borderRadius:7,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:contrastText(mixC(club?.color1||"#e63329",club?.color2||"#1a1a2e",.5)),flexShrink:0}}>{(club?.name||"E")[0].toUpperCase()}</div>}
          <div style={{overflow:"hidden",flex:1}}><div style={{fontSize:14,fontWeight:700,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{club?.name||"Visium Sport"}</div><div style={{fontSize:10,color:t.text3,marginTop:1}}>Studio visuel</div></div>
        </div>
        <nav style={{padding:"10px 8px",flex:1}}>
          {NAV.map(n=>(<button key={n.id} onClick={()=>{setNav(n.id);if(n.id!=="create")setSelType(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:nav===n.id?rgba(t.accent,.15):"transparent",border:"none",borderRadius:9,padding:"9px 11px",color:nav===n.id?t.accent:t.text2,cursor:"pointer",fontSize:13,marginBottom:1,textAlign:"left",fontWeight:nav===n.id?600:400}}><span style={{fontSize:15,lineHeight:1}}>{n.icon}</span><span>{n.label}</span>{n.id==="history"&&history.length>0&&<span style={{marginLeft:"auto",background:rgba(t.accent,.2),color:t.accent,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:10}}>{history.length}</span>}</button>))}
        </nav>
        <div style={{padding:12,borderTop:"1px solid "+t.border,display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>openCreate("goal")} style={{background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",color:contrastText(mixC(club?.color1||"#e63329",club?.color2||"#1a1a2e",.5)),border:"none",borderRadius:9,padding:10,fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:".05em",textTransform:"uppercase"}}>✨ Créer un visuel</button>
          <button onClick={signOut} style={{background:"transparent",color:t.text3,border:"1px solid "+t.border,borderRadius:8,padding:"7px",fontSize:11,cursor:"pointer",width:"100%"}}>Déconnexion</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {nav==="home"&&(<div style={{flex:1,overflowY:"auto",background:t.bg}}>
          <div style={{padding:"28px 28px 0"}}><h1 style={{fontSize:24,fontWeight:700,color:t.text,marginBottom:4}}>{"Bonjour"+(club?.name?", "+club.name:"")+" 👋"}</h1><p style={{color:t.text3,marginBottom:24,fontSize:14}}>Que souhaitez-vous créer aujourd'hui ?</p></div>
          {(()=>{
            if(onboardingSkipped)return null;
            const clubDone=club?.is_configured===true;
            const playersDone=players.length>0;
            const visualsDone=history.length>0;
            if(clubDone&&playersDone&&visualsDone)return null;
            const steps=[
              {done:clubDone,label:"Configurer mon club",icon:"🎨",onClick:()=>setNav("club")},
              {done:playersDone,label:"Ajouter mes joueurs",icon:"👥",onClick:()=>setNav("players")},
              {done:visualsDone,label:"Créer mon premier visuel",icon:"✨",onClick:()=>setNav("create")},
            ];
            return(
              <div style={{padding:"0 28px 24px"}}>
                <div style={{background:t.bg2,border:"1px solid "+rgba(t.accent,.25),borderRadius:12,padding:20}}>
                  <div style={{fontSize:11,color:t.accent,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>Premiers pas</div>
                  <div style={{fontSize:14,color:t.text,marginBottom:14}}>Bienvenue ! Configurez votre club en 3 étapes.</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
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
                    <button onClick={()=>{localStorage.setItem("onboarding_skipped","1");setOnboardingSkipped(true);}}
                      style={{background:"none",border:"none",color:t.text3,fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0}}>
                      Passer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{padding:"0 28px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:28}}>{CTYPES.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:12,padding:"20px 18px",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=rgba(club?.color1||"#e63329",.55);e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";}}><div style={{fontSize:26,marginBottom:8}}>{c.icon}</div><div style={{fontWeight:700,color:t.text,fontSize:13,marginBottom:3}}>{c.label}</div><div style={{fontSize:11,color:t.text3,lineHeight:1.4}}>{c.desc}</div></div>))}</div>
          <div style={{padding:"0 28px 28px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>{[[history.length,"Visuels"],[players.length,"Joueurs"],[media.length,"Médias"],[LINEUP_TPLS.length+GROUP_TPLS.length+POST_TPLS.length,"Templates"]].map(([v,l])=>(<div key={l} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:10,padding:"14px 16px"}}><div style={{fontSize:22,fontWeight:700,color:t.accent,lineHeight:1}}>{v}</div><div style={{fontSize:11,color:t.text3,marginTop:4}}>{l}</div></div>))}</div>
        </div>)}
        {nav==="club"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Mon Club</h2>
          <p style={{color:t.text3,marginBottom:24,fontSize:13}}>Appliqué automatiquement à tous vos visuels.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:650}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Identité</div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Nom du club</label><TIn v={club?.name||""} on={v=>updateClub({name:v,is_configured:true})} ph="FC Mon Club" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"14px 0 10px"}}><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Couleur principale</label><input type="color" value={club?.color1||"#e63329"} onChange={e=>updateClub({color1:e.target.value,is_configured:true})} style={{width:"100%",height:40,borderRadius:8,border:"1px solid "+t.border2,background:t.bg3,cursor:"pointer",padding:3}}/></div><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Couleur secondaire</label><input type="color" value={club?.color2||"#1a1a2e"} onChange={e=>updateClub({color2:e.target.value,is_configured:true})} style={{width:"100%",height:40,borderRadius:8,border:"1px solid "+t.border2,background:t.bg3,cursor:"pointer",padding:3}}/></div></div><div style={{height:24,borderRadius:8,background:"linear-gradient(90deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",marginBottom:4}}/><div style={{fontSize:10,color:t.text3,textAlign:"center"}}>Sauvegardé en temps réel ✓</div></div>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Logo du club</div><UpBtn val={club?.logo_url} on={v=>updateClub({logo_url:v,is_configured:true})} w={110} h={110} r={14} label="Cliquer pour uploader" t={t}/>{club?.logo_url&&<><div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}><div style={{width:36,height:36,borderRadius:7,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center"}}><img src={club.logo_url} style={{width:28,height:28,objectFit:"contain"}} alt=""/></div><div style={{fontSize:11,color:t.text2}}>Logo configuré ✓</div></div><button onClick={()=>updateClub({logo_url:null,is_configured:true})} style={{marginTop:8,fontSize:10,color:t.text3,background:"none",border:"none",cursor:"pointer"}}>✕ Supprimer</button></>}</div>
          </div>
        </div>)}
        {nav==="players"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Effectif & Photos</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>Vos joueurs avec leurs photos.</p>
          <div style={{display:"grid",gridTemplateColumns:"275px 1fr",gap:18}}>
            <div>
              <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Nouveau joueur</div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Nom complet</label><TIn v={pName} on={setPName} ph="Prénom Nom" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0"}}><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Numéro</label><TIn v={pNum} on={v=>setPNum(v===""?"":String(Math.max(0,parseInt(v)||0)))} ph="9" type="number" min={0} t={t}/></div><div><label style={{fontSize:11,color:t.text3,marginBottom:5,display:"block"}}>Poste</label><TSel v={pPos} on={setPPos} t={t} opts={POSITIONS}/></div></div><button onClick={addPlayer} style={{background:t.accent,color:contrastText(t.accent),border:"none",borderRadius:8,padding:9,fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>+ Ajouter à l'effectif</button></div>
              {players.length>0&&<div style={Object.assign({},card,{marginTop:14})}><PhotoPanel players={players} selId={selPid} onSel={id=>{setSelPid(id||null);setSelPhoto(null);}} selUrl={selPhoto} onSelUrl={setSelPhoto} onAdd={addPhoto} onAddUrl={addPhotoUrl} onFav={toggleFav} t={t}/></div>}
            </div>
            <div><div style={{fontSize:13,fontWeight:600,color:t.text2,marginBottom:12}}>{players.length+" joueur"+(players.length!==1?"s":"")+" dans l'effectif"}</div>
              {players.length===0?<div style={Object.assign({},card,{padding:"40px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:32,marginBottom:10}}>👥</div><div>Aucun joueur</div></div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>{players.map(p=>{const fv=getPhoto(p);return(<div key={p.id} onClick={()=>{setSelPid(p.id);setSelPhoto(null);}} style={Object.assign({},card,{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12})}><Av photo={fv} name={p.name} size={44}/><div style={{flex:1}}><div style={{fontWeight:600,color:t.text,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:t.text3,marginTop:2}}>{p.position+" · #"+p.number+" · "+(p.photos||[]).length+" photo"+(p.photos&&p.photos.length!==1?"s":"")}</div></div><button onClick={e=>{e.stopPropagation();deletePlayer(p.id);}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:16,padding:4}}>✕</button></div>);})}</div>)}
            </div>
          </div>
        </div>)}
        {nav==="media"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Médiathèque</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>Fonds, stades et ambiances.</p>
          <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:18}}>
            <div style={card}><div onClick={()=>mRef.current.click()} style={{border:"2px dashed "+t.border2,borderRadius:10,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:t.bg3}} onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border2}><div style={{fontSize:28,marginBottom:8}}>🖼️</div><div style={{fontSize:13,color:t.text2,fontWeight:600}}>Uploader des images</div><div style={{fontSize:11,color:t.text3,marginTop:4}}>JPG, PNG · Multiple</div></div><input ref={mRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pickMedia}/></div>
            <div>{media.length===0?<div style={Object.assign({},card,{padding:"40px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:32,marginBottom:10}}>🖼️</div><div>Médiathèque vide</div></div>:(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{media.map(m=>(<div key={m.id} style={{borderRadius:11,overflow:"hidden",border:"1px solid "+t.border}}><div style={{aspectRatio:"16/9",overflow:"hidden"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div><div style={{padding:"6px 10px",fontSize:11,color:t.text2,background:t.bg2,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80%"}}>{m.name||"Image"}</span><button onClick={()=>deleteMedia(m.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:14}}>✕</button></div></div>))}</div>)}</div>
          </div>
        </div>)}
        {nav==="create"&&(!selType?(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}><h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Choisir un type</h2><p style={{color:t.text3,marginBottom:22,fontSize:13}}>Sélectionnez ce que vous souhaitez créer.</p><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,maxWidth:680}}>{CTYPES.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:13,padding:"22px 18px",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=rgba(t.accent,.55);e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";}}>  <div style={{fontSize:28,marginBottom:10}}>{c.icon}</div><div style={{fontWeight:700,color:t.text,fontSize:14,marginBottom:4}}>{c.label}</div><div style={{fontSize:11,color:t.text3,lineHeight:1.5}}>{c.desc}</div></div>))}</div></div>):(selType==="lineup"||selType==="group"||selType==="post")?renderSpecial():renderStandard())}
        {nav==="history"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Historique</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>{history.length+" visuel"+(history.length!==1?"s":"")+" · Cloud ☁️"}</p>
          {history.length===0?<div style={Object.assign({},card,{padding:"60px 20px",textAlign:"center",color:t.text3})}><div style={{fontSize:36,marginBottom:12}}>📁</div><div style={{fontSize:14}}>Aucun visuel sauvegardé</div></div>:(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>{history.map(h=>(<div key={h.id} style={{background:t.bg2,border:"1px solid "+t.border,borderRadius:12,overflow:"hidden"}}><div style={{background:"#030306",display:"flex",alignItems:"center",justifyContent:"center",padding:10}}><HistoryThumb h={h} c1={club?.color1||"#e63329"} c2={club?.color2||"#1a1a2e"}/></div><div style={{padding:"10px 12px",borderTop:"1px solid "+t.border}}><div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:6}}>{(h.ct&&h.ct.icon?h.ct.icon:"📄")+" "+(h.ct&&h.ct.label?h.ct.label:"Visuel")}</div><div style={{display:"flex",gap:6}}><button onClick={()=>{openCreate(h.type,h);setNav("create");}} style={{flex:1,background:rgba(t.accent,.15),color:t.accent,border:"1px solid "+rgba(t.accent,.3),borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer",fontWeight:600}}>↩ Modifier</button><button onClick={()=>deleteVisual(h.id)} style={{background:"rgba(239,68,68,.1)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.25)",borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer"}}>✕</button></div></div></div>))}</div>)}
        </div>)}
        {nav==="settings"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:4,color:t.text}}>Paramètres</h2>
          <p style={{color:t.text3,marginBottom:22,fontSize:13}}>Interface et données.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:650}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:14}}>Thème</div>{[["dark","🌑 Sombre","Interface noire premium"],["club","🎨 Couleurs du club","Adapté à vos couleurs"]].map(([mode,label,desc])=>(<div key={mode} onClick={()=>updateClub({theme_mode:mode})} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:10,border:"2px solid "+((club?.theme_mode||"dark")===mode?t.accent:t.border),background:(club?.theme_mode||"dark")===mode?rgba(t.accent,.12):t.bg3,cursor:"pointer",marginBottom:8}}><div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+t.accent,background:(club?.theme_mode||"dark")===mode?t.accent:"transparent",flexShrink:0}}/><div><div style={{fontSize:13,fontWeight:600,color:t.text}}>{label}</div><div style={{fontSize:11,color:t.text3,marginTop:2}}>{desc}</div></div></div>))}</div>
            <div style={Object.assign({},card,{display:"flex",flexDirection:"column",gap:14})}><div style={{fontSize:11,color:t.text3,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>Votre club</div><div style={{display:"flex",alignItems:"center",gap:12}}>{club?.logo_url?<img src={club.logo_url} style={{width:52,height:52,objectFit:"contain",borderRadius:8}} alt=""/>:<div style={{width:52,height:52,borderRadius:8,background:"linear-gradient(135deg,"+(club?.color1||"#e63329")+","+(club?.color2||"#1a1a2e")+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:contrastText(mixC(club?.color1||"#e63329",club?.color2||"#1a1a2e",.5))}}>{(club?.name||"?")[0].toUpperCase()}</div>}<div><div style={{fontSize:16,fontWeight:700,color:t.text}}>{club?.name||"Club non configuré"}</div><div style={{fontSize:12,color:t.text3,marginTop:3}}>{session.user.email}</div><div style={{fontSize:12,color:t.text3}}>{players.length+" joueurs · "+media.length+" médias · "+history.length+" visuels"}</div></div></div><button onClick={()=>setNav("club")} style={{background:t.bg3,border:"1px solid "+t.border2,borderRadius:9,padding:"9px 16px",color:t.text2,cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left"}}>Modifier les infos du club →</button><button onClick={signOut} style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9,padding:"9px 16px",color:"#fca5a5",cursor:"pointer",fontSize:12,textAlign:"left"}}>Se déconnecter</button></div>
          </div>
        </div>)}
      </div>
    </div>);
}
