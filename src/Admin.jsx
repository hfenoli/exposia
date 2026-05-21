import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const ADMIN_EMAILS = ["hugo.fenoli@live.fr", "lucas.dipasquale01@gmail.com"];
const PLANS = ["BASIC", "STANDARD", "PREMIUM"];

const FONT = "system-ui,-apple-system,sans-serif";

const card = {
  background: "#0f0f1a",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: "16px 20px",
};
const th = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 10,
  color: "rgba(240,240,248,.4)",
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const td = { padding: "12px 14px", fontSize: 12, verticalAlign: "middle" };

export default function Admin({ session, onClose }) {
  const isAuthorized = !!session && ADMIN_EMAILS.includes(session.user.email);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyVisuals, setWeeklyVisuals] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthorized) { setLoading(false); return; }
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      const { data: clubsData, error: e1 } = await supabase
        .from("clubs")
        .select("*")
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (e1) setError(e1.message);
      setClubs(clubsData || []);

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("visuals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      if (!alive) return;
      setWeeklyVisuals(count || 0);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [isAuthorized]);

  async function toggleApprove(club) {
    const next = !club.approved;
    setClubs(prev => prev.map(c => c.id === club.id ? { ...c, approved: next } : c));
    const { error: e } = await supabase.from("clubs").update({ approved: next }).eq("id", club.id);
    if (e) setError(e.message);
  }

  async function setPlan(club, plan) {
    setClubs(prev => prev.map(c => c.id === club.id ? { ...c, plan } : c));
    const { error: e } = await supabase.from("clubs").update({ plan }).eq("id", club.id);
    if (e) setError(e.message);
  }

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: "100vh", background: "#080810", color: "#f0f0f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Accès refusé</div>
          <p style={{ fontSize: 13, color: "rgba(240,240,248,.5)", marginBottom: 22 }}>
            Cette zone est réservée. {session ? "Votre compte ne dispose pas des droits d'administration." : "Vous devez être connecté avec un compte autorisé."}
          </p>
          <button onClick={onClose} style={{ background: "#16162a", border: "1px solid rgba(255,255,255,.12)", color: "#f0f0f8", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: 13 }}>
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const totalClubs = clubs.length;
  const approvedClubs = clubs.filter(c => c.approved).length;

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#f0f0f8", padding: "24px 28px 60px", fontFamily: FONT, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Admin · Viziona</h1>
          <p style={{ color: "rgba(240,240,248,.4)", margin: "4px 0 0", fontSize: 12 }}>Connecté : {session.user.email}</p>
        </div>
        <button onClick={onClose} style={{ background: "#16162a", border: "1px solid rgba(255,255,255,.1)", color: "#f0f0f8", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: 12 }}>
          ← Retour à l'app
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 18 }}>
          Erreur : {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 22, maxWidth: 720 }}>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#a855f7", lineHeight: 1 }}>{totalClubs}</div>
          <div style={{ fontSize: 11, color: "rgba(240,240,248,.4)", marginTop: 6 }}>Clubs total</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#86efac", lineHeight: 1 }}>{approvedClubs}</div>
          <div style={{ fontSize: 11, color: "rgba(240,240,248,.4)", marginTop: 6 }}>Approuvés</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fbbf24", lineHeight: 1 }}>{totalClubs - approvedClubs}</div>
          <div style={{ fontSize: 11, color: "rgba(240,240,248,.4)", marginTop: 6 }}>En attente</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#60a5fa", lineHeight: 1 }}>{weeklyVisuals}</div>
          <div style={{ fontSize: 11, color: "rgba(240,240,248,.4)", marginTop: 6 }}>Visuels (7 derniers jours)</div>
        </div>
      </div>

      {/* Liste */}
      <div style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(240,240,248,.4)" }}>Chargement...</div>
        ) : clubs.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "rgba(240,240,248,.4)" }}>Aucun club inscrit.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#16162a" }}>
                <th style={th}>Club</th>
                <th style={th}>Email / User</th>
                <th style={th}>Inscription</th>
                <th style={th}>Plan</th>
                <th style={th}>Statut</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map(c => (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{c.name || "—"}</div>
                    {c.is_configured && <div style={{ fontSize: 10, color: "rgba(240,240,248,.4)", marginTop: 2 }}>configuré ✓</div>}
                  </td>
                  <td style={Object.assign({}, td, { color: "rgba(240,240,248,.6)", fontSize: 11 })}>
                    {c.email || (c.user_id ? c.user_id.slice(0, 8) + "…" : "—")}
                  </td>
                  <td style={Object.assign({}, td, { color: "rgba(240,240,248,.55)", fontSize: 11, whiteSpace: "nowrap" })}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td style={td}>
                    <select
                      value={c.plan || "BASIC"}
                      onChange={e => setPlan(c, e.target.value)}
                      style={{ background: "#1e1e38", border: "1px solid rgba(255,255,255,.12)", color: "#f0f0f8", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontFamily: FONT, cursor: "pointer" }}
                    >
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: ".04em", background: c.approved ? "rgba(34,197,94,.15)" : "rgba(251,191,36,.12)", color: c.approved ? "#86efac" : "#fbbf24" }}>
                      {c.approved ? "✓ APPROUVÉ" : "⏳ EN ATTENTE"}
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => toggleApprove(c)}
                      style={{ background: c.approved ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.18)", color: c.approved ? "#fca5a5" : "#86efac", border: "1px solid " + (c.approved ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.3)"), padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                    >
                      {c.approved ? "Refuser" : "Approuver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
