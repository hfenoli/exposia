/* eslint-disable react-refresh/only-export-components --
   Point d'entrée de l'application : ce fichier n'exporte rien par nature, la
   règle Fast Refresh n'a pas de sens ici. */
import { StrictMode, useState, useEffect, Component, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { supabase } from "./supabase"
import Auth from "./Auth"
import Landing from "./Landing"

// L'éditeur et l'écran admin ne servent qu'une fois connecté. Les charger à la
// demande évite à un visiteur de la page publique de télécharger tout le
// studio (éditeur, traitement d'image, registre des sports) pour rien.
const App = lazy(() => import("./App"))
const Admin = lazy(() => import("./Admin"))

function Splash({ label }) {
  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", flexDirection: "column", gap: 14, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(0,0,0,0.12)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "viz-spin 0.8s linear infinite" }}/>
      <div style={{ fontSize: 12, color: "#666", letterSpacing: ".08em" }}>{label || ""}</div>
      <style>{`@keyframes viz-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── ERROR BOUNDARY GLOBAL ─────────────────────────────────────
// Capture toutes les erreurs React enfants et affiche un fallback propre au lieu d'un écran blanc.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Log pour debug + envoi futur vers un outil monitoring (Sentry, etc.)
    console.error("[ErrorBoundary] Crash React capturé:", error, info);
  }
  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };
  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Force un retour à l'accueil si l'erreur vient d'une route corrompue
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/");
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#FAFAFA", color: "#0A0A0A", fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 64, letterSpacing: ".02em", marginBottom: 12 }}>OUPS.</div>
        <p style={{ fontSize: 15, color: "#555", maxWidth: 420, lineHeight: 1.6, marginBottom: 28 }}>
          Une erreur inattendue est survenue. Vos données sont sauvegardées en sécurité. Rechargez la page pour reprendre.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={this.handleReload} style={{ background: "#0A0A0A", color: "#FAFAFA", border: "none", padding: "14px 32px", borderRadius: 2, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
            Recharger
          </button>
          <button onClick={this.handleReset} style={{ background: "transparent", color: "#0A0A0A", border: "1px solid #0A0A0A", padding: "14px 32px", borderRadius: 2, fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
            Retour accueil
          </button>
        </div>
        {this.state.error && (
          <details style={{ marginTop: 32, maxWidth: 520, fontSize: 11, color: "#888" }}>
            <summary style={{ cursor: "pointer" }}>Détails techniques</summary>
            <pre style={{ textAlign: "left", overflow: "auto", background: "#F0F0F0", padding: 12, borderRadius: 4, marginTop: 8, fontSize: 10 }}>{String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}</pre>
          </details>
        )}
      </div>
    );
  }
}

function detectAdminFromUrl() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/admin" || window.location.hash === "#admin";
}

function detectMagicLinkInUrl() {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  return h.includes("access_token=") || h.includes("refresh_token=") || h.includes("error=") || h.includes("error_description=");
}

// Supabase émet un TOKEN_REFRESHED toutes les ~50 min (et au retour d'onglet).
// Remplacer l'objet session à chaque fois faisait re-tourner tous les effets qui
// en dépendent côté App → rechargement complet des données, d'où les joueurs qui
// "disparaissent puis réapparaissent". Le client Supabase garde lui-même le token
// à jour : côté React on ne change la référence que si l'utilisateur change.
function mergeSession(prev, next) {
  if (prev && next && prev.user && next.user && prev.user.id === next.user.id) return prev
  return next
}

function Root() {
  const [session, setSession] = useState(undefined)
  const [showLanding, setShowLanding] = useState(true)
  const [showAdmin, setShowAdmin] = useState(detectAdminFromUrl)
  const [authMode, setAuthMode] = useState("login") // pré-sélection onglet Auth ("login" | "signup")
  // Tant que ce flag est vrai, on tient le splash : un magic link est en cours de traitement,
  // session=null serait prématuré (Supabase n'a pas encore parsé le hash).
  const [magicLinkPending, setMagicLinkPending] = useState(detectMagicLinkInUrl)

  useEffect(() => {
    let alive = true;
    // L'event auth est la source canonique : SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED/INITIAL_SESSION.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setSession(prev => mergeSession(prev, session))
      if (session) setShowLanding(false)
      // Tout event auth = fin du processing magic link
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        setMagicLinkPending(false)
        // Nettoie le hash magic link de l'URL pour éviter qu'un reload retrigger le traitement
        if (typeof window !== "undefined" && (window.location.hash.includes("access_token=") || window.location.hash.includes("error="))) {
          window.history.replaceState({}, "", window.location.pathname + window.location.search)
        }
      }
    })
    // Filet de sécurité : si pour une raison X le hash n'est jamais traité (Supabase config absente, etc.),
    // on libère le splash après 6s pour ne pas bloquer l'utilisateur indéfiniment.
    const fallbackTimer = setTimeout(() => {
      if (alive) {
        setMagicLinkPending(false);
        // Si pas encore de session définie, force à null pour passer sur Auth/Landing
        setSession(prev => prev === undefined ? null : prev)
      }
    }, 6000);
    // getSession en parallèle — utile si pas de hash dans l'URL (session déjà persistée localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      // Ne court-circuite PAS le splash si un magic link est en cours et que la session n'est pas encore là —
      // on attend l'event onAuthStateChange.
      if (session) {
        setSession(prev => mergeSession(prev, session))
        setShowLanding(false)
        setMagicLinkPending(false)
        clearTimeout(fallbackTimer)
      } else if (!detectMagicLinkInUrl()) {
        // Pas de hash magic link → on peut acter que la session est null tout de suite
        setSession(null)
      }
    })
    return () => { alive = false; clearTimeout(fallbackTimer); subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    // Raccourci clavier : Ctrl+Shift+A (ou Cmd+Shift+A sur Mac)
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyA") {
        e.preventDefault();
        setShowAdmin(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [])

  function closeAdmin() {
    setShowAdmin(false);
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/admin") window.history.replaceState({}, "", "/");
      if (window.location.hash === "#admin") window.location.hash = "";
    }
  }

  // Splash tant que la session n'est pas définie OU qu'un magic link est en cours de traitement.
  if (session === undefined || magicLinkPending) return <Splash label={magicLinkPending ? "Connexion en cours…" : ""}/>

  function enterAuth(mode) {
    if (mode === "login" || mode === "signup") setAuthMode(mode)
    setShowLanding(false)
  }

  // Admin : prioritaire sur tout le reste si activé
  if (showAdmin) {
    if (!session) return <Auth onBack={closeAdmin} initialMode={authMode}/>
    return <Suspense fallback={<Splash label="Chargement…"/>}><Admin session={session} onClose={closeAdmin} /></Suspense>
  }

  // Permettre l'accès à la landing (CGU notamment) même quand authentifié
  if (typeof window !== "undefined" && window.location.hash === "#cgu") return <Landing onEnter={(mode) => { window.location.hash = ""; enterAuth(mode); }} />

  if (showLanding && !session) return <Landing onEnter={enterAuth} />
  if (!session) return <Auth onBack={() => setShowLanding(true)} initialMode={authMode}/>
  return <Suspense fallback={<Splash label="Chargement du studio…"/>}><App session={session} /></Suspense>
}

createRoot(document.getElementById("root")).render(
  <StrictMode><ErrorBoundary><Root /></ErrorBoundary></StrictMode>
)
