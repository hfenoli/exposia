import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { supabase } from "./supabase";
const FONTS = [
  { id:"impact",  label:"Impact",     css:"Impact,'Arial Black',sans-serif" },
  { id:"system",  label:"Sans-serif", css:"system-ui,sans-serif" },
  { id:"georgia", label:"Georgia",    css:"Georgia,serif" },
  { id:"mono",    label:"Monospace",  css:"'Courier New',monospace" },
];
const POSITIONS = ["Attaquant","Milieu","Défenseur","Gardien"];
const CONTENT_TYPES = [
  { id:"goal",    icon:"⚽", label:"But" },
  { id:"result",  icon:"🏁", label:"Score Final" },
  { id:"match",   icon:"📅", label:"Affiche Match" },
  { id:"group",   icon:"📋", label:"Groupe" },
  { id:"lineup",  icon:"🎽", label:"Composition XI" },
  { id:"recruit", icon:"🌟", label:"Nouvelle Recrue" },
];
const NAV = [
  { id:"home",     icon:"⚡", label:"Accueil" },
  { id:"club",     icon:"🏟️", label:"Mon Club" },
  { id:"players",  icon:"👥", label:"Joueurs" },
  { id:"media",    icon:"🖼️", label:"Médias" },
  { id:"create",   icon:"✨", label:"Créer" },
  { id:"history",  icon:"📁", label:"Historique" },
  { id:"settings", icon:"⚙️", label:"Paramètres" },
];
const FORMATIONS = {
  "4-4-2":  [{n:1},{n:4},{n:4},{n:2}],
  "4-3-3":  [{n:1},{n:4},{n:3},{n:3}],
  "4-2-3-1":[{n:1},{n:4},{n:2},{n:3},{n:1}],
  "3-5-2":  [{n:1},{n:3},{n:5},{n:2}],
  "5-3-2":  [{n:1},{n:5},{n:3},{n:2}],
  "3-4-3":  [{n:1},{n:3},{n:4},{n:3}],
};
function hexRgb(h){h=(h||"#7c3aed").replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
function mix(h1,h2,t){const a=hexRgb(h1),b=hexRgb(h2);const r=n=>Math.round(a[n]+(b[n]-a[n])*t).toString(16).padStart(2,"0");return`#${r("r")}${r("g")}${r("b")}`;}
function lum(h){const{r,g,b}=hexRgb(h);return 0.299*r+0.587*g+0.114*b;}
function buildTheme(c1,c2,mode){
  const a=c1||"#7c3aed",b=c2||"#a855f7";
  if(mode==="club"){const dk=lum(a)<140;return{bg:dk?mix(a,"#000",.65):mix(a,"#fff",.85),bg2:dk?mix(a,"#000",.50):mix(a,"#fff",.70),bg3:dk?mix(a,"#000",.35):mix(a,"#fff",.55),bg4:dk?mix(a,"#000",.20):mix(a,"#fff",.38),border:`${a}44`,border2:`${a}77`,text:dk?"#f1f5f9":"#0f172a",text2:(dk?"#f1f5f9":"#0f172a")+"bb",text3:(dk?"#f1f5f9":"#0f172a")+"66",accent:a,accent2:b,sidebar:`linear-gradient(160deg,${mix(a,"#000",.42)},${mix(b,"#000",.52)})`};}
  return{bg:"#0a0a0f",bg2:"#12121a",bg3:"#1a1a26",bg4:"#22223a",border:"#2a2a40",border2:"#3a3a55",text:"#f1f5f9",text2:"#94a3b8",text3:"#64748b",accent:a,accent2:b,sidebar:"#12121a"};
}
function getPlayerPhoto(p){return p?.photos?.find(ph=>ph.is_fav)?.url||p?.photos?.[0]?.url||null;}
function buildRows(formation,starters){
  const rows=FORMATIONS[formation]||FORMATIONS["4-4-2"];
  const labels=["Gardien","Défenseur","Milieu","Attaquant"];
  let li=0;return rows.map((r,ri)=>{const p=starters.slice(li,li+r.n);li+=r.n;return{n:r.n,players:p,label:labels[Math.min(ri,3)]};});
}
// ── LINEUP RENDER ─────────────────────────────────────────────
function LineupRender({ld,tpl,logoUrl,logo2Url,accent,accent2,bgUrl,W=270,H=480}){
  const{formation="4-4-2",starters=[],subs=[],opponent="Adversaire",competition=""}=ld||{};
  const rows=buildRows(formation,starters);
  const style={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<200?8:14,flexShrink:0,display:"flex",flexDirection:"column"};
  if(tpl==="lt_bold")return(
    <div style={{...style,background:"#0a0a0f"}}>
      {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.12}} alt=""/>}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.75)"}}/>
      <div style={{position:"absolute",left:0,top:0,width:"100%",height:"22%",background:`linear-gradient(135deg,${accent},${accent2})`,zIndex:1}}/>
      <div style={{position:"relative",zIndex:2,padding:`${W*.037}px ${W*.044}px`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>{competition&&<div style={{fontSize:W*.026,color:"rgba(255,255,255,.7)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:2}}>{competition}</div>}<div style={{fontSize:W*.081,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",lineHeight:1}}>COMPO</div><div style={{fontSize:W*.052,fontWeight:900,color:"rgba(255,255,255,.7)",fontFamily:"Impact,sans-serif"}}>{formation}</div></div>
        <div style={{display:"flex",gap:W*.022,alignItems:"center"}}>{logoUrl&&<img src={logoUrl} style={{width:W*.118,height:W*.118,objectFit:"contain"}} alt=""/>}{logo2Url&&<><span style={{fontSize:W*.037,color:"rgba(255,255,255,.5)",fontStyle:"italic"}}>vs</span><img src={logo2Url} style={{width:W*.104,height:W*.104,objectFit:"contain",opacity:.8}} alt=""/></>}</div>
      </div>
      <div style={{position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:`${W*.015}px ${W*.03}px`}}>
        {[...rows].reverse().map((row,ri)=>(<div key={ri} style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>{Array.from({length:row.n}).map((_,pi)=>{const p=row.players[pi];const ph=getPlayerPhoto(p);return(<div key={pi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><div style={{position:"relative"}}><div style={{width:W*.118,height:W*.118,borderRadius:W*.022,overflow:"hidden",background:"rgba(255,255,255,.1)",border:"2px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.041,fontWeight:700,color:"rgba(255,255,255,.5)"}}>{p?.number||"?"}</span>}</div>{p?.number&&<div style={{position:"absolute",bottom:-3,right:-3,background:accent,borderRadius:3,fontSize:W*.026,fontWeight:700,color:"#fff",padding:"1px 3px",lineHeight:1}}>{p.number}</div>}</div><span style={{fontSize:W*.026,color:"#fff",fontWeight:600,textAlign:"center",maxWidth:W*.148,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:W*.018}}>{p?.name?.split(" ").slice(-1)[0]||"—"}</span></div>);})}
        </div>))}
      </div>
      {subs.length>0&&<div style={{position:"relative",zIndex:2,borderTop:`2px solid ${accent}`,padding:`${W*.019}px ${W*.037}px`,background:"rgba(0,0,0,.5)",display:"flex",flexWrap:"wrap",gap:W*.015,alignItems:"center"}}><span style={{fontSize:W*.026,color:accent,fontWeight:700,letterSpacing:".1em",marginRight:W*.015}}>SUBS</span>{subs.map((s,i)=>(<span key={i} style={{fontSize:W*.03,color:"rgba(255,255,255,.6)",background:"rgba(255,255,255,.07)",borderRadius:3,padding:`1px ${W*.019}px`}}>#{s?.number||"?"} {s?.name?.split(" ").slice(-1)[0]||"—"}</span>))}</div>}
    </div>
  );
  return(
    <div style={{...style,background:"#071a0e"}}>
      {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18}} alt=""/>}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,#0a2e12cc,#071a0eee)"}}/>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.13}} viewBox="0 0 270 480"><rect x="20" y="8" width="230" height="370" rx="4" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="20" y1="193" x2="250" y2="193" stroke="#fff" strokeWidth="1"/><ellipse cx="135" cy="193" rx="34" ry="34" fill="none" stroke="#fff" strokeWidth="1"/></svg>
      <div style={{position:"relative",zIndex:2,background:`linear-gradient(90deg,${accent},${accent2})`,height:W*.015}}/>
      <div style={{position:"relative",zIndex:2,padding:`${W*.022}px ${W*.037}px`,display:"flex",alignItems:"center",gap:W*.03}}>
        {logoUrl?<img src={logoUrl} style={{width:W*.096,height:W*.096,objectFit:"contain"}} alt=""/>:<div style={{width:W*.096,height:W*.096,borderRadius:4,background:`${accent}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:W*.03,color:accent}}>LOGO</div>}
        <div style={{flex:1}}>{competition&&<div style={{fontSize:W*.026,color:"rgba(255,255,255,.4)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.041,fontWeight:700,color:"#fff",fontFamily:"Impact,sans-serif",letterSpacing:".04em"}}>COMPO · {formation}</div></div>
        <div style={{fontSize:W*.033,color:"rgba(255,255,255,.4)",fontStyle:"italic"}}>vs {opponent}</div>
        {logo2Url&&<img src={logo2Url} style={{width:W*.074,height:W*.074,objectFit:"contain",opacity:.7}} alt=""/>}
      </div>
      <div style={{position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",padding:`${W*.007}px ${W*.022}px ${W*.015}px`}}>
        {[...rows].reverse().map((row,ri)=>(<div key={ri} style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>{Array.from({length:row.n}).map((_,pi)=>{const p=row.players[pi];const ph=getPlayerPhoto(p);return(<div key={pi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:W*.148}}><div style={{width:W*.111,height:W*.111,borderRadius:"50%",overflow:"hidden",border:`2px solid ${accent}`,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>{ph?<img src={ph} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/>:<span style={{fontSize:W*.033,fontWeight:700,color:accent}}>{p?.number||"?"}</span>}</div><span style={{fontSize:W*.028,color:"#fff",fontWeight:600,textAlign:"center",maxWidth:W*.163,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:"0 1px 4px #000"}}>{p?.name?.split(" ").slice(-1)[0]||"—"}</span></div>);})}
        </div>))}
      </div>
      {subs.length>0&&<div style={{position:"relative",zIndex:2,borderTop:"1px solid rgba(255,255,255,.1)",padding:`${W*.015}px ${W*.037}px`,background:"rgba(0,0,0,.4)"}}><div style={{fontSize:W*.026,color:"rgba(255,255,255,.35)",letterSpacing:".1em",marginBottom:W*.007}}>REMPLAÇANTS</div><div style={{display:"flex",gap:W*.019,flexWrap:"wrap"}}>{subs.map((s,i)=>(<span key={i} style={{fontSize:W*.03,color:"rgba(255,255,255,.5)"}}>{s?.name?.split(" ").slice(-1)[0]||"—"}</span>))}</div></div>}
    </div>
  );
}
// ── GROUP RENDER ──────────────────────────────────────────────
function GroupRender({gd,tpl,logoUrl,logo2Url,accent,accent2,bgUrl,W=270,H=480}){
  const{title="GROUPE A",competition="",gk=[],def=[],mid=[],fwd=[],coaches=[]}=gd||{};
  const style={width:W,height:H,position:"relative",overflow:"hidden",borderRadius:W<200?8:14,flexShrink:0,display:"flex",flexDirection:"column"};
  const cats=[{label:"GARDIENS",list:gk},{label:"DÉFENSEURS",list:def},{label:"MILIEUX",list:mid},{label:"ATTAQUANTS",list:fwd},...(coaches.length?[{label:"STAFF",list:coaches}]:[])];
  return(<div style={{...style,background:"#0a0a0f"}}>
    {bgUrl&&<img src={bgUrl} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.15}} alt=""/>}
    <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,${accent}18,#0a0a0f 55%,${accent2}10)`}}/>
    <div style={{position:"relative",zIndex:2,background:`linear-gradient(90deg,${accent},${accent2})`,height:W*.015}}/>
    <div style={{position:"relative",zIndex:2,padding:`${W*.03}px ${W*.052}px`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:W*.03}}>{logoUrl?<img src={logoUrl} style={{width:W*.119,height:W*.119,objectFit:"contain"}} alt=""/>:<div style={{width:W*.119,height:W*.119,borderRadius:4,background:`${accent}33`,fontSize:W*.03,color:accent,display:"flex",alignItems:"center",justifyContent:"center"}}>LOGO</div>}</div>
      <div style={{textAlign:"right"}}>{competition&&<div style={{fontSize:W*.026,color:"rgba(255,255,255,.4)",letterSpacing:".1em",textTransform:"uppercase"}}>{competition}</div>}<div style={{fontSize:W*.056,fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif",letterSpacing:".06em"}}>{title}</div></div>
    </div>
    <div style={{position:"relative",zIndex:2,flex:1,overflowY:"auto",padding:`${W*.015}px ${W*.052}px ${W*.037}px`}}>
      {cats.map((cat,ci)=>cat.list.length>0&&(<div key={ci} style={{marginBottom:W*.03}}><div style={{fontSize:W*.03,color:ci%2===0?accent:accent2,letterSpacing:".12em",textTransform:"uppercase",fontWeight:700,marginBottom:W*.015,borderBottom:`1px solid ${ci%2===0?accent:accent2}33`,paddingBottom:W*.007}}>{cat.label} ({cat.list.length})</div>{cat.list.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:W*.03,marginBottom:W*.011}}><div style={{width:W*.081,height:W*.081,borderRadius:W*.011,background:`${accent}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:W*.033,color:accent,fontWeight:700,flexShrink:0}}>{p.number||"—"}</div><span style={{color:"rgba(255,255,255,.85)",fontSize:W*.041,flex:1}}>{p.name||"—"}</span></div>))}</div>))}
    </div>
  </div>);
}
// ── LAYER VIEW ────────────────────────────────────────────────
function LayerView({lay,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2,isSel,onMD}){
  const s={position:"absolute",left:`${lay.x}%`,top:`${lay.y}%`,width:`${lay.w}%`,height:`${lay.h}%`,cursor:lay.locked?"default":"grab",boxSizing:"border-box",outline:isSel&&!lay.locked?`2px solid ${accent}`:"none",outlineOffset:1,zIndex:lay.z};
  if(lay.type==="bg")return(<div style={{...s,cursor:"default",overflow:"hidden"}}>{bgUrl?<img src={bgUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",background:"linear-gradient(160deg,#0a0a1a,#1a0a2e)"}}/>}</div>);
  if(lay.type==="overlay")return<div style={{...s,cursor:"default",background:`linear-gradient(to bottom,rgba(0,0,0,${(lay.opacity||60)/200}),rgba(0,0,0,${(lay.opacity||60)/100}))`}}/>;
  if(lay.type==="stripe")return<div style={{...s,background:`linear-gradient(90deg,${lay.color||accent},${lay.color2||accent2})`,cursor:"grab"}} onMouseDown={e=>onMD(e,lay.id)}/>;
  if(lay.type==="photo")return(<div style={{...s,overflow:"hidden"}} onMouseDown={e=>onMD(e,lay.id)}>{playerUrl?<img src={playerUrl} style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"top"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:32}}>👤</div>}</div>);
  if(lay.type==="logo")return(<div style={{...s}} onMouseDown={e=>onMD(e,lay.id)}>{logoUrl?<img src={logoUrl} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:`${accent}33`,borderRadius:4,fontSize:9,color:accent}}>LOGO</div>}</div>);
  if(lay.type==="logo2")return(<div style={{...s}} onMouseDown={e=>onMD(e,lay.id)}>{logo2Url?<img src={logo2Url} style={{width:"100%",height:"100%",objectFit:"contain"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.08)",borderRadius:4,fontSize:9,color:"rgba(255,255,255,.3)"}}>ADV</div>}</div>);
  if(lay.type==="text")return(<div style={{...s,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}} onMouseDown={e=>onMD(e,lay.id)}><span style={{fontFamily:FONTS.find(f=>f.id===lay.fontId)?.css||"system-ui",fontSize:lay.fontSize||16,color:lay.color||"#fff",fontWeight:lay.bold?"900":"400",fontStyle:lay.italic?"italic":"normal",textAlign:"center",lineHeight:1.1,textShadow:"0 1px 8px rgba(0,0,0,.8)",maxWidth:"100%",padding:"0 2px",wordBreak:"break-word"}}>{lay.text||""}</span></div>);
  if(lay.type==="watertext")return(<div style={{...s,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",transform:"rotate(-8deg)"}} onMouseDown={e=>onMD(e,lay.id)}><span style={{fontFamily:"Impact,sans-serif",fontSize:lay.fontSize||80,color:lay.color||accent,fontWeight:900,opacity:(lay.opacity||15)/100,userSelect:"none",whiteSpace:"nowrap"}}>{lay.text||""}</span></div>);
  if(lay.type==="scoreblock"||lay.type==="scorebig")return(<div style={{...s,display:"flex",alignItems:"center",justifyContent:"center",gap:"6%"}} onMouseDown={e=>onMD(e,lay.id)}><span style={{fontSize:lay.fontSize||(lay.type==="scorebig"?44:22),fontWeight:900,color:lay.color||"#fff",fontFamily:"Impact,sans-serif"}}>{lay.scoreHome||"0"}</span><span style={{fontSize:(lay.fontSize||(lay.type==="scorebig"?44:22))*.55,color:"rgba(255,255,255,.35)",fontFamily:"Impact,sans-serif"}}>-</span><span style={{fontSize:lay.fontSize||(lay.type==="scorebig"?44:22),fontWeight:900,color:lay.color||"#fff",fontFamily:"Impact,sans-serif"}}>{lay.scoreAway||"0"}</span></div>);
  if(lay.type==="resultlabel"){const sh=parseInt(lay.scoreHome||"0"),sa=parseInt(lay.scoreAway||"0");const label=sh>sa?"VICTOIRE":sh===sa?"MATCH NUL":"DÉFAITE";const lc=sh>sa?"#22c55e":sh===sa?"#f59e0b":"#ef4444";return<div style={{...s,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseDown={e=>onMD(e,lay.id)}><span style={{fontSize:11,fontWeight:700,color:lc,letterSpacing:".14em"}}>{label}</span></div>;}
  if(lay.type==="badge")return(<div style={{...s,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:"4px"}} onMouseDown={e=>onMD(e,lay.id)}><span style={{background:`${lay.color||accent}33`,color:lay.color||accent,border:`1px solid ${lay.color||accent}55`,borderRadius:4,fontSize:9,fontWeight:700,padding:"2px 7px"}}>{lay.text||"COMPÉTITION"}</span></div>);
  return null;
}
function makeLayers(type,c1,c2){
  const base={
    goal:[{id:"bg",z:0,type:"bg",x:0,y:0,w:100,h:100,locked:true,label:"Fond"},{id:"overlay",z:1,type:"overlay",x:0,y:0,w:100,h:100,locked:true,label:"Overlay",opacity:70},{id:"watermark",z:2,type:"watertext",x:-5,y:22,w:110,h:28,locked:false,label:"Filigrane",text:"BUT",fontSize:110,color:c1,opacity:15},{id:"player",z:3,type:"photo",x:8,y:6,w:84,h:74,locked:false,label:"Photo joueur"},{id:"logo",z:4,type:"logo",x:4,y:4,w:13,h:13,locked:false,label:"Logo club"},{id:"badge",z:5,type:"badge",x:68,y:4,w:28,h:8,locked:false,label:"Badge",text:"",color:c1},{id:"stripe",z:6,type:"stripe",x:0,y:0,w:100,h:1.2,locked:false,label:"Bande",color:c1,color2:c2},{id:"bigtext",z:7,type:"text",x:6,y:72,w:88,h:14,locked:false,label:"Texte BUT",text:"BUT !",fontSize:56,fontId:"impact",color:"#ffffff",bold:true},{id:"name",z:8,type:"text",x:6,y:85,w:88,h:8,locked:false,label:"Nom joueur",text:"Nom Joueur",fontSize:20,fontId:"system",color:c2},{id:"score",z:9,type:"scoreblock",x:22,y:91,w:56,h:7,locked:false,label:"Score",scoreHome:"2",scoreAway:"0",color:c1}],
    result:[{id:"bg",z:0,type:"bg",x:0,y:0,w:100,h:100,locked:true,label:"Fond"},{id:"overlay",z:1,type:"overlay",x:0,y:0,w:100,h:100,locked:true,label:"Overlay",opacity:65},{id:"player",z:2,type:"photo",x:5,y:5,w:90,h:65,locked:false,label:"Photo joueur"},{id:"logo",z:3,type:"logo",x:4,y:4,w:12,h:12,locked:false,label:"Logo club"},{id:"logo2",z:4,type:"logo2",x:84,y:4,w:12,h:12,locked:false,label:"Logo adversaire"},{id:"stripe",z:5,type:"stripe",x:0,y:0,w:100,h:1.2,locked:false,label:"Bande",color:c1,color2:c2},{id:"resultlbl",z:6,type:"resultlabel",x:10,y:68,w:80,h:6,locked:false,label:"Résultat auto"},{id:"scorebig",z:7,type:"scorebig",x:5,y:73,w:90,h:16,locked:false,label:"Score",scoreHome:"2",scoreAway:"0",color:"#ffffff"},{id:"opp",z:8,type:"text",x:10,y:88,w:80,h:6,locked:false,label:"Adversaire",text:"vs Adversaire",fontSize:14,fontId:"system",color:"rgba(255,255,255,0.45)"}],
    match:[{id:"bg",z:0,type:"bg",x:0,y:0,w:100,h:100,locked:true,label:"Fond"},{id:"overlay",z:1,type:"overlay",x:0,y:0,w:100,h:100,locked:true,label:"Overlay",opacity:60},{id:"stripe",z:2,type:"stripe",x:0,y:0,w:100,h:1.2,locked:false,label:"Bande",color:c1,color2:c2},{id:"clubname",z:3,type:"text",x:6,y:24,w:88,h:14,locked:false,label:"Nom club",text:"MON CLUB",fontSize:38,fontId:"impact",color:"#ffffff",bold:true},{id:"vs",z:4,type:"text",x:28,y:38,w:44,h:10,locked:false,label:"VS",text:"vs",fontSize:24,fontId:"georgia",color:"rgba(255,255,255,0.45)",italic:true},{id:"opp",z:5,type:"text",x:6,y:47,w:88,h:12,locked:false,label:"Adversaire",text:"Adversaire",fontSize:30,fontId:"georgia",color:"#ffffff",bold:true,italic:true},{id:"logo",z:6,type:"logo",x:3,y:60,w:14,h:14,locked:false,label:"Logo club"},{id:"logo2",z:7,type:"logo2",x:83,y:60,w:14,h:14,locked:false,label:"Logo adversaire"},{id:"date",z:8,type:"text",x:6,y:76,w:88,h:7,locked:false,label:"Date",text:"Samedi 12 Avril · 21h00",fontSize:14,fontId:"system",color:"rgba(255,255,255,0.6)"}],
    recruit:[{id:"bg",z:0,type:"bg",x:0,y:0,w:100,h:100,locked:true,label:"Fond"},{id:"overlay",z:1,type:"overlay",x:0,y:0,w:100,h:100,locked:true,label:"Overlay",opacity:55},{id:"stripe",z:2,type:"stripe",x:0,y:0,w:100,h:1.2,locked:false,label:"Bande",color:c1,color2:c2},{id:"player",z:3,type:"photo",x:5,y:5,w:90,h:66,locked:false,label:"Photo joueur"},{id:"logo",z:4,type:"logo",x:4,y:4,w:12,h:12,locked:false,label:"Logo club"},{id:"tag",z:5,type:"text",x:8,y:73,w:84,h:6,locked:false,label:"Tag recrue",text:"NOUVELLE RECRUE",fontSize:11,fontId:"system",color:c1,bold:true},{id:"name",z:6,type:"text",x:8,y:79,w:84,h:12,locked:false,label:"Nom joueur",text:"Prénom Nom",fontSize:30,fontId:"impact",color:"#ffffff",bold:true},{id:"pos",z:7,type:"text",x:8,y:90,w:84,h:7,locked:false,label:"Poste",text:"Attaquant · #9",fontSize:14,fontId:"system",color:c2}],
  };
  return JSON.parse(JSON.stringify(base[type]||base.goal));
}
// ── ATOMS ─────────────────────────────────────────────────────
const TInput=({value,onChange,placeholder,type,t,style})=>(<input value={value} type={type||"text"} placeholder={placeholder} onChange={e=>onChange(e.target.value)} style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",...style}}/>);
const TSelect=({value,onChange,options,t})=>(<select value={value} onChange={e=>onChange(e.target.value)} style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:7,padding:"8px 10px",color:t.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}>{options.map(o=>typeof o==="string"?<option key={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}</select>);
function UpBtn({value,onChange,w=52,h=40,r=7,label,t}){
  const ref=useRef();
  const pick=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=ev=>onChange(ev.target.result);rd.readAsDataURL(f);};
  return(<div onClick={()=>ref.current.click()} style={{width:w,height:h,borderRadius:r,border:`2px dashed ${value?t.accent:t.border2}`,background:t.bg3,cursor:"pointer",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,gap:2}}>{value?<img src={value} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<><span style={{color:t.text3,fontSize:18}}>+</span>{label&&<span style={{fontSize:9,color:t.text3,textAlign:"center",padding:"0 2px",lineHeight:1.2}}>{label}</span>}</>}<input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={pick}/></div>);
}
function Av({photo,name,size=40}){
  const[err,setErr]=useState(false);
  const ini=(name||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return(<div style={{width:size,height:size,borderRadius:size*.18,overflow:"hidden",background:"linear-gradient(135deg,#7c3aed99,#3b82f699)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:"#fff"}}>{photo&&!err?<img src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="" onError={()=>setErr(true)}/>:ini}</div>);
}
function BackBtn({onClick,t}){return(<button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:6,background:t.bg3,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 12px",color:t.text2,cursor:"pointer",fontSize:13,marginBottom:14}}>↩ Retour</button>);}
function LineupEditor({ld,setLd,players,t}){
  const{formation="4-4-2",starters=[],subs=[],opponent="",competition=""}=ld;
  const rows=FORMATIONS[formation]||FORMATIONS["4-4-2"];
  const labels=["Gardien","Défenseur","Milieu","Attaquant"];
  let gi=0;const rowDefs=rows.map((r,ri)=>{const from=gi;gi+=r.n;return{label:labels[Math.min(ri,3)],from,count:r.n};});
  function setStarter(i,pid){const ns=[...starters];ns[i]=pid?players.find(p=>p.id===pid):null;setLd(d=>({...d,starters:ns}));}
  function setSub(i,pid){const ns=[...subs];ns[i]=pid?players.find(p=>p.id===pid):null;setLd(d=>({...d,subs:ns}));}
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Formation</div><TSelect value={formation} onChange={v=>setLd(d=>({...d,formation:v,starters:[]}))} t={t} options={Object.keys(FORMATIONS)}/></div>
      <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Adversaire</div><TInput value={opponent} onChange={v=>setLd(d=>({...d,opponent:v}))} placeholder="vs..." t={t}/></div>
    </div>
    <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TInput value={competition} onChange={v=>setLd(d=>({...d,competition:v}))} placeholder="Ligue 1..." t={t}/></div>
    {rowDefs.map((row,ri)=>(<div key={ri} style={{marginBottom:6}}>
      <div style={{fontSize:9,color:t.accent,letterSpacing:".1em",marginBottom:3}}>{row.label.toUpperCase()}</div>
      {Array.from({length:row.count}).map((_,pi)=>{
        const idx=row.from+pi;const cur=starters[idx];
        return(<div key={pi} style={{marginBottom:3}}>
          <TSelect value={cur?cur.id:""} onChange={v=>setStarter(idx,v)} t={t} options={[{v:"",l:"— Poste libre —"},...players.map(p=>({v:p.id,l:`#${p.number} ${p.name}`}))]}/>
        </div>);
      })}
    </div>))}
    <div style={{fontSize:10,color:t.text3,marginBottom:6,marginTop:10}}>Remplaçants</div>
    {Array.from({length:5}).map((_,i)=>{const cur=subs[i];return(
      <div key={i} style={{marginBottom:4}}>
        <TSelect value={cur?cur.id:""} onChange={v=>setSub(i,v)} t={t} options={[{v:"",l:"— Remplaçant —"},...players.map(p=>({v:p.id,l:`#${p.number} ${p.name}`}))]}/>
      </div>
    );})}
  </div>);
}
function GroupEditor({gd,setGd,t}){
  const{title="GROUPE A",competition=""}=gd;
  const cats=[{key:"gk",label:"🧤 Gardiens"},{key:"def",label:"🛡 Défenseurs"},{key:"mid",label:"⚙️ Milieux"},{key:"fwd",label:"⚡ Attaquants"},{key:"coaches",label:"🧑‍💼 Staff"}];
  function add(key){setGd(d=>({...d,[key]:[...(d[key]||[]),{id:Date.now(),name:"",number:""}]}));}
  function remove(key,id){setGd(d=>({...d,[key]:(d[key]||[]).filter(p=>p.id!==id)}));}
  function update(key,id,f,v){setGd(d=>({...d,[key]:(d[key]||[]).map(p=>p.id===id?{...p,[f]:v}:p)}));}
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
      <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Titre</div><TInput value={title} onChange={v=>setGd(d=>({...d,title:v}))} placeholder="GROUPE A" t={t}/></div>
      <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Compétition</div><TInput value={competition} onChange={v=>setGd(d=>({...d,competition:v}))} placeholder="Ligue 1..." t={t}/></div>
    </div>
    {cats.map(cat=>{const list=gd[cat.key]||[];return(<div key={cat.key} style={{marginBottom:8,background:t.bg3,borderRadius:8,padding:"8px 10px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,color:t.text,fontWeight:600}}>{cat.label} ({list.length})</span><button onClick={()=>add(cat.key)} style={{fontSize:10,color:t.accent,background:`${t.accent}18`,border:`1px solid ${t.accent}44`,borderRadius:5,padding:"2px 6px",cursor:"pointer"}}>+</button></div>
      {list.map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
        <input value={p.number||""} onChange={e=>update(cat.key,p.id,"number",e.target.value)} placeholder="#" style={{width:28,background:t.bg2,border:`1px solid ${t.border}`,borderRadius:4,padding:"2px 4px",color:t.text,fontSize:11,outline:"none"}}/>
        <input value={p.name||""} onChange={e=>update(cat.key,p.id,"name",e.target.value)} placeholder="Nom" style={{flex:1,background:t.bg2,border:`1px solid ${t.border}`,borderRadius:4,padding:"2px 6px",color:t.text,fontSize:11,outline:"none"}}/>
        <button onClick={()=>remove(cat.key,p.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:12}}>✕</button>
      </div>))}
    </div>);})}
  </div>);
}
function DragCanvas({layers,setLayers,bgUrl,playerUrl,logoUrl,logo2Url,accent,accent2}){
  const cvRef=useRef(null);const dragRef=useRef(null);const[sel,setSel]=useState(null);const selL=layers.find(l=>l.id===sel);
  const onMD=useCallback((e,id)=>{const l=layers.find(x=>x.id===id);if(!l||l.locked)return;e.preventDefault();e.stopPropagation();setSel(id);const rect=cvRef.current.getBoundingClientRect();dragRef.current={id,ox:l.x,oy:l.y,mx0:(e.clientX-rect.left)/rect.width*100,my0:(e.clientY-rect.top)/rect.height*100};},[layers]);
  const onMM=useCallback(e=>{if(!dragRef.current||!cvRef.current)return;const rect=cvRef.current.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*100,my=(e.clientY-rect.top)/rect.height*100;const dx=mx-dragRef.current.mx0,dy=my-dragRef.current.my0;setLayers(prev=>prev.map(l=>l.id===dragRef.current.id?{...l,x:Math.max(0,Math.min(90,dragRef.current.ox+dx)),y:Math.max(0,Math.min(95,dragRef.current.oy+dy))}:l));},[setLayers]);
  const onMU=useCallback(()=>{dragRef.current=null;},[]);
  function upd(f,v){setLayers(p=>p.map(l=>l.id===sel?{...l,[f]:v}:l));}
  function delSel(){if(!selL||selL.locked)return;setLayers(p=>p.filter(l=>l.id!==sel));setSel(null);}
  const iS={background:"#1a1a26",border:"1px solid #3a3a55",borderRadius:6,padding:"5px 7px",color:"#f1f5f9",fontSize:11,outline:"none",boxSizing:"border-box"};
  const sorted=[...layers].sort((a,b)=>a.z-b.z);
  function layerHit(e){const rect=cvRef.current.getBoundingClientRect();const mx=(e.clientX-rect.left)/rect.width*100,my=(e.clientY-rect.top)/rect.height*100;const candidates=[...layers].filter(l=>!l.locked&&mx>=l.x&&mx<=l.x+l.w&&my>=l.y&&my<=l.y+l.h).sort((a,b)=>b.z-a.z);if(candidates.length)setSel(candidates[0].id);else setSel(null);}
  const isText=selL&&(selL.type==="text"||selL.type==="watertext"||selL.type==="badge");
  return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#040407",padding:16,gap:10}}>
      <div ref={cvRef} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU} onClick={layerHit} style={{width:270,height:480,position:"relative",overflow:"hidden",borderRadius:14,border:"1px solid #2a2a40",background:"#111",cursor:"default",userSelect:"none",flexShrink:0}}>
        {sorted.map(lay=><LayerView key={lay.id} lay={lay} bgUrl={bgUrl} playerUrl={playerUrl} logoUrl={logoUrl} logo2Url={logo2Url} accent={accent} accent2={accent2} isSel={sel===lay.id} onMD={onMD}/>)}
      </div>
      <div style={{fontSize:11,color:"#475569"}}>Cliquez · Glissez pour déplacer</div>
    </div>
    <div style={{width:210,background:"#12121a",borderLeft:"1px solid #2a2a40",overflowY:"auto",padding:10,flexShrink:0}}>
      <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Calques</div>
      <div style={{marginBottom:12}}>{[...sorted].reverse().map(lay=>(<div key={lay.id} onClick={()=>setSel(lay.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 6px",borderRadius:6,marginBottom:2,background:sel===lay.id?"#7c3aed22":"#1a1a26",border:`1px solid ${sel===lay.id?"#7c3aed":"#2a2a40"}`,cursor:"pointer"}}><span style={{fontSize:10,color:"#f1f5f9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lay.label}</span></div>))}</div>
      {selL&&!selL.locked&&(<div>
        <div style={{fontSize:10,color:"#64748b",marginBottom:6}}>✏️ {selL.label}</div>
        {isText&&<div style={{marginBottom:6}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Texte</div><textarea value={selL.text||""} onChange={e=>upd("text",e.target.value)} rows={2} style={{...iS,width:"100%",resize:"vertical"}}/></div>}
        {selL.type==="text"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}><div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Taille</div><input type="number" value={selL.fontSize||16} onChange={e=>upd("fontSize",+e.target.value||16)} style={{...iS,width:"100%"}}/></div><div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Couleur</div><input type="color" value={selL.color?.startsWith("rgba")?"#ffffff":selL.color||"#ffffff"} onChange={e=>upd("color",e.target.value)} style={{width:"100%",height:30,borderRadius:5,border:"1px solid #3a3a55",background:"#1a1a26",cursor:"pointer",padding:2}}/></div></div>}
        {(selL.type==="scoreblock"||selL.type==="scorebig")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:6}}><div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Nous</div><input value={selL.scoreHome||"0"} onChange={e=>upd("scoreHome",e.target.value)} style={{...iS,width:"100%"}}/></div><div><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Eux</div><input value={selL.scoreAway||"0"} onChange={e=>upd("scoreAway",e.target.value)} style={{...iS,width:"100%"}}/></div></div>}
        {selL.type==="overlay"&&<div style={{marginBottom:6}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>Opacité</div><input type="range" min={0} max={100} value={selL.opacity||60} onChange={e=>upd("opacity",+e.target.value)} style={{width:"100%"}}/></div>}
        <div style={{marginBottom:6}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>X / Y (%)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><input type="number" value={Math.round(selL.x)} onChange={e=>upd("x",+e.target.value)} style={{...iS}}/><input type="number" value={Math.round(selL.y)} onChange={e=>upd("y",+e.target.value)} style={{...iS}}/></div></div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:"#64748b",marginBottom:2}}>W / H (%)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><input type="number" value={Math.round(selL.w)} onChange={e=>upd("w",+e.target.value)} style={{...iS}}/><input type="number" value={Math.round(selL.h)} onChange={e=>upd("h",+e.target.value)} style={{...iS}}/></div></div>
        <button onClick={delSel} style={{width:"100%",background:"#450a0a",color:"#fca5a5",border:"1px solid #7f1d1d",borderRadius:7,padding:"5px",fontSize:11,cursor:"pointer"}}>🗑 Supprimer</button>
      </div>)}
    </div>
  </div>);
}
// ── APP ───────────────────────────────────────────────────────
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
  const[selPlayerId,setSelPlayerId]=useState(null);const[selPhotoUrl,setSelPhotoUrl]=useState(null);
  const[lineupData,setLineupData]=useState({formation:"4-4-2",starters:[],subs:[],opponent:"",competition:""});
  const[groupData,setGroupData]=useState({title:"GROUPE A",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
  const[lineupTpl,setLineupTpl]=useState("lt_dark");
  const[saveFlash,setSaveFlash]=useState(false);
  const mediaRef=useRef();
  const t=useMemo(()=>buildTheme(club?.color1,club?.color2,club?.theme_mode||"dark"),[club]);
  // ── LOAD DATA ───────────────────────────────────────────────
  useEffect(()=>{
    if(!session)return;
    async function load(){
      setLoading(true);
      const uid=session.user.id;
      // Club
      let{data:clubData}=await supabase.from("clubs").select("*").eq("user_id",uid).single();
      if(!clubData){
        const{data:newClub}=await supabase.from("clubs").insert({user_id:uid,name:"Mon Club",approved:false}).select().single();
        clubData=newClub;
      }
      if(!clubData?.approved){
        await supabase.auth.signOut();
        return;
      }
      setClub(clubData);
      // Players with photos
      const{data:playersData}=await supabase.from("players").select("*, photos:player_photos(*)").eq("club_id",clubData.id);
      setPlayers(playersData||[]);
      // Media
      const{data:mediaData}=await supabase.from("media").select("*").eq("club_id",clubData.id);
      setMedia(mediaData||[]);
      // Visuals
      const{data:visualsData}=await supabase.from("visuals").select("*").eq("club_id",clubData.id).order("created_at",{ascending:false});
      setHistory((visualsData||[]).map(v=>({...v,layers:v.layers||[],lineupData:v.lineup_data||{},groupData:v.group_data||{},lineupTpl:v.lineup_tpl,groupTpl:v.group_tpl,bgUrl:v.bg_url,logoUrl:v.logo_url,logo2Url:v.logo2_url,playerUrl:v.player_url,ct:CONTENT_TYPES.find(c=>c.id===v.type)})));
      setLoading(false);
    }
    load();
  },[session]);
  // ── CLUB UPDATE ─────────────────────────────────────────────
  async function updateClub(patch){
    const updated={...club,...patch};
    setClub(updated);
    await supabase.from("clubs").update(patch).eq("id",club.id);
  }
  // ── PLAYERS ─────────────────────────────────────────────────
  async function addPlayer(){
    if(!pName.trim())return;
    const{data}=await supabase.from("players").insert({club_id:club.id,name:pName.trim(),number:pNum,position:pPos}).select("*, photos:player_photos(*)").single();
    if(data)setPlayers(p=>[...p,data]);
    setPName("");setPNum("");
  }
  async function deletePlayer(id){
    await supabase.from("players").delete().eq("id",id);
    setPlayers(p=>p.filter(x=>x.id!==id));
  }
  async function addPhoto(playerId,file){
    const reader=new FileReader();
    reader.onload=async(e)=>{
      const url=e.target.result;
      const{data}=await supabase.from("player_photos").insert({player_id:playerId,url,name:file.name,is_fav:false}).select().single();
      if(data)setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:[...(p.photos||[]),data]}:p));
    };
    reader.readAsDataURL(file);
  }
  async function toggleFav(playerId,photoId){
    const player=players.find(p=>p.id===playerId);
    const photo=player?.photos?.find(ph=>ph.id===photoId);
    if(!photo)return;
    await supabase.from("player_photos").update({is_fav:!photo.is_fav}).eq("id",photoId);
    setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,photos:p.photos.map(ph=>ph.id===photoId?{...ph,is_fav:!ph.is_fav}:ph)}:p));
  }
  // ── MEDIA ───────────────────────────────────────────────────
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
  async function deleteMedia(id){
    await supabase.from("media").delete().eq("id",id);
    setMedia(m=>m.filter(x=>x.id!==id));
  }
  // ── VISUALS ─────────────────────────────────────────────────
  function openCreate(type,fromH=null){
    setSelType(type);setNav("create");
    if(fromH){
      setEditId(fromH.id);setBgUrl(fromH.bgUrl||null);setLogoUrl(fromH.logoUrl||null);setLogo2Url(fromH.logo2Url||null);
      setSelPhotoUrl(fromH.playerUrl||null);setSelPlayerId(null);
      if(fromH.layers)setLayers(fromH.layers);
      if(fromH.lineupData)setLineupData(fromH.lineupData);
      if(fromH.groupData)setGroupData(fromH.groupData);
      if(fromH.lineupTpl)setLineupTpl(fromH.lineupTpl);
    } else {
      setEditId(null);setBgUrl(null);setLogoUrl(club?.logo_url||null);setLogo2Url(null);
      setSelPlayerId(null);setSelPhotoUrl(null);
      if(type!=="lineup"&&type!=="group")setLayers(makeLayers(type,club?.color1||"#7c3aed",club?.color2||"#a855f7"));
      if(type==="lineup")setLineupData({formation:"4-4-2",starters:[],subs:[],opponent:"",competition:""});
      if(type==="group")setGroupData({title:"GROUPE A",competition:"",gk:[],def:[],mid:[],fwd:[],coaches:[]});
    }
  }
  async function save(){
    const ct=CONTENT_TYPES.find(c=>c.id===selType);
    const payload={
      club_id:club.id,type:selType,label:ct?.label||"",icon:ct?.icon||"",
      layers,lineup_data:lineupData,group_data:groupData,
      lineup_tpl:lineupTpl,group_tpl:"gt_gfa",
      bg_url:bgUrl,logo_url:logoUrl,logo2_url:logo2Url,player_url:selPhotoUrl,
      updated_at:new Date().toISOString()
    };
    let saved;
    if(editId){
      const{data}=await supabase.from("visuals").update(payload).eq("id",editId).select().single();
      saved=data;
      setHistory(h=>h.map(x=>x.id===editId?{...saved,layers:saved.layers||[],lineupData:saved.lineup_data||{},groupData:saved.group_data||{},lineupTpl:saved.lineup_tpl,bgUrl:saved.bg_url,logoUrl:saved.logo_url,logo2Url:saved.logo2_url,playerUrl:saved.player_url,ct}:x));
    } else {
      const{data}=await supabase.from("visuals").insert(payload).select().single();
      saved=data;
      if(saved)setHistory(h=>[{...saved,layers:saved.layers||[],lineupData:saved.lineup_data||{},groupData:saved.group_data||{},lineupTpl:saved.lineup_tpl,bgUrl:saved.bg_url,logoUrl:saved.logo_url,logo2Url:saved.logo2_url,playerUrl:saved.player_url,ct},...h]);
    }
    if(saved)setEditId(saved.id);
    setSaveFlash(true);setTimeout(()=>setSaveFlash(false),1800);
  }
  async function deleteVisual(id){
    await supabase.from("visuals").delete().eq("id",id);
    setHistory(h=>h.filter(x=>x.id!==id));
  }
  async function signOut(){
    await supabase.auth.signOut();
  }
  if(loading)return(
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0f",color:"#64748b",fontFamily:"system-ui"}}>
      Chargement de vos données...
    </div>
  );
  const card={background:t.bg2,border:`1px solid ${t.border}`,borderRadius:12,padding:20};
  const fl={fontSize:11,color:t.text3,marginBottom:5,display:"block"};
  function SaveBtn(){return(<button onClick={save} style={{background:saveFlash?"#16a34a":t.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",transition:"background .3s"}}>{saveFlash?"✅ Sauvegardé !":"✨ Sauvegarder"}</button>);}
  function renderSpecial(){
    const isL=selType==="lineup";
    return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:260,background:t.bg2,borderRight:`1px solid ${t.border}`,overflowY:"auto",padding:12,flexShrink:0}}>
        <BackBtn onClick={()=>setSelType(null)} t={t}/>
        <div style={{background:t.bg3,borderRadius:10,padding:10,marginBottom:10}}>
          <div style={{fontSize:11,color:t.text3,marginBottom:6}}>Image de fond</div>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.slice(0,6).map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:`2px solid ${bgUrl===m.url?t.accent:t.border}`,cursor:"pointer"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <UpBtn value={null} onChange={v=>setBgUrl(v)} w={48} h={34} r={6} label="Upload" t={t}/>
        </div>
        <div style={{background:t.bg3,borderRadius:10,padding:10,marginBottom:10}}>
          <div style={{fontSize:11,color:t.text3,marginBottom:8}}>Logos</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Club</div><UpBtn value={logoUrl} onChange={setLogoUrl} w={48} h={48} r={8} label="Logo" t={t}/></div>
            <div><div style={{fontSize:10,color:t.text3,marginBottom:3}}>Adversaire</div><UpBtn value={logo2Url} onChange={setLogo2Url} w={48} h={48} r={8} label="Logo" t={t}/></div>
          </div>
        </div>
        <div style={{background:t.bg3,borderRadius:10,padding:10,marginBottom:10}}>{isL?<LineupEditor ld={lineupData} setLd={setLineupData} players={players} t={t}/>:<GroupEditor gd={groupData} setGd={setGroupData} t={t}/>}</div>
        <SaveBtn/>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#040407",flexDirection:"column",gap:12}}>
        {isL?<LineupRender ld={lineupData} tpl={lineupTpl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={t.accent} accent2={t.accent2} bgUrl={bgUrl}/>:<GroupRender gd={groupData} tpl="gt_gfa" logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={t.accent} accent2={t.accent2} bgUrl={bgUrl}/>}
        <div style={{fontSize:11,color:"#475569"}}>Aperçu live</div>
      </div>
    </div>);
  }
  function renderStandard(){
    const player=players.find(p=>p.id===selPlayerId);
    const photos=player?[...(player.photos||[])].sort((a,b)=>(b.is_fav?1:0)-(a.is_fav?1:0)):[];
    return(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{width:244,background:t.bg2,borderRight:`1px solid ${t.border}`,overflowY:"auto",padding:14,flexShrink:0}}>
        <BackBtn onClick={()=>setSelType(null)} t={t}/>
        <div style={{background:t.bg3,borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:11,color:t.text3,marginBottom:5}}>Joueur</div>
          <TSelect value={selPlayerId||""} onChange={v=>{setSelPlayerId(v||null);if(v){const p=players.find(x=>x.id===v);setSelPhotoUrl(getPlayerPhoto(p)||null);}else setSelPhotoUrl(null);}} t={t} options={[{v:"",l:"Sélectionner..."},...players.map(p=>({v:p.id,l:`${p.name} #${p.number}`}))]}/>
          {player&&(<div style={{marginTop:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:11,color:t.text3}}>{photos.length} photo{photos.length!==1?"s":""}</span><label style={{fontSize:11,color:t.accent,background:`${t.accent}18`,border:`1px solid ${t.accent}44`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>+ Photo<input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>[...e.target.files].forEach(f=>addPhoto(selPlayerId,f))}/></label></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
              {photos.map(ph=>(<div key={ph.id} onClick={()=>setSelPhotoUrl(ph.url)} style={{position:"relative",borderRadius:6,overflow:"hidden",border:`2px solid ${selPhotoUrl===ph.url?t.accent:t.border}`,cursor:"pointer",aspectRatio:"3/4"}}><img src={ph.url} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt=""/><div onClick={e=>{e.stopPropagation();toggleFav(selPlayerId,ph.id);}} style={{position:"absolute",top:2,right:2,fontSize:12,background:"rgba(0,0,0,.55)",borderRadius:3,padding:"1px 2px",cursor:"pointer"}}>{ph.is_fav?"⭐":"☆"}</div></div>))}
            </div>
          </div>)}
        </div>
        <div style={{background:t.bg3,borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:11,color:t.text3,marginBottom:6}}>Image de fond</div>
          {media.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:8}}>{media.map((m,i)=>(<div key={i} onClick={()=>setBgUrl(m.url)} style={{aspectRatio:"16/9",borderRadius:5,overflow:"hidden",border:`2px solid ${bgUrl===m.url?t.accent:t.border}`,cursor:"pointer"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>))}</div>}
          <UpBtn value={null} onChange={v=>setBgUrl(v)} w={48} h={34} r={6} label="Upload fond" t={t}/>
        </div>
        <div style={{background:t.bg3,borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:11,color:t.text3,marginBottom:8}}>Logos</div>
          <div style={{display:"grid",gridTemplateColumns:(selType==="result"||selType==="match")?"1fr 1fr":"1fr",gap:8}}>
            <div><div style={{fontSize:10,color:t.text3,marginBottom:4}}>Club</div><UpBtn value={logoUrl} onChange={setLogoUrl} w={48} h={48} r={8} label="Logo" t={t}/></div>
            {(selType==="result"||selType==="match")&&<div><div style={{fontSize:10,color:t.text3,marginBottom:4}}>Adversaire</div><UpBtn value={logo2Url} onChange={setLogo2Url} w={48} h={48} r={8} label="Logo ADV" t={t}/></div>}
          </div>
        </div>
        <SaveBtn/>
      </div>
      <DragCanvas layers={layers} setLayers={setLayers} bgUrl={bgUrl} playerUrl={selPhotoUrl} logoUrl={logoUrl||club?.logo_url} logo2Url={logo2Url} accent={t.accent} accent2={t.accent2}/>
    </div>);
  }
  return(
    <div style={{height:"100vh",display:"flex",background:t.bg,color:t.text,fontFamily:"system-ui,sans-serif",fontSize:13,overflow:"hidden"}}>
      {/* SIDEBAR */}
      <div style={{width:188,background:t.sidebar||t.bg2,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"14px 14px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
          {club?.logo_url?<img src={club.logo_url} style={{width:30,height:30,objectFit:"contain",borderRadius:6}} alt=""/>:<div style={{width:30,height:30,borderRadius:6,background:`linear-gradient(135deg,${t.accent},${t.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{club?.name?.[0]||"E"}</div>}
          <div style={{overflow:"hidden"}}><div style={{fontSize:14,fontWeight:700,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{club?.name||"EXPOsia"}</div><div style={{fontSize:10,color:t.text3}}>Créateur de visuels</div></div>
        </div>
        <div style={{padding:"10px 8px",flex:1}}>{NAV.map(n=>(<button key={n.id} onClick={()=>{setNav(n.id);if(n.id!=="create")setSelType(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:nav===n.id?`${t.accent}22`:"transparent",border:"none",borderLeft:nav===n.id?`3px solid ${t.accent}`:"3px solid transparent",borderRadius:8,padding:"9px 10px",color:nav===n.id?t.text:t.text2,cursor:"pointer",fontSize:13,marginBottom:2,textAlign:"left"}}><span>{n.icon}</span>{n.label}</button>))}</div>
        <div style={{padding:"12px",borderTop:`1px solid ${t.border}`,display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>openCreate("goal")} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:500,cursor:"pointer",width:"100%"}}>✨ Créer</button>
          <button onClick={signOut} style={{background:"transparent",color:t.text3,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px",fontSize:11,cursor:"pointer",width:"100%"}}>Déconnexion</button>
        </div>
      </div>
      {/* MAIN */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {nav==="home"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:4,color:t.text}}>Créer un visuel</h2>
          <p style={{color:t.text3,marginBottom:24}}>Bienvenue, {club?.name} 👋</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>{CONTENT_TYPES.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:12,padding:20,textAlign:"center",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.background=`${t.accent}11`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.background=t.bg2;}}><div style={{fontSize:30,marginBottom:10}}>{c.icon}</div><div style={{fontWeight:600,color:t.accent,fontSize:13}}>{c.label}</div></div>))}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>{[[history.length,"Visuels","⚽"],[players.length,"Joueurs","👥"],[media.length,"Médias","🖼️"],["∞","Templates","🎨"]].map(([v,l,i])=>(<div key={l} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:10,padding:14,textAlign:"center"}}><div>{i}</div><div style={{fontSize:22,fontWeight:700,color:t.accent,marginTop:4}}>{v}</div><div style={{fontSize:11,color:t.text3}}>{l}</div></div>))}</div>
        </div>)}
        {nav==="club"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:600,marginBottom:20,color:t.text}}>Mon Club</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,maxWidth:640}}>
            <div style={card}><label style={fl}>Nom du club</label><TInput value={club?.name||""} onChange={v=>updateClub({name:v})} placeholder="FC Mon Club" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"14px 0"}}><div><label style={fl}>Couleur principale</label><input type="color" value={club?.color1||"#7c3aed"} onChange={e=>updateClub({color1:e.target.value})} style={{width:"100%",height:38,borderRadius:7,border:`1px solid ${t.border2}`,background:t.bg3,cursor:"pointer",padding:3}}/></div><div><label style={fl}>Couleur secondaire</label><input type="color" value={club?.color2||"#a855f7"} onChange={e=>updateClub({color2:e.target.value})} style={{width:"100%",height:38,borderRadius:7,border:`1px solid ${t.border2}`,background:t.bg3,cursor:"pointer",padding:3}}/></div></div><div style={{height:22,borderRadius:6,background:`linear-gradient(90deg,${club?.color1||"#7c3aed"},${club?.color2||"#a855f7"})`,marginBottom:14}}/><p style={{fontSize:11,color:t.text3,marginTop:0}}>Sauvegardé en temps réel ✅</p></div>
            <div style={card}><label style={fl}>Logo du club</label><UpBtn value={club?.logo_url} onChange={v=>updateClub({logo_url:v})} w={90} h={90} r={12} label="Cliquez pour uploader" t={t}/>{club?.logo_url&&<p style={{fontSize:11,color:t.text3,marginTop:10}}>Logo configuré ✅</p>}</div>
          </div>
        </div>)}
        {nav==="players"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:600,marginBottom:20,color:t.text}}>Joueurs & Photos</h2>
          <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:20}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Ajouter un joueur</div><label style={fl}>Nom complet</label><TInput value={pName} onChange={setPName} placeholder="Prénom Nom" t={t}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0"}}><div><label style={fl}>Numéro</label><TInput value={pNum} onChange={setPNum} placeholder="9" type="number" t={t}/></div><div><label style={fl}>Poste</label><TSelect value={pPos} onChange={setPPos} t={t} options={POSITIONS}/></div></div><button onClick={addPlayer} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:13,cursor:"pointer",width:"100%"}}>+ Ajouter</button></div>
            <div><div style={{fontSize:13,color:t.text2,marginBottom:12}}>Effectif — {players.length} joueur{players.length!==1?"s":""}</div>
              {players.length===0?<div style={{...card,color:t.text3,textAlign:"center",padding:"40px 0"}}>Aucun joueur</div>:(<div style={{display:"flex",flexDirection:"column",gap:8}}>{players.map(p=>{const fav=(p.photos||[]).find(ph=>ph.is_fav)||(p.photos||[])[0];return(<div key={p.id} style={{...card,display:"flex",alignItems:"center",gap:12,padding:"12px 16px"}}><Av photo={fav?.url} name={p.name} size={44}/><div style={{flex:1}}><div style={{fontWeight:600,color:t.text}}>{p.name}</div><div style={{fontSize:11,color:t.text3}}>{p.position} · #{p.number} · {(p.photos||[]).length} photo{(p.photos||[]).length!==1?"s":""}</div></div><button onClick={()=>deletePlayer(p.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:16}}>✕</button></div>);})}</div>)}
            </div>
          </div>
        </div>)}
        {nav==="media"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:600,marginBottom:6,color:t.text}}>Médiathèque</h2>
          <p style={{color:t.text3,marginBottom:20}}>Fonds, stades, ambiances</p>
          <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:20}}>
            <div style={card}><div onClick={()=>mediaRef.current.click()} style={{border:`2px dashed ${t.border2}`,borderRadius:10,padding:22,textAlign:"center",cursor:"pointer",background:t.bg3}}><div style={{fontSize:24,marginBottom:6}}>📁</div><div style={{fontSize:13,color:t.text2}}>Uploader</div></div><input ref={mediaRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={pickMedia}/></div>
            <div>{media.length===0?<div style={{...card,color:t.text3,textAlign:"center",padding:"40px 0"}}>Uploadez vos fonds...</div>:(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{media.map(m=>(<div key={m.id} style={{borderRadius:10,overflow:"hidden",border:`1px solid ${t.border}`}}><div style={{aspectRatio:"16/9",overflow:"hidden"}}><img src={m.url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div><div style={{padding:"5px 8px",fontSize:11,color:t.text2,background:t.bg2,display:"flex",justifyContent:"space-between"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80%"}}>{m.name}</span><button onClick={()=>deleteMedia(m.id)} style={{background:"none",border:"none",color:t.text3,cursor:"pointer"}}>✕</button></div></div>))}</div>)}</div>
          </div>
        </div>)}
        {nav==="create"&&(!selType?<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}><h2 style={{fontSize:20,fontWeight:600,marginBottom:20,color:t.text}}>Choisir un type</h2><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{CONTENT_TYPES.map(c=>(<div key={c.id} onClick={()=>openCreate(c.id)} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:12,padding:22,textAlign:"center",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}><div style={{fontSize:32,marginBottom:10}}>{c.icon}</div><div style={{fontWeight:600,color:t.accent,fontSize:14}}>{c.label}</div></div>))}</div></div>:(selType==="lineup"||selType==="group")?renderSpecial():renderStandard())}
        {nav==="history"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:600,marginBottom:6,color:t.text}}>Historique</h2>
          <p style={{color:t.text3,marginBottom:20}}>{history.length} visuel{history.length!==1?"s":""} sauvegardés dans le cloud ☁️</p>
          {history.length===0?<div style={{...card,color:t.text3,textAlign:"center",padding:"60px 0"}}>Créez votre premier visuel !</div>:(<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>{history.map(h=>(<div key={h.id} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden"}}><div style={{background:"#040407",padding:12,textAlign:"center",fontSize:28}}>{h.ct?.icon||"🖼️"}</div><div style={{padding:"10px 12px"}}><div style={{fontSize:12,fontWeight:600,color:t.text,marginBottom:6}}>{h.ct?.label}</div><div style={{display:"flex",gap:6}}><button onClick={()=>{openCreate(h.type,h);setNav("create");}} style={{flex:1,background:`${t.accent}22`,color:t.accent,border:`1px solid ${t.accent}44`,borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer"}}>↩ Modifier</button><button onClick={()=>deleteVisual(h.id)} style={{background:"#450a0a",color:"#fca5a5",border:"1px solid #7f1d1d",borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer"}}>🗑</button></div></div></div>))}</div>)}
        </div>)}
        {nav==="settings"&&(<div style={{padding:28,flex:1,overflowY:"auto",background:t.bg}}>
          <h2 style={{fontSize:20,fontWeight:600,marginBottom:20,color:t.text}}>Paramètres</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,maxWidth:640}}>
            <div style={card}><div style={{fontSize:11,color:t.text3,textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Thème</div>{[["dark","🌑 Dark","Interface sombre classique"],["club","🎨 Couleurs du club","Adapté à votre club"]].map(([mode,label,desc])=>(<div key={mode} onClick={()=>updateClub({theme_mode:mode})} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`2px solid ${(club?.theme_mode||"dark")===mode?t.accent:t.border}`,background:(club?.theme_mode||"dark")===mode?`${t.accent}14`:t.bg3,cursor:"pointer",marginBottom:10}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${t.accent}`,background:(club?.theme_mode||"dark")===mode?t.accent:"transparent",flexShrink:0}}/><div><div style={{fontSize:13,fontWeight:600,color:t.text}}>{label}</div><div style={{fontSize:11,color:t.text3,marginTop:2}}>{desc}</div></div></div>))}</div>
            <div style={{...card,display:"flex",flexDirection:"column",gap:10}}><div style={{fontSize:14,fontWeight:700,color:t.text}}>{club?.name}</div><div style={{fontSize:12,color:t.text3}}>{session.user.email}</div><div style={{fontSize:12,color:t.text3}}>{players.length} joueurs · {media.length} médias · {history.length} visuels</div><button onClick={signOut} style={{background:"#450a0a",color:"#fca5a5",border:"1px solid #7f1d1d",borderRadius:8,padding:"8px 14px",fontSize:12,cursor:"pointer",alignSelf:"flex-start"}}>Se déconnecter</button></div>
          </div>
        </div>)}
      </div>
    </div>
  );
}
