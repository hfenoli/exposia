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

function Root() {
  const [session, setSession] = useState(undefined)
  const [showLanding, setShowLanding] = useState(true)
  const [showAdmin, setShowAdmin] = useState(detectAdminFromUrl)
  const [authMode, setAuthMode] = useState("login") // pré-sélection onglet Auth ("login" | "signup")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) setShowLanding(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setShowLanding(false)
    })
    return () => subscription.unsubscribe()
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

  if (session === undefined) return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
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
