import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function switchMode(m) {
    setMode(m);
    setError("");
    setSuccess("");
  }

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.user) {
        await supabase.from("clubs").insert({
          user_id: data.user.id,
          name: clubName || "Mon Club",
          approved: false
        });
        setSuccess("Demande envoyée ! Vous recevrez un accès sous 24h après validation.");
        setMode("login");
      }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: import.meta.env.VITE_APP_URL
      });
      if (error) setError(error.message);
      else setSuccess("Un lien de réinitialisation a été envoyé à votre email.");
    }
    setLoading(false);
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 380, background: "#12121a", border: "1px solid #2a2a40", borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>Visium Sport</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {mode === "forgot" ? "Réinitialiser le mot de passe" : "Créateur de visuels football"}
          </div>
        </div>

        {mode !== "forgot" && (
          <div style={{ display: "flex", marginBottom: 24, background: "#1a1a26", borderRadius: 8, padding: 4 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                style={{ flex: 1, padding: "8px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, background: mode === m ? "#7c3aed" : "transparent", color: mode === m ? "#fff" : "#64748b", transition: "all .2s" }}>
                {m === "login" ? "Connexion" : "Demander l'accès"}
              </button>
            ))}
          </div>
        )}

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

        {mode !== "forgot" && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Mot de passe</div>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
              style={{ width: "100%", background: "#1a1a26", border: "1px solid #3a3a55", borderRadius: 8, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        {mode === "signup" && (
          <div style={{ background: "#1a1a26", border: "1px solid #3a3a55", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            💡 Votre demande sera examinée sous 24h. Vous recevrez un email de confirmation dès validation.
          </div>
        )}

        {error && <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "10px 14px", color: "#86efac", fontSize: 12, marginBottom: 16 }}>{success}</div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : mode === "signup" ? "Envoyer la demande" : "Envoyer le lien"}
        </button>

        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={() => switchMode("forgot")}
              style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={() => switchMode("login")}
              style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
