import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const FONT = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_H = "'Bebas Neue', Impact, sans-serif";
// Inject Google Fonts (idempotent — partagé avec Landing.jsx)
if (typeof document !== "undefined" && !document.getElementById("viziona-landing-fonts")) {
  const l = document.createElement("link");
  l.id = "viziona-landing-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}
if (typeof document !== "undefined" && !document.getElementById("viz-auth-css")) {
  const s = document.createElement("style");
  s.id = "viz-auth-css";
  s.textContent = "@keyframes viz-auth-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}
const TURNSTILE_SITE_KEY = "0x4AAAAAADQBrsbjQ5h5zySt";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

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

export default function Auth({ onBack, initialMode }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login"); // login | signup
  const [email, setEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaPending, setCaptchaPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cloudflare Turnstile (invisible)
  const widgetHostRef = useRef(null);
  const widgetIdRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    // Charge le script Turnstile une seule fois pour l'app
    if (!document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = TURNSTILE_SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    let attempts = 0;
    let cancelled = false;
    function tryRender() {
      if (cancelled || widgetIdRef.current != null) return;
      if (!window.turnstile || !widgetHostRef.current) {
        attempts++;
        if (attempts < 60) setTimeout(tryRender, 200);
        return;
      }
      widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "invisible",
        callback: (token) => {
          const p = pendingRef.current;
          if (p) { pendingRef.current = null; p.resolve(token); }
        },
        "error-callback": () => {
          const p = pendingRef.current;
          if (p) { pendingRef.current = null; p.reject(new Error("captcha-error")); }
        },
        "expired-callback": () => {
          const p = pendingRef.current;
          if (p) { pendingRef.current = null; p.reject(new Error("captcha-expired")); }
        },
      });
    }
    tryRender();

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current != null) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  function getCaptchaToken() {
    return new Promise((resolve, reject) => {
      if (!window.turnstile || widgetIdRef.current == null) {
        reject(new Error("captcha-not-ready"));
        return;
      }
      pendingRef.current = { resolve, reject };
      try {
        window.turnstile.execute(widgetIdRef.current);
      } catch (e) {
        pendingRef.current = null;
        reject(e);
      }
    });
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setSuccess("");
  }

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Veuillez saisir votre adresse email.");
      setLoading(false);
      return;
    }
    if (mode === "signup" && !clubName.trim()) {
      setError("Veuillez saisir le nom de votre club.");
      setLoading(false);
      return;
    }

    // Récupère un token Turnstile avant de contacter Supabase
    let captchaToken;
    setCaptchaPending(true);
    try {
      captchaToken = await getCaptchaToken();
    } catch (e) {
      setError("Vérification anti-bot indisponible. Rechargez la page et réessayez.");
      setLoading(false);
      setCaptchaPending(false);
      return;
    }
    setCaptchaPending(false);

    const options = {
      emailRedirectTo: window.location.origin,
      captchaToken,
    };
    if (mode === "signup") {
      // Le nom de club voyage dans le user_metadata Supabase ; il sera lu côté App pour créer la ligne clubs au premier login.
      options.data = { club_name: clubName.trim() };
      // shouldCreateUser = true par défaut, donc le compte est créé au premier clic du lien.
    } else {
      // Connexion : on ne crée pas un nouveau compte si l'email n'existe pas.
      options.shouldCreateUser = false;
    }

    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail, options });

    // Reset du widget pour qu'une prochaine soumission obtienne un token frais (les tokens Turnstile sont à usage unique)
    if (window.turnstile && widgetIdRef.current != null) {
      try { window.turnstile.reset(widgetIdRef.current); } catch (e) {}
    }

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Un lien de connexion a été envoyé à votre adresse email. Vérifiez votre boîte mail.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#ffffff",
      color: "#0a0a0a",
      fontFamily: FONT,
      position: "relative",
    }}>
      {/* NAV */}
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
          <img src="/team/logo.jpg" alt="Viziona" style={{ width: 28, height: 28, display: "block" }} />
          <span style={{ fontFamily: FONT_H, fontSize: 19, fontWeight: 400, letterSpacing: "0.16em" }}>Viziona</span>
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
          {mode === "signup" ? "Demande d'accès" : "Connexion"}
        </p>

        <h1 style={{
          fontFamily: FONT_H,
          fontSize: 48,
          fontWeight: 400,
          lineHeight: 1.0,
          letterSpacing: "0.005em",
          margin: "0 0 36px",
          color: "#0a0a0a",
        }}>
          {mode === "signup" ? "Créer un accès club." : "Accéder à votre studio."}
        </h1>

        {/* Onglets */}
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
              {m === "login" ? "Je suis déjà membre" : "Demander l'accès"}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>Nom du club</div>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="FC Mon Club" style={inputStyle} />
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="club@email.com" type="email" style={inputStyle} />
        </div>

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
          Vous recevrez un lien sécurisé par email, valable 1 heure.
          {mode === "signup" && " Votre demande sera examinée sous 24h."}
        </div>

        {/* Cloudflare Turnstile (invisible) — apparaît uniquement si un challenge est nécessaire */}
        <div ref={widgetHostRef} style={{ display: "flex", justifyContent: "center", marginBottom: 12 }} />
        {captchaPending && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14, fontSize: 12, color: "#555", fontFamily: FONT }}>
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "viz-auth-spin 0.8s linear infinite" }}/>
            Vérification...
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

        <button onClick={handleSubmit} disabled={loading || !!success}
          style={{
            width: "100%",
            background: "#0a0a0a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "wait" : success ? "default" : "pointer",
            opacity: loading || success ? 0.5 : 1,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: FONT,
            transition: "opacity .2s",
          }}>
          {loading ? "Envoi..." : mode === "signup" ? "Créer mon accès" : "Recevoir un lien de connexion"}
        </button>
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
          © 2025 Viziona Sport · Suisse
        </span>
      </footer>
    </div>
  );
}
