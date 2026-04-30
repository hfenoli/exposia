import { StrictMode, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { supabase } from "./supabase"
import App from "./App"
import Auth from "./Auth"
import Landing from "./Landing"

function Root() {
  const [session, setSession] = useState(undefined)
  const [showLanding, setShowLanding] = useState(true)

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

  if (session === undefined) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
    </div>
  )

  if (showLanding && !session) return <Landing onEnter={() => setShowLanding(false)} />
  if (!session) return <Auth onBack={() => setShowLanding(true)} />
  return <App session={session} />
}

createRoot(document.getElementById("root")).render(
  <StrictMode><Root /></StrictMode>
)
