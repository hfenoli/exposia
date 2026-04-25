export default function Landing({ onEnter }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      color: "#0a0a0a",
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo SVG inline */}
          <svg width="28" height="24" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="0,0 60,90 120,0" fill="none" stroke="#0a0a0a" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
            <polyline points="20,0 60,65 100,0" fill="none" stroke="#0a0a0a" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.08em" }}>Visium</span>
        </div>
        <a href="mailto:info@visium-sport.ch" style={{
          fontSize: 13,
          color: "#0a0a0a",
          textDecoration: "none",
          letterSpacing: "0.04em",
          opacity: 0.5,
        }}>
          info@visium-sport.ch
        </a>
      </nav>
      {/* HERO */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "60px 40px 40px",
        maxWidth: 680,
        width: "100%",
        boxSizing: "border-box",
      }}>
        {/* Tagline */}
        <p style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#888",
          marginBottom: 28,
          fontWeight: 500,
        }}>
          Your club, your vision
        </p>
        {/* Titre */}
        <h1 style={{
          fontSize: "clamp(36px, 7vw, 64px)",
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: "0 0 28px",
          color: "#0a0a0a",
        }}>
          Le studio visuel<br />de votre club.
        </h1>
        {/* Description */}
        <p style={{
          fontSize: 16,
          lineHeight: 1.75,
          color: "#555",
          maxWidth: 480,
          margin: "0 0 52px",
          fontWeight: 400,
        }}>
          Visium permet aux clubs de football de créer des visuels professionnels en quelques secondes — aux couleurs de leur équipe, depuis leur téléphone.
        </p>
        {/* CTAs */}
        <div style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <button
            onClick={onEnter}
            style={{
              background: "#0a0a0a",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "14px 32px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Accéder à Visium
          </button>
          <a
            href="mailto:info@visium-sport.ch"
            style={{
              background: "transparent",
              color: "#0a0a0a",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: 4,
              padding: "14px 32px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Nous contacter
          </a>
        </div>
        {/* Accès sur demande */}
        <p style={{
          marginTop: 22,
          fontSize: 12,
          color: "#bbb",
          letterSpacing: "0.04em",
        }}>
          Accès sur demande — réponse sous 24h
        </p>
      </main>
      {/* SÉPARATEUR */}
      <div style={{
        width: "100%",
        maxWidth: 900,
        height: 1,
        background: "rgba(0,0,0,0.07)",
        margin: "0 auto",
      }}/>
      {/* CE QU'ON FAIT */}
      <section style={{
        width: "100%",
        maxWidth: 900,
        padding: "64px 40px",
        boxSizing: "border-box",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 40,
      }}>
        {[
          { icon: "⚡", titre: "En 30 secondes", desc: "Créez un visuel professionnel depuis le bord du terrain, sans design ni logiciel." },
          { icon: "🎨", titre: "Vos couleurs", desc: "Logo, couleurs, joueurs — tout est configuré une fois, appliqué partout." },
          { icon: "📱", titre: "Depuis votre téléphone", desc: "Pensé pour le terrain. Pas besoin d'ordinateur, pas besoin de formation." },
        ].map((item) => (
          <div key={item.titre} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 22 }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", color: "#0a0a0a" }}>{item.titre}</div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.65 }}>{item.desc}</div>
          </div>
        ))}
      </section>
      {/* SÉPARATEUR */}
      <div style={{
        width: "100%",
        maxWidth: 900,
        height: 1,
        background: "rgba(0,0,0,0.07)",
        margin: "0 auto",
      }}/>
      {/* ÉQUIPE */}
      <section style={{
        width: "100%",
        maxWidth: 900,
        padding: "64px 40px",
        boxSizing: "border-box",
      }}>
        <p style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#aaa",
          marginBottom: 40,
          fontWeight: 500,
        }}>
          L'équipe
        </p>
        <div style={{
          display: "flex",
          gap: 48,
          flexWrap: "wrap",
        }}>
          {[
            {
              nom: "Hugo Fenoli-Rebellato",
              role: "Co-fondateur",
              initiales: "H",
            },
            {
              nom: "Lucas",
              role: "Co-fondateur",
              initiales: "L",
            },
          ].map((p) => (
            <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#0a0a0a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {p.initiales}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a" }}>{p.nom}</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2, letterSpacing: "0.04em" }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* FOOTER */}
      <footer style={{
        width: "100%",
        maxWidth: 900,
        padding: "24px 40px",
        boxSizing: "border-box",
        borderTop: "1px solid rgba(0,0,0,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
      }}>
        <span style={{ fontSize: 12, color: "#ccc", letterSpacing: "0.04em" }}>
          © 2025 Visium · Suisse
        </span>
        <a href="mailto:info@visium-sport.ch" style={{
          fontSize: 12,
          color: "#aaa",
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}>
          info@visium-sport.ch
        </a>
      </footer>
    </div>
  );
}
