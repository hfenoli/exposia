import { StrictMode, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { supabase } from "./supabase"
import App from "./App"
import Auth from "./Auth"

function Root() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", color: "#64748b", fontFamily: "system-ui" }}>
      Chargement...
    </div>
  )

  return session ? <App session={session} /> : <Auth />
}

createRoot(document.getElementById("root")).render(
  <StrictMode><Root /></StrictMode>
)
