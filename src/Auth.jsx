import { useState } from "react";
import { supabase } from "./supabase";

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const inputStyle = {
  width: "100%",
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.15)",
  borderRadius: 4,
  padding: "11px 13px",
  color: "#0a0a0a",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: FONT,
};

const labelStyle = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#888",
  marginBottom: 6,
  fontWeight: 500,
};

export default function Auth({ onBack }) {
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
        // Notifier par email
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-signup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              club_name: clubName || "Mon Club",
              email: email,
            }),
          }
        );
        setSuccess("Demande envoyée. Vous recevrez un accès sous 24h après validation.");
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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#ffffff",
      color: "#0a0a0a",
      fontFamily: FONT,
      position: "relative",
    }}>
      {/* NAV identique à la landing */}
      <nav style={{
        width: "100%",
        maxWidth: 900,
        padding: "32px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
      }}>
        {onBack ? (
          <button onClick={onBack} style={{
            background: "none",
            border: "none",
            color: "#0a0a0a",
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
            letterSpacing: "0.04em",
            fontFamily: FONT,
            opacity: 0.6,
          }}>
            ← Retour
          </button>
        ) : <span />}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/team/logo.jpg" alt="Visium Sport" style={{ width: 28, height: 28, display: "block" }} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.08em" }}>Visium Sport</span>
        </div>
      </nav>

      {/* FORM */}
      <main style={{
        flex: 1,
        width: "100%",
        maxWidth: 420,
        padding: "40px 40px 60px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
        <p style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#888",
          marginBottom: 18,
          fontWeight: 500,
        }}>
          {mode === "forgot" ? "Réinitialisation" : mode === "signup" ? "Demande d'accès" : "Connexion"}
        </p>

        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          margin: "0 0 36px",
          color: "#0a0a0a",
        }}>
          {mode === "forgot" ? "Réinitialiser votre mot de passe." : mode === "signup" ? "Créer un accès club." : "Accéder à votre studio."}
        </h1>

        {/* Onglets, masqués en mode forgot */}
        {mode !== "forgot" && (
          <div style={{
            display: "flex",
            gap: 0,
            marginBottom: 28,
            borderBottom: "1px solid rgba(0,0,0,0.1)",
          }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  borderBottom: "2px solid " + (mode === m ? "#0a0a0a" : "transparent"),
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: mode === m ? 600 : 500,
                  color: mode === m ? "#0a0a0a" : "#888",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  fontFamily: FONT,
                  marginBottom: -1,
                  transition: "all .2s",
                }}>
                {m === "login" ? "Connexion" : "Demander l'accès"}
              </button>
            ))}
          </div>
        )}

        {mode === "signup" && (
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>Nom du club</div>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="FC Mon Club" style={inputStyle} />
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={labelStyle}>Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="club@email.com" type="email" style={inputStyle} />
        </div>

        {mode !== "forgot" && (
          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Mot de passe</div>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={inputStyle} />
          </div>
        )}

        {mode === "signup" && (
          <div style={{
            background: "#fafafa",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 4,
            padding: "12px 14px",
            fontSize: 12,
            color: "#555",
            marginBottom: 20,
            lineHeight: 1.55,
          }}>
            Votre demande sera examinée sous 24h. Vous recevrez un email de confirmation dès validation.
          </div>
        )}

        {error && (
          <div style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.6)",
            borderRadius: 4,
            padding: "11px 14px",
            color: "#0a0a0a",
            fontSize: 12,
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: "#0a0a0a",
            border: "1px solid #0a0a0a",
            borderRadius: 4,
            padding: "11px 14px",
            color: "#fff",
            fontSize: 12,
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            {success}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          style={{
            width: "100%",
            background: "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.5 : 1,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: FONT,
            transition: "opacity .2s",
          }}>
          {loading ? "Chargement..." : mode === "login" ? "Se connecter" : mode === "signup" ? "Envoyer la demande" : "Envoyer le lien"}
        </button>

        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button onClick={() => switchMode("forgot")}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                fontFamily: FONT,
                letterSpacing: "0.02em",
              }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button onClick={() => switchMode("login")}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                fontFamily: FONT,
                letterSpacing: "0.02em",
              }}>
              Retour à la connexion
            </button>
          </div>
        )}
      </main>

      {/* Footer minimal */}
      <footer style={{
        width: "100%",
        maxWidth: 900,
        padding: "20px 40px",
        boxSizing: "border-box",
        borderTop: "1px solid rgba(0,0,0,0.07)",
        textAlign: "center",
      }}>
        <span style={{ fontSize: 12, color: "#ccc", letterSpacing: "0.04em" }}>
          © 2025 Visium Sport · Suisse
        </span>
      </footer>
    </div>
  );
}
