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
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
    </div>
  )

  // Admin : prioritaire sur tout le reste si activé
  if (showAdmin) {
    if (!session) return <Auth onBack={closeAdmin} />
    return <Admin session={session} onClose={closeAdmin} />
  }

  // Permettre l'accès à la landing (CGU notamment) même quand authentifié
  if (typeof window !== "undefined" && window.location.hash === "#cgu") return <Landing onEnter={() => { window.location.hash = ""; setShowLanding(false); }} />

  if (showLanding && !session) return <Landing onEnter={() => setShowLanding(false)} />
  if (!session) return <Auth onBack={() => setShowLanding(true)} />
  return <App session={session} />
}

createRoot(document.getElementById("root")).render(
  <StrictMode><Root /></StrictMode>
)
