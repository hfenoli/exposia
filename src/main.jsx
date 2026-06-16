import { StrictMode, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { supabase } from "./supabase"
import App from "./App"
import Auth from "./Auth"
import Landing from "./Landing"
import Admin from "./Admin"

function detectAdminFromUrl() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/admin" || window.location.hash === "#admin";
}

function detectMagicLinkInUrl() {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  return h.includes("access_token=") || h.includes("refresh_token=") || h.includes("error=") || h.includes("error_description=");
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
      setSession(session)
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
        setSession(session)
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
  if (session === undefined || magicLinkPending) return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", flexDirection: "column", gap: 14, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(0,0,0,0.12)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "viz-spin 0.8s linear infinite" }}/>
      <div style={{ fontSize: 12, color: "#666", letterSpacing: ".08em" }}>{magicLinkPending ? "Connexion en cours…" : ""}</div>
      <style>{`@keyframes viz-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  function enterAuth(mode) {
    if (mode === "login" || mode === "signup") setAuthMode(mode)
    setShowLanding(false)
  }

  // Admin : prioritaire sur tout le reste si activé
  if (showAdmin) {
    if (!session) return <Auth onBack={closeAdmin} initialMode={authMode}/>
    return <Admin session={session} onClose={closeAdmin} />
  }

  // Permettre l'accès à la landing (CGU notamment) même quand authentifié
  if (typeof window !== "undefined" && window.location.hash === "#cgu") return <Landing onEnter={(mode) => { window.location.hash = ""; enterAuth(mode); }} />

  if (showLanding && !session) return <Landing onEnter={enterAuth} />
  if (!session) return <Auth onBack={() => setShowLanding(true)} initialMode={authMode}/>
  return <App session={session} />
}

createRoot(document.getElementById("root")).render(
  <StrictMode><Root /></StrictMode>
)
