import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.user) {
        await supabase.from("clubs").insert({ user_id: data.user.id, name: clubName || "Mon Club" });
        setSuccess("Compte créé ! Vérifiez votre email puis connectez-vous.");
        setMode("login");
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 380, background: "#12121a", border: "1px solid #2a2a40", borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>EXPOsia</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Créateur de visuels football</div>
        </div>
        <div style={{ display: "flex", marginBottom: 24, background: "#1a1a26", borderRadius: 8, padding: 4 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
              style={{ flex: 1, padding: "8px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === m ? "#7c3aed" : "transparent", color: mode === m ? "#fff" : "#64748b", transition: "all .2s" }}>
              {m === "login" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>
        {mode === "signup" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Nom du club</div>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="FC Mon Club"
              style={{ width: "100%", background: "#1a1a26", border: "1px solid #3a3a55", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="club@email.com" type="email"
            style={{ width: "100%", background: "#1a1a26", border: "1px solid #3a3a55", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Mot de passe</div>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
            style={{ width: "100%", background: "#1a1a26", border: "1px solid #3a3a55", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "10px 14px", color: "#86efac", fontSize: 12, marginBottom: 16 }}>{success}</div>}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer le compte"}
        </button>
      </div>
    </div>
  );
}
