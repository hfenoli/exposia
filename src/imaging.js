// ─── IMAGING UTILS ────────────────────────────────────────────
// Compression automatique à l'upload + détourage adaptatif.
// Tout se fait côté client (canvas), aucune dépendance externe.

// Garde-fou : au-delà, le navigateur risque l'OOM au décodage. Ce n'est plus
// une limite "produit" (on compresse tout seul) mais une limite technique.
export const MAX_SOURCE_BYTES = 60 * 1024 * 1024;

// Cibles de compression par usage (en octets, sur le binaire, pas le base64).
export const PRESETS = {
  photo:  {maxDim:2000, targetBytes:  900*1024},  // photos de joueurs
  media:  {maxDim:2200, targetBytes: 1100*1024},  // fonds / ambiances
  logo:   {maxDim:1024, targetBytes:  350*1024},  // logos, sponsors
};

export function isImageFile(f){
  if(!f) return false;
  if(f.type && f.type.startsWith("image/")) return true;
  // Certains navigateurs ne renseignent pas le type pour HEIC/HEIF.
  return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name||"");
}

export function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    // Pas de crossOrigin sur les data: URL — ça déclenche un faux "tainted
    // canvas" sur iOS Safari < 16.
    if(typeof src==="string"&&!src.startsWith("data:")&&!src.startsWith("blob:")){
      img.crossOrigin="anonymous";
    }
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Image illisible"));
    img.src=src;
  });
}

export function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=e=>resolve(e.target.result);
    r.onerror=()=>reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}

// Taille binaire approximative d'une data URL base64.
export function dataUrlBytes(dataUrl){
  if(typeof dataUrl!=="string") return 0;
  const i=dataUrl.indexOf(",");
  const b64=i>=0?dataUrl.slice(i+1):dataUrl;
  const pad=b64.endsWith("==")?2:b64.endsWith("=")?1:0;
  return Math.max(0, Math.floor(b64.length*3/4)-pad);
}

export function formatBytes(n){
  if(!n) return "0 Ko";
  if(n<1024*1024) return Math.round(n/1024)+" Ko";
  return (n/(1024*1024)).toFixed(1).replace(".",",")+" Mo";
}

function makeCanvas(w,h){
  const c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(w));
  c.height=Math.max(1,Math.round(h));
  return c;
}

function supportsWebp(){
  try{
    const c=makeCanvas(1,1);
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  }catch{ return false; }
}

function hasTransparency(ctx,w,h){
  try{
    const d=ctx.getImageData(0,0,w,h).data;
    // Échantillonnage : 1 pixel sur 7 suffit pour détecter de l'alpha.
    for(let i=3;i<d.length;i+=28){ if(d[i]<250) return true; }
    return false;
  }catch{ return false; }
}

/**
 * Compresse un fichier image pour le stockage.
 * Redimensionne au plus grand côté `maxDim` puis descend la qualité jusqu'à
 * passer sous `targetBytes`. La transparence est préservée (WebP, sinon PNG).
 * @returns {Promise<{url:string, bytes:number, originalBytes:number, resized:boolean}>}
 */
export async function compressImageFile(file, preset){
  const opt=Object.assign({}, PRESETS.photo, typeof preset==="string"?PRESETS[preset]:preset);
  const originalBytes=file.size||0;
  if(originalBytes>MAX_SOURCE_BYTES){
    throw new Error("Fichier trop volumineux ("+formatBytes(originalBytes)+"). Maximum "+formatBytes(MAX_SOURCE_BYTES)+".");
  }
  const srcUrl=await fileToDataUrl(file);
  return compressDataUrl(srcUrl, opt, originalBytes);
}

/** Même compression, à partir d'une data URL déjà en mémoire. */
export async function compressDataUrl(srcUrl, preset, originalBytes){
  const opt=Object.assign({}, PRESETS.photo, typeof preset==="string"?PRESETS[preset]:preset);
  const orig=originalBytes==null?dataUrlBytes(srcUrl):originalBytes;
  const img=await loadImage(srcUrl);
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  if(!iw||!ih) throw new Error("Image illisible");

  let scale=Math.min(1, opt.maxDim/Math.max(iw,ih));
  // Déjà petite et déjà légère → on ne retouche pas (évite de recompresser un PNG net).
  if(scale===1 && orig<=opt.targetBytes){
    return {url:srcUrl, bytes:orig, originalBytes:orig, resized:false};
  }

  const webp=supportsWebp();
  for(let attempt=0;attempt<4;attempt++){
    const c=makeCanvas(iw*scale, ih*scale);
    const ctx=c.getContext("2d");
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,0,0,c.width,c.height);

    const alpha=hasTransparency(ctx,c.width,c.height);
    const mime=alpha?(webp?"image/webp":"image/png"):(webp?"image/webp":"image/jpeg");
    let best=null;
    if(mime==="image/png"){
      best=c.toDataURL("image/png");
    }else{
      for(const q of [0.9,0.82,0.74,0.66,0.58,0.5]){
        best=c.toDataURL(mime,q);
        if(dataUrlBytes(best)<=opt.targetBytes) break;
      }
    }
    const bytes=dataUrlBytes(best);
    if(bytes<=opt.targetBytes || attempt===3){
      return {url:best, bytes, originalBytes:orig, resized:true};
    }
    scale*=0.75; // encore trop lourd → on réduit la définition et on recommence
  }
  // Inatteignable, mais TypeScript-friendly.
  throw new Error("Compression impossible");
}

// ─── DÉTOURAGE ────────────────────────────────────────────────
// Le détourage précédent ne supprimait que les pixels quasi-blancs
// (moyenne > 220). Ici on détecte les vraies couleurs de fond en
// échantillonnant le pourtour, puis on propage depuis les bords
// (flood fill) : n'importe quel fond uni est retiré, et le sujet
// n'est jamais troué puisque seule la zone connectée aux bords part.

export const TOLERANCE_PRESETS = {low:26, normal:48, high:80};

// Distance couleur au carré (pondérée perceptuellement : l'œil est plus
// sensible au vert). On garde le carré pour éviter 4M de Math.sqrt.
function colorDist2(r1,g1,b1,r2,g2,b2){
  const dr=r1-r2, dg=g1-g2, db=b1-b2;
  return 0.9*dr*dr + 1.2*dg*dg + 0.7*db*db;
}

function drawToCanvas(img, maxDim){
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  // iOS Safari plafonne la surface canvas (~16 Mpx) : on borne le plus grand côté.
  const scale=Math.min(1,(maxDim||2048)/Math.max(iw,ih));
  const c=makeCanvas(iw*scale, ih*scale);
  const ctx=c.getContext("2d");
  if(!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(img,0,0,c.width,c.height);
  return {canvas:c, ctx};
}

/** Couleurs dominantes du pourtour de l'image (jusqu'à 3), en [r,g,b]. */
function borderRefs(data,w,h){
  const buckets=new Map();
  const add=(x,y)=>{
    const i=(y*w+x)*4;
    if(data[i+3]<128) return;
    const key=(data[i]>>4)+"_"+(data[i+1]>>4)+"_"+(data[i+2]>>4);
    const b=buckets.get(key);
    if(b){ b.n++; b.r+=data[i]; b.g+=data[i+1]; b.b+=data[i+2]; }
    else buckets.set(key,{n:1,r:data[i],g:data[i+1],b:data[i+2]});
  };
  const stepX=Math.max(1,Math.floor(w/220)), stepY=Math.max(1,Math.floor(h/220));
  for(let x=0;x<w;x+=stepX){ add(x,0); add(x,h-1); }
  for(let y=0;y<h;y+=stepY){ add(0,y); add(w-1,y); }
  const list=[...buckets.values()].sort((a,b)=>b.n-a.n).slice(0,3);
  const total=list.reduce((s,b)=>s+b.n,0)||1;
  return list
    .filter(b=>b.n/total>0.06)
    .map(b=>[b.r/b.n, b.g/b.n, b.b/b.n]);
}

/** Couleur de fond dominante d'une image, en hexadécimal (#rrggbb). */
export async function dominantBorderColor(src){
  const img=await loadImage(src);
  const {ctx,canvas}=drawToCanvas(img,320);
  const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const refs=borderRefs(d,canvas.width,canvas.height);
  const c=refs[0]||[255,255,255];
  return "#"+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
}

/** Rogne les marges entièrement transparentes d'un canvas. */
function trimTransparent(canvas,ctx){
  const w=canvas.width,h=canvas.height;
  const d=ctx.getImageData(0,0,w,h).data;
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      if(d[(y*w+x)*4+3]>8){
        if(x<minX)minX=x; if(x>maxX)maxX=x;
        if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
  }
  if(maxX<0||(minX===0&&minY===0&&maxX===w-1&&maxY===h-1)) return canvas;
  const nw=maxX-minX+1, nh=maxY-minY+1;
  const out=makeCanvas(nw,nh);
  out.getContext("2d").drawImage(canvas,minX,minY,nw,nh,0,0,nw,nh);
  return out;
}

/**
 * Détourage adaptatif : retire le fond uni (quelle que soit sa couleur) en
 * propageant depuis les bords de l'image.
 * @param {string} src           data URL ou URL de l'image
 * @param {object} [opts]
 * @param {number} [opts.tolerance=48]  tolérance couleur (0-140)
 * @param {boolean} [opts.trim=false]   rogner les marges vides après détourage
 * @param {number} [opts.maxDim=2048]   plus grand côté du rendu
 * @returns {Promise<{url:string, removedRatio:number}>}
 */
export async function removeBackground(src, opts){
  const o=Object.assign({tolerance:TOLERANCE_PRESETS.normal, trim:false, maxDim:2048}, opts||{});
  const img=await loadImage(src);
  const {canvas,ctx}=drawToCanvas(img,o.maxDim);
  const w=canvas.width,h=canvas.height;
  let imageData;
  try{ imageData=ctx.getImageData(0,0,w,h); }
  catch{ throw new Error("Image protégée (CORS) : impossible de la détourer."); }
  const data=imageData.data;

  const refs=borderRefs(data,w,h);
  if(refs.length===0) return {url:src, removedRatio:0};

  const tol2=o.tolerance*o.tolerance;
  const nearTol2=tol2*0.2;                          // proche-en-proche (fonds dégradés)
  const featherBand=Math.max(10,o.tolerance*0.7);   // transition anti-crénelage

  const distToRefs2=(r,g,b)=>{
    let best=Infinity;
    for(let k=0;k<refs.length;k++){
      const d=colorDist2(r,g,b,refs[k][0],refs[k][1],refs[k][2]);
      if(d<best) best=d;
    }
    return best;
  };

  // Flood fill 4-connexe depuis les bords. Un pixel n'est empilé que s'il est
  // déjà reconnu comme fond : le sujet n'est donc jamais troué, et seule la
  // zone connectée au pourtour disparaît.
  const n=w*h;
  const seen=new Uint8Array(n);
  const removed=new Uint8Array(n);
  const stack=new Int32Array(n);
  let sp=0, removedCount=0;
  function accept(idx){ seen[idx]=1; removed[idx]=1; removedCount++; stack[sp++]=idx; }
  function seed(idx){
    if(seen[idx]) return;
    const i=idx*4;
    if(distToRefs2(data[i],data[i+1],data[i+2])<=tol2) accept(idx); else seen[idx]=1;
  }
  for(let x=0;x<w;x++){ seed(x); seed((h-1)*w+x); }
  for(let y=0;y<h;y++){ seed(y*w); seed(y*w+w-1); }

  while(sp>0){
    const idx=stack[--sp];
    const i=idx*4;
    const r=data[i],g=data[i+1],b=data[i+2];
    const x=idx%w, y=(idx-x)/w;
    // Un voisin part s'il ressemble à une couleur de fond, ou s'il est très
    // proche du pixel courant (fonds légèrement dégradés / vignettés).
    const tryPush=(nx,ny)=>{
      if(nx<0||ny<0||nx>=w||ny>=h) return;
      const ni=ny*w+nx;
      if(seen[ni]) return;
      const j=ni*4;
      const nr=data[j],ng=data[j+1],nb=data[j+2];
      if(distToRefs2(nr,ng,nb)<=tol2||colorDist2(nr,ng,nb,r,g,b)<=nearTol2) accept(ni);
      else seen[ni]=1;
    };
    tryPush(x-1,y); tryPush(x+1,y); tryPush(x,y-1); tryPush(x,y+1);
  }

  const removedRatio=removedCount/n;

  // Application du masque + anti-crénelage sur la frontière.
  for(let idx=0;idx<n;idx++){
    const i=idx*4;
    if(removed[idx]){ data[i+3]=0; continue; }
    if(data[i+3]===0) continue;
    const x=idx%w, y=(idx-x)/w;
    const onEdge=(x>0&&removed[idx-1])||(x<w-1&&removed[idx+1])||(y>0&&removed[idx-w])||(y<h-1&&removed[idx+w]);
    if(!onEdge) continue;
    const d=Math.sqrt(distToRefs2(data[i],data[i+1],data[i+2]));
    const a=Math.max(0,Math.min(1,(d-o.tolerance)/featherBand));
    data[i+3]=Math.round(data[i+3]*a);
  }
  ctx.putImageData(imageData,0,0);

  const out=o.trim?trimTransparent(canvas,ctx):canvas;
  return {url:out.toDataURL("image/png"), removedRatio};
}
