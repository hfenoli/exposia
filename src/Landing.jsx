import { useState, useEffect } from "react";

// ─── PALETTE (thème clair) ────────────────────────────────────
const C = {
  bg:    "#FAFAFA",  // fond principal
  bgAlt: "#F4F4F2",  // sections alternées
  card:  "#FFFFFF",  // cartes/contraste léger
  tx:    "#0A0A0A",  // texte principal
  tx2:   "#3A3A3A",  // texte secondaire
  tx3:   "#666666",  // texte tertiaire
  tx4:   "#999999",  // texte muet
  bd:    "rgba(10,10,10,0.10)",  // bordure légère
  bdLite:"rgba(10,10,10,0.06)",  // bordure très légère
  bk:    "#0A0A0A",  // noir profond (mocks + CTAs)
  wh:    "#FAFAFA",  // blanc cassé (text sur noir)
};
const FONT_BODY = "'DM Sans', system-ui, sans-serif";
const FONT_H    = "'Bebas Neue', Impact, sans-serif";
const FONT_M    = "'DM Mono', ui-monospace, monospace";

// ─── CONTENT ──────────────────────────────────────────────────
const STATS = [
  { n: "18+", l: "Templates" },
  { n: "30s", l: "Par visuel" },
  { n: "∞",   l: "Sports" },
];
const TICKER = ["Studio visuel", "Football", "Basketball", "Rugby", "Hockey", "Handball", "30 secondes", "Professionnel", "Mobile first", "Suisse"];
const FEATURES = [
  { n: "01", t: "Templates Pro", d: "18 templates conçus pour le sport. Pas de compétences graphiques requises. Résultat professionnel garanti à chaque fois." },
  { n: "02", t: "30 Secondes",  d: "Depuis le bord du terrain. Ouvrez l'app, choisissez le type, exportez. Publié avant le coup de sifflet final." },
  { n: "03", t: "Vos Couleurs", d: "Logo, couleurs, joueurs — configurés une fois, appliqués automatiquement à chaque visuel créé pour votre club." },
];
const STEPS = [
  { n: "01", t: "Configurez votre club", d: "Logo, couleurs, effectif. Une seule fois, appliqué automatiquement à tous vos visuels." },
  { n: "02", t: "Choisissez un template", d: "But, score, composition, groupe, annonce — 7 types de visuels disponibles." },
  { n: "03", t: "Exportez et publiez", d: "PNG haute qualité directement dans vos photos. Prêt pour Instagram en un tap." },
];
const TEAM = [
  { nom: "Hugo Fenoli-Rebellato", role: "Co-fondateur", photo: "/team/hugo.jpg" },
  { nom: "Lucas Di Pasquale",     role: "Co-fondateur", photo: "/team/lucas.jpg" },
];
const FAQ_ITEMS = [
  { q: "Pour quels sports ?",                       a: "Tous les sports collectifs : football, basketball, hockey, rugby et plus. L'éditeur s'adapte aux compositions et formats de votre discipline." },
  { q: "Faut-il des compétences en design ?",       a: "Non. Vous configurez votre club une fois (logo, couleurs, joueurs), l'app fait le reste. Aucune connaissance graphique requise." },
  { q: "Ça marche sur téléphone ?",                 a: "Oui, l'app est pensée mobile. Installez-la sur votre écran d'accueil pour un accès en un tap, comme une vraie application." },
  { q: "Combien ça coûte ?",                        a: "Les tarifs sont sur demande selon la taille et les besoins du club. Contactez-nous pour discuter de l'offre adaptée." },
  { q: "Comment accéder ?",                         a: "L'accès est sur invitation. Envoyez-nous un message à contact@viziona-sport.com, on revient sous 24h." },
  { q: "Comment configurer mon club ?",             a: "Allez dans « Mon Club », uploadez votre logo, choisissez vos deux couleurs. Tout se met à jour automatiquement dans vos visuels." },
  { q: "Comment créer mon premier visuel ?",        a: "Cliquez sur « Créer », choisissez un type (ex : But), sélectionnez un joueur si besoin, puis cliquez sur Télécharger." },
  { q: "Comment ajouter mes joueurs ?",             a: "Section « Joueurs » → bouton « + Ajouter ». Nom, numéro, poste. Vous pouvez aussi uploader leur photo." },
  { q: "Le visuel se télécharge où ?",              a: "Directement dans vos photos sur iPhone et Android. Prêt à publier sur Instagram, WhatsApp ou Facebook." },
  { q: "Puis-je utiliser Viziona pour plusieurs équipes ?", a: "Oui, selon votre offre vous pouvez gérer plusieurs équipes avec des effectifs séparés." },
];

// ─── FONTS + STYLES INJECTION ─────────────────────────────────
const STYLE_ID = "viziona-landing-css";
const FONTS_ID = "viziona-landing-fonts";

function injectFontsAndStyles() {
  if (typeof document === "undefined") return;
  if (!document.getElementById(FONTS_ID)) {
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre1);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "anonymous";
    document.head.appendChild(pre2);
    const l = document.createElement("link");
    l.id = FONTS_ID;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes viz-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes viz-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes viz-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .viz-up { opacity: 0; animation: viz-up .6s ease forwards; }
      .viz-fade { opacity: 0; animation: viz-fade .8s ease .3s forwards; }
      .viz-ticker-in { display: inline-flex; gap: 52px; animation: viz-tick 32s linear infinite; }
      .viz-vcard:hover { transform: translateY(-2px); transition: transform .25s; }
      .viz-fc:hover { background: ${C.bgAlt} !important; }
      .viz-fc:hover .viz-fc-arr { color: ${C.tx} !important; transform: translate(2px,-2px) !important; }
      .viz-btn-main:hover { transform: translateY(-2px); opacity: 0.92; }
      .viz-btn-text:hover { color: ${C.tx} !important; }
      .viz-btn-text:hover .viz-btn-arr { transform: translate(2px,-2px); }
      .viz-cta-b:hover { transform: translateY(-2px); }
      .viz-nav-link:hover { color: ${C.tx} !important; }
      .viz-faq-btn:hover { color: ${C.tx} !important; }
      .viz-grain {
        position: fixed; inset: 0; pointer-events: none; z-index: 999;
        opacity: 0.35; mix-blend-mode: multiply;
        background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/></svg>");
      }
      @media (max-width: 900px) {
        .viz-hero { grid-template-columns: 1fr !important; }
        .viz-hero-left { padding: 100px 24px 60px !important; border-right: none !important; }
        .viz-hero-right { padding: 0 24px 60px !important; }
        .viz-feat-grid { grid-template-columns: 1fr !important; }
        .viz-how { grid-template-columns: 1fr !important; }
        .viz-how-l { border-right: none !important; padding: 80px 24px !important; }
        .viz-how-r { padding: 40px 24px 80px !important; }
        .viz-cta-w { grid-template-columns: 1fr !important; padding: 56px 28px !important; margin: 0 24px 80px !important; }
        .viz-nav { padding: 0 24px !important; }
        .viz-nav-links { gap: 14px !important; }
        .viz-features { padding: 80px 24px !important; }
        .viz-footer { padding: 24px !important; flex-direction: column !important; gap: 20px !important; text-align: center !important; }
        .viz-section { padding: 72px 24px !important; }
        .viz-team-row { flex-direction: column !important; align-items: flex-start !important; }
        .viz-hero-h1 { font-size: clamp(64px, 14vw, 100px) !important; }
        .viz-hero-stats { gap: 28px !important; flex-wrap: wrap !important; }
        .viz-nav-hide { display: none !important; }
        .viz-about { grid-template-columns: 1fr !important; padding: 80px 24px !important; }
      }
    `;
    document.head.appendChild(s);
  }
}

// ─── LOGO ─────────────────────────────────────────────────────
function VLogo({ size = 26, color }) {
  const c = color || C.tx;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path d="M2 4L13 22L24 4" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M7.5 4L13 15L18.5 4" stroke={c} strokeWidth="1.5" strokeLinecap="square" opacity="0.32"/>
    </svg>
  );
}

// ─── PLAYER SILHOUETTE SVG ────────────────────────────────────
function PlayerSilhouette({ color = "#fff", opacity = 0.18 }) {
  return (
    <svg viewBox="0 0 80 110" style={{ width: "100%", height: "100%", opacity }} preserveAspectRatio="xMidYMax meet">
      <circle cx="40" cy="22" r="14" fill={color}/>
      <path d="M10 110 Q10 55 40 55 Q70 55 70 110 Z" fill={color}/>
    </svg>
  );
}

// ─── SECTION HEAD ─────────────────────────────────────────────
function SHead({ tag, h2_a, h2_b, counter }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 72, paddingBottom: 36, borderBottom: "1px solid " + C.bdLite, gap: 24, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>{tag}</div>
        <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
          {h2_a}<br/>
          <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>{h2_b}</em>
        </h2>
      </div>
      {counter && <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.1em" }}>{counter}</span>}
    </div>
  );
}

// ─── CTA LABEL ────────────────────────────────────────────────
const CTA_LABEL = "Accéder / Demander l'accès";

// ─── MAIN ─────────────────────────────────────────────────────
export default function Landing({ onEnter }) {
  const [openFaq, setOpenFaq] = useState(null);
  useEffect(() => { injectFontsAndStyles(); }, []);
  const handleEnter = (mode) => (e) => { if (e) e.preventDefault(); if (onEnter) onEnter(mode); };

  return (
    <div style={{ background: C.bg, color: C.tx, fontFamily: FONT_BODY, overflowX: "hidden", minHeight: "100vh", position: "relative" }}>
      <div className="viz-grain" aria-hidden="true"/>

      {/* ─── NAV ─── */}
      <nav className="viz-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 60, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 52px", borderBottom: "1px solid " + C.bdLite, background: "rgba(250,250,250,0.85)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <a href="#" onClick={(e)=>e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <VLogo size={26}/>
          <span style={{ fontFamily: FONT_H, fontSize: 19, letterSpacing: "0.16em", color: C.tx }}>Viziona</span>
        </a>
        <div className="viz-nav-links" style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <a href="#about"    className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>À propos</a>
          <a href="#features" className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Fonctionnalités</a>
          <a href="#how"      className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Comment</a>
          <a href="#pricing"  className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Tarifs</a>
          <a href="#" onClick={handleEnter("login")} className="viz-btn-text" style={{ padding: "9px 18px", border: "1px solid " + C.bk, color: C.bk, borderRadius: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", transition: "all .2s" }}>Se connecter</a>
          <a href="#" onClick={handleEnter("signup")} className="viz-btn-main" style={{ background: C.bk, color: C.wh, padding: "9px 22px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", transition: "transform .2s, opacity .2s" }}>Demander l'accès</a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="viz-hero" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "55% 45%", paddingTop: 60, position: "relative" }}>
        <div className="viz-hero-left" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "80px 52px", borderRight: "1px solid " + C.bdLite, position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", bottom: 60, right: -40, fontFamily: FONT_H, fontSize: 320, lineHeight: 1, color: "rgba(10,10,10,0.045)", letterSpacing: "-0.02em", pointerEvents: "none", zIndex: 0, whiteSpace: "nowrap" }}>30s</span>
          <span className="viz-up" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.22em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 12, marginBottom: 28, position: "relative", zIndex: 1, animationDelay: ".1s" }}>
            <span style={{ width: 28, height: 1, background: C.tx3 }}/>
            Studio visuel · Tous les sports
          </span>
          <h1 className="viz-up viz-hero-h1" style={{ fontFamily: FONT_H, fontSize: "clamp(88px, 10.5vw, 148px)", lineHeight: 0.87, letterSpacing: "-0.01em", margin: 0, fontWeight: 400, position: "relative", zIndex: 1, animationDelay: ".25s", color: C.tx }}>
            Créez.<br/>
            <span style={{ color: "transparent", WebkitTextStroke: "1.5px " + C.tx }}>Publiez.</span><br/>
            Grandissez.
          </h1>
          <p className="viz-up" style={{ marginTop: 36, fontSize: 14, color: C.tx2, lineHeight: 1.8, fontWeight: 300, maxWidth: 440, position: "relative", zIndex: 1, animationDelay: ".4s" }}>
            Viziona est le studio visuel de votre club. Choisissez un type de visuel, personnalisez en 30 secondes, exportez en PNG. Prêt pour Instagram.
          </p>
          <div className="viz-up" style={{ marginTop: 52, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", position: "relative", zIndex: 1, animationDelay: ".55s" }}>
            <a href="#" onClick={handleEnter("login")} className="viz-btn-text" style={{ background: "transparent", color: C.bk, border: "1.5px solid " + C.bk, padding: "13px 28px", borderRadius: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "all .2s" }}>Se connecter</a>
            <a href="#" onClick={handleEnter("signup")} className="viz-btn-main" style={{ background: C.bk, color: C.wh, padding: "14px 32px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "transform .2s, opacity .2s" }}>Demander l'accès</a>
            <a href="#how" className="viz-btn-text" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", display: "flex", alignItems: "center", gap: 7, transition: "color .2s" }}>
              Voir comment <span className="viz-btn-arr" style={{ transition: "transform .2s" }}>↗</span>
            </a>
          </div>
          <div className="viz-up viz-hero-stats" style={{ marginTop: 80, paddingTop: 36, borderTop: "1px solid " + C.bdLite, display: "flex", gap: 48, position: "relative", zIndex: 1, animationDelay: ".7s" }}>
            {STATS.map(s => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontFamily: FONT_H, fontSize: 44, letterSpacing: "0.04em", lineHeight: 1, color: C.tx }}>{s.n}</div>
                <div style={{ fontFamily: FONT_M, fontSize: 9, color: C.tx3, letterSpacing: "0.16em", textTransform: "uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HERO RIGHT — 4 mocks enrichis sur fond noir */}
        <div className="viz-fade viz-hero-right" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto auto", gap: 1, background: C.bk }}>
          {/* But */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>But · Célébration</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(155deg, #08080f, #160808)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", position: "relative", overflow: "hidden", padding: 10 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#E63329,#FF7035)" }}/>
              <div aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 110, color: "rgba(230,51,41,0.07)", letterSpacing: "0.04em", top: "15%" }}>BUT</div>
              {/* Silhouette joueur avec numéro */}
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 68, height: 92 }}>
                <PlayerSilhouette color="#fff" opacity={0.22}/>
                <div style={{ position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", fontFamily: FONT_H, fontSize: 28, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em", textShadow: "0 0 14px rgba(0,0,0,.5)" }}>9</div>
              </div>
              <div style={{ fontFamily: FONT_H, fontSize: 44, color: "#fff", letterSpacing: "0.04em", position: "relative", zIndex: 1, textShadow: "0 0 50px rgba(230,51,41,0.5)", lineHeight: 1 }}>BUT !</div>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(230,80,40,0.78)", letterSpacing: "0.14em", textTransform: "uppercase", position: "relative", zIndex: 1, marginTop: 4 }}>M. Rodriguez · #9</div>
            </div>
          </div>
          {/* Score */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Score · Final</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "#0b0b0b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 10 }}>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(250,250,250,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 2 }}>SCORE FINAL</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: FONT_H, fontSize: 56, color: "#fff", lineHeight: 1 }}>2</span>
                <span style={{ fontSize: 20, color: "rgba(250,250,250,0.3)" }}>—</span>
                <span style={{ fontFamily: FONT_H, fontSize: 56, color: "#fff", lineHeight: 1 }}>1</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 8 }}>
                <span style={{ fontFamily: FONT_H, fontSize: 12, color: "rgba(250,250,250,0.82)", letterSpacing: "0.06em" }}>FC BAVOIS</span>
                <span style={{ fontFamily: FONT_H, fontSize: 12, color: "rgba(250,250,250,0.82)", letterSpacing: "0.06em" }}>CS RENENS</span>
              </div>
            </div>
          </div>
          {/* Composition */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Composition · XI</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(to bottom, #04040e, #080814)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: 10, position: "relative", overflow: "hidden" }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='160'%3E%3Crect x='4' y='4' width='92' height='152' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3Cline x1='4' y1='80' x2='96' y2='80' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3Cellipse cx='50' cy='80' rx='20' ry='20' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3C/svg%3E\")", backgroundSize: "100% 100%" }}/>
              {[[7,9,11],[2,5,6,8],[3,4,16,14],[1]].map((nums, ri) => (
                <div key={ri} style={{ display: "flex", gap: 6, justifyContent: "center", position: "relative", zIndex: 1 }}>
                  {nums.map((n, i) => (
                    <div key={i} style={{ width: 17, height: 17, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.32)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_H, fontSize: 9, color: "#fff", letterSpacing: "0.02em" }}>{n}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Annonce */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Annonce · Post</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(135deg, #090909, #11161a)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#00C896,#00A8FF)" }}/>
              <div aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 90, color: "rgba(0,200,150,0.05)", letterSpacing: "0.04em", top: "20%", right: -8 }}>VS</div>
              <div style={{ fontFamily: FONT_H, fontSize: 22, color: "#fff", lineHeight: 1, letterSpacing: "0.02em", position: "relative", zIndex: 1 }}>DERBY<br/>DIMANCHE</div>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(0,200,150,0.78)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4, position: "relative", zIndex: 1 }}>15:00 · Stade Municipal</div>
            </div>
          </div>
          {/* Wide tags */}
          <div style={{ gridColumn: "1 / -1", background: "#0d0d0d", padding: "18px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Types de visuels</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["But","Score","Composition","Groupe","Recrue","Affiche","Annonce"].map(t => (
                <span key={t} style={{ background: "#161616", color: "rgba(250,250,250,0.6)", padding: "4px 11px", borderRadius: 1, fontFamily: FONT_M, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TICKER ─── */}
      <div style={{ background: C.bgAlt, padding: "12px 0", overflow: "hidden", whiteSpace: "nowrap", borderTop: "1px solid " + C.bdLite, borderBottom: "1px solid " + C.bdLite }}>
        <div className="viz-ticker-in">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.18em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 14 }}>
              {t} <span style={{ color: C.tx4, fontSize: 7 }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── À PROPOS ─── */}
      <section id="about" className="viz-about" style={{ background: C.bg, padding: "140px 52px", maxWidth: 1340, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>À propos</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 64px)", letterSpacing: "0.005em", lineHeight: 1, fontWeight: 400, margin: 0, color: C.tx }}>
            Chaque club mérite<br/>d'exister sur<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>les réseaux.</em>
          </h2>
        </div>
        <div style={{ paddingTop: 40 }}>
          <p style={{ fontSize: 15, color: C.tx2, lineHeight: 1.8, fontWeight: 300, margin: 0, marginBottom: 22 }}>
            Des milliers de clubs amateurs s'entraînent, gagnent des matchs, font progresser des joueurs — et personne ne le voit. Pas parce qu'il ne se passe rien, mais parce qu'ils n'ont ni le temps ni les outils pour le raconter.
          </p>
          <p style={{ fontSize: 15, color: C.tx2, lineHeight: 1.8, fontWeight: 300, margin: 0, marginBottom: 22 }}>
            Viziona est né de ce constat. Une app pensée pour le dirigeant bénévole qui gère tout seul, le coach qui n'a pas d'agence de comm, le club qui mérite autant d'exister en ligne qu'en compétition.
          </p>
          <p style={{ fontSize: 15, color: C.tx, lineHeight: 1.8, fontWeight: 500, margin: 0, borderLeft: "2px solid " + C.tx, paddingLeft: 16 }}>
            En 30 secondes, depuis le bord du terrain, votre club peut publier comme un pro.
          </p>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="viz-features" style={{ background: C.bgAlt, padding: "120px 52px", borderTop: "1px solid " + C.bdLite }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <SHead tag="Pourquoi Viziona" h2_a="Ce que vous" h2_b="obtenez" counter="03 fonctionnalités"/>
          <div className="viz-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.bd }}>
            {FEATURES.map(f => (
              <div key={f.n} className="viz-fc" style={{ background: C.bg, padding: "42px 38px", position: "relative", transition: "background .25s" }}>
                <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx4, letterSpacing: "0.14em", marginBottom: 32 }}>{f.n}</div>
                <div style={{ marginBottom: 22, opacity: 0.7 }}>
                  {f.n === "01" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="3" y="3" width="26" height="26" rx="1" stroke={C.tx} strokeWidth="1.5"/><path d="M3 13h26M13 3v26" stroke={C.tx} strokeWidth="1.5"/></svg>)}
                  {f.n === "02" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke={C.tx} strokeWidth="1.5"/><path d="M16 7v9l5.5 3.5" stroke={C.tx} strokeWidth="1.5" strokeLinecap="square"/></svg>)}
                  {f.n === "03" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 3L3 11v8l13 10 13-10v-8L16 3z" stroke={C.tx} strokeWidth="1.5"/><path d="M3 11l13 8 13-8M16 3v18" stroke={C.tx} strokeWidth="1.5"/></svg>)}
                </div>
                <div style={{ fontFamily: FONT_H, fontSize: 30, letterSpacing: "0.04em", marginBottom: 12, color: C.tx }}>{f.t}</div>
                <p style={{ fontSize: 13, color: C.tx3, lineHeight: 1.8, fontWeight: 300, margin: 0 }}>{f.d}</p>
                <span className="viz-fc-arr" style={{ position: "absolute", bottom: 32, right: 32, color: C.tx4, fontSize: 18, transition: "color .2s, transform .2s" }}>↗</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="viz-how" style={{ background: C.bg, borderTop: "1px solid " + C.bdLite, display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 1340, margin: "0 auto" }}>
        <div className="viz-how-l" style={{ padding: "120px 52px", borderRight: "1px solid " + C.bdLite }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Comment ça marche</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
            Simple.<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>Vraiment.</em>
          </h2>
          <div style={{ marginTop: 56 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 20, padding: "28px 0", borderBottom: "1px solid " + C.bdLite, borderTop: i === 0 ? "1px solid " + C.bdLite : "none" }}>
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx4, letterSpacing: "0.1em", paddingTop: 4 }}>{s.n}</span>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: 22, letterSpacing: "0.06em", marginBottom: 6, color: C.tx }}>{s.t}</div>
                  <p style={{ fontSize: 13, color: C.tx3, lineHeight: 1.65, fontWeight: 300, margin: 0 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="viz-how-r" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, background: C.bgAlt }}>
          <div style={{ width: 224, height: 448, background: "#1a1a1a", borderRadius: 30, border: "1px solid " + C.bd, overflow: "hidden", position: "relative", boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 10px 20px rgba(0,0,0,0.1)" }}>
            <div style={{ position: "absolute", inset: 10, background: C.bk, borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(250,250,250,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_H, fontSize: 13, letterSpacing: "0.12em", color: C.wh }}>VIZIONA</span>
                <span style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(250,250,250,0.45)", letterSpacing: "0.1em" }}>FC BAVOIS</span>
              </div>
              <div style={{ flex: 1, background: "linear-gradient(155deg, #060610, #110606)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#E63329,#FF8035)" }}/>
                <div style={{ width: 60, height: 80, marginBottom: 6 }}><PlayerSilhouette color="#fff" opacity={0.22}/></div>
                <div style={{ fontFamily: FONT_H, fontSize: 50, color: "#fff", letterSpacing: "0.04em", textShadow: "0 0 60px rgba(230,51,41,0.35)", zIndex: 1, lineHeight: 1 }}>BUT !</div>
                <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(230,80,40,0.85)", letterSpacing: "0.12em", textTransform: "uppercase", zIndex: 1, marginTop: 4 }}>M. Rodriguez · #9</div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                <div style={{ flex: 1, background: C.wh, color: C.bk, borderRadius: 2, padding: "10px 4px", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textAlign: "center", textTransform: "uppercase" }}>Télécharger</div>
                <div style={{ flex: 1, background: "rgba(250,250,250,0.07)", color: "rgba(250,250,250,0.45)", borderRadius: 2, padding: "10px 4px", fontSize: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center", textTransform: "uppercase" }}>Sauver</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bgAlt }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Tarifs</div>
            <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
              Tarifs<br/>
              <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>sur demande.</em>
            </h2>
            <p style={{ fontSize: 14, color: C.tx2, lineHeight: 1.8, fontWeight: 300, marginTop: 36, maxWidth: 560 }}>
              Nous définissons ensemble l'offre adaptée à votre club, selon votre taille, vos besoins et la fréquence d'utilisation. Pas de surprise — on parle d'abord, on chiffre ensuite.
            </p>
            <a href="mailto:contact@viziona-sport.com" className="viz-btn-main" style={{ display: "inline-block", marginTop: 40, background: C.bk, color: C.wh, padding: "14px 32px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "transform .2s, opacity .2s" }}>
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* ─── TEAM ─── */}
      <section className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bg }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Équipe</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 60px)", letterSpacing: "0.02em", lineHeight: 1, fontWeight: 400, margin: 0, color: C.tx, maxWidth: 880 }}>
            Deux fondateurs, une obsession :<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>donner à chaque club les outils des pros.</em>
          </h2>
          <div className="viz-team-row" style={{ marginTop: 56, display: "flex", gap: 48, flexWrap: "wrap" }}>
            {TEAM.map(p => (
              <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <img src={p.photo} alt={p.nom} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid " + C.bd }}/>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: 22, letterSpacing: "0.04em", color: C.tx }}>{p.nom}</div>
                  <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>{p.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bgAlt }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <SHead tag="FAQ" h2_a="Questions" h2_b="fréquentes." counter={FAQ_ITEMS.length + " questions"}/>
          <div style={{ maxWidth: 820 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ borderBottom: "1px solid " + C.bdLite }}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="viz-faq-btn" style={{ width: "100%", background: "none", border: "none", padding: "22px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY, color: C.tx2, transition: "color .2s" }}>
                    <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em", flex: 1 }}>{item.q}</span>
                    <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 300, color: C.tx3, lineHeight: 1, flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "rotate(0)", transition: "transform .18s ease" }}>+</span>
                  </button>
                  <div style={{ maxHeight: isOpen ? 400 : 0, overflow: "hidden", transition: "max-height .25s ease" }}>
                    <p style={{ fontSize: 14, color: C.tx3, lineHeight: 1.75, margin: 0, paddingBottom: 22, paddingRight: 40, fontWeight: 300 }}>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA WIDE NOIR ─── */}
      <div className="viz-cta-w" style={{ margin: "0 52px 120px", background: C.bk, padding: "72px 80px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 60, position: "relative", overflow: "hidden", marginTop: 0 }}>
        <span aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 200, color: "rgba(250,250,250,0.045)", right: -10, top: "50%", transform: "translateY(-50%)", letterSpacing: "0.04em", pointerEvents: "none", whiteSpace: "nowrap" }}>VIZIONA</span>
        <div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 60px)", color: C.wh, letterSpacing: "0.02em", lineHeight: 0.92, margin: 0, fontWeight: 400 }}>Prêt à élever<br/>votre club ?</h2>
          <p style={{ fontSize: 13, color: "rgba(250,250,250,0.55)", marginTop: 14, fontWeight: 300, lineHeight: 1.65 }}>Accès sur demande · Réponse sous 24h · Premiers clubs en bêta</p>
        </div>
        <a href="#" onClick={handleEnter("signup")} className="viz-cta-b" style={{ background: C.wh, color: C.bk, padding: "15px 38px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 1, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block", transition: "transform .2s", position: "relative", zIndex: 1 }}>
          Demander l'accès
        </a>
      </div>

      {/* ─── CGU ─── */}
      <section id="cgu" style={{ width: "100%", background: C.bgAlt, borderTop: "1px solid " + C.bdLite, padding: "72px 0", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 900, padding: "0 52px", boxSizing: "border-box" }}>
          <p style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.tx3, marginBottom: 8, fontWeight: 500 }}>
            Conditions générales d'utilisation
          </p>
          <p style={{ fontFamily: FONT_M, fontSize: 11, color: C.tx4, marginBottom: 28, letterSpacing: "0.02em" }}>
            En vigueur au 7 mai 2026
          </p>
          <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.75, display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>1. Nature du service</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Viziona Sport est un outil SaaS permettant aux clubs sportifs de créer des visuels (compositions, scores, annonces, recrues) à partir de leurs propres données. L'accès est délivré sur demande après validation manuelle. Viziona Sport se réserve le droit de refuser, suspendre ou révoquer un accès à tout moment, sans justification.</p>
            </div>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>2. Données personnelles</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Les données saisies par l'utilisateur (nom du club, joueurs, photos, médias) sont stockées de manière sécurisée chez nos prestataires d'hébergement. Elles ne sont jamais transmises à des tiers à des fins commerciales. Le traitement est conforme au Règlement Général sur la Protection des Données (RGPD) et à la Loi fédérale suisse sur la protection des données (nLPD). L'utilisateur peut demander à tout moment la suppression de ses données en écrivant à <a href="mailto:contact@viziona-sport.com" style={{ color: C.tx, textDecoration: "underline" }}>contact@viziona-sport.com</a>.</p>
            </div>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>3. Propriété intellectuelle</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Les visuels créés via Viziona Sport appartiennent intégralement au club utilisateur, qui en conserve l'usage exclusif. Viziona Sport se réserve néanmoins le droit d'utiliser des captures anonymisées (sans nom de club identifiable) à des fins de démonstration commerciale, marketing ou de présentation du produit.</p>
            </div>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>4. Limitation de responsabilité</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Le service est fourni en l'état, sans garantie de disponibilité continue. Viziona Sport ne saurait être tenu responsable d'une interruption de service, d'une perte de données, d'une indisponibilité temporaire, ni d'un usage inapproprié des visuels créés par l'utilisateur (notamment publication à caractère diffamatoire, contrefaisant ou violant les droits de tiers).</p>
            </div>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>5. Droit applicable et juridiction</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Les présentes conditions sont soumises au droit suisse. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux de Genève, sous réserve des voies de recours auprès du Tribunal fédéral.</p>
            </div>
            <div>
              <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>6. Contact</div>
              <p style={{ margin: 0, fontWeight: 300 }}>Pour toute question relative aux présentes conditions ou au service : <a href="mailto:contact@viziona-sport.com" style={{ color: C.tx, textDecoration: "underline" }}>contact@viziona-sport.com</a>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="viz-footer" style={{ padding: "36px 52px", borderTop: "1px solid " + C.bdLite, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <VLogo size={20}/>
          <span style={{ fontFamily: FONT_H, fontSize: 17, letterSpacing: "0.14em", color: C.tx }}>Viziona</span>
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.08em" }}>© 2026 Viziona Sport · Suisse</span>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <a href="mailto:contact@viziona-sport.com" className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>contact@viziona-sport.com</a>
          <a href="#cgu" className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>CGU</a>
          <a href="#cgu" className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>Confidentialité</a>
        </div>
      </footer>
    </div>
  );
}
