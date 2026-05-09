import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "Comment installer l'application sur mobile ?",
    a: "Sur iPhone, ouvrez le site dans Safari, appuyez sur le bouton de partage (carré avec flèche), puis « Sur l'écran d'accueil ». Sur Android, ouvrez le site dans Chrome, appuyez sur le menu trois points puis « Ajouter à l'écran d'accueil ». L'application apparaît alors comme une app native, sans barre d'adresse.",
  },
  {
    q: "La connexion ne fonctionne pas, que faire ?",
    a: "Essayez d'abord de rafraîchir la page (Cmd+R sur Mac, Ctrl+R ailleurs). Si le problème persiste, ouvrez le site en navigation privée pour exclure un problème de cache ou d'extensions. En dernier recours, videz le cache de votre navigateur. Si rien ne fonctionne, écrivez-nous.",
  },
  {
    q: "Mes visuels et données sont-ils sauvegardés ?",
    a: "Oui. Tous les visuels créés, photos de joueurs, médias et configurations de club sont stockés en cloud chez notre prestataire d'hébergement (Supabase, conforme RGPD). Vous retrouvez vos visuels en vous reconnectant depuis n'importe quel appareil avec vos identifiants.",
  },
  {
    q: "Puis-je modifier ou supprimer un visuel après l'avoir créé ?",
    a: "Oui. Tous vos visuels sont accessibles dans l'onglet « Historique ». Vous pouvez en réouvrir un pour le modifier (les modifications écrasent la version précédente) ou le supprimer définitivement. La suppression est irréversible.",
  },
  {
    q: "Combien coûte le service ?",
    a: "Pendant la phase de bêta, l'accès est gratuit pour les clubs sélectionnés. Une grille tarifaire sera communiquée avant le passage en version commerciale. Les utilisateurs bêta bénéficieront de conditions préférentielles.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Écrivez-nous à contact@viziona-sport.com. Nous répondons généralement sous 24 heures les jours ouvrés. Précisez votre nom de club et le problème rencontré (avec une capture d'écran si possible).",
  },
];

export default function Landing({ onEnter }) {
  const [openFaq, setOpenFaq] = useState(null);
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
          <img src="/team/logo.jpg" alt="Viziona Sport" style={{ width: 28, height: 28, display: "block" }} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.08em" }}>Viziona Sport</span>
        </div>
        <a href="mailto:contact@viziona-sport.com" style={{
          fontSize: 13,
          color: "#0a0a0a",
          textDecoration: "none",
          letterSpacing: "0.04em",
          opacity: 0.5,
        }}>
          contact@viziona-sport.com
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
          Viziona Sport permet aux clubs de football de créer des visuels professionnels en quelques secondes — aux couleurs de leur équipe, depuis leur téléphone.
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
            Accéder à Viziona Sport
          </button>
          <a
            href="mailto:contact@viziona-sport.com"
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
              photo: "/team/hugo.jpg",
            },
            {
              nom: "Lucas Di Pasquale",
              role: "Co-fondateur",
              photo: "/team/lucas.jpg",
            },
          ].map((p) => (
            <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img
                src={p.photo}
                alt={p.nom}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  background: "#f0f0f0",
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a" }}>{p.nom}</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2, letterSpacing: "0.04em" }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* FAQ */}
      <section id="faq" style={{
        width: "100%",
        background: "#ffffff",
        padding: "56px 0",
        display: "flex",
        justifyContent: "center",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 720,
          padding: "0 40px",
          boxSizing: "border-box",
        }}>
          <p style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: 14,
            fontWeight: 500,
          }}>
            Questions fréquentes
          </p>
          <h2 style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            margin: "0 0 36px",
            color: "#0a0a0a",
          }}>
            Tout ce que vous voulez savoir.
          </h2>
          <div>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "20px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                      color: "#0a0a0a",
                    }}
                  >
                    <span style={{
                      fontSize: 15,
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                      flex: 1,
                    }}>
                      {item.q}
                    </span>
                    <span style={{
                      fontSize: 20,
                      fontWeight: 300,
                      color: "#888",
                      lineHeight: 1,
                      flexShrink: 0,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                      transition: "transform .18s ease",
                    }}>
                      +
                    </span>
                  </button>
                  <div style={{
                    maxHeight: isOpen ? 400 : 0,
                    overflow: "hidden",
                    transition: "max-height .25s ease",
                  }}>
                    <p style={{
                      fontSize: 14,
                      color: "#555",
                      lineHeight: 1.65,
                      margin: 0,
                      paddingBottom: 22,
                      paddingRight: 36,
                    }}>
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* CGU */}
      <section id="cgu" style={{
        width: "100%",
        background: "#fafafa",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "48px 0",
        display: "flex",
        justifyContent: "center",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 900,
          padding: "0 40px",
          boxSizing: "border-box",
        }}>
          <p style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: 8,
            fontWeight: 600,
          }}>
            Conditions générales d'utilisation
          </p>
          <p style={{ fontSize: 11, color: "#aaa", marginBottom: 28, letterSpacing: "0.02em" }}>
            En vigueur au 7 mai 2026
          </p>

          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>1. Nature du service</div>
              <p style={{ margin: 0 }}>
                Viziona Sport est un outil SaaS permettant aux clubs sportifs de créer des visuels (compositions, scores, annonces, recrues) à partir de leurs propres données. L'accès est délivré sur demande après validation manuelle. Viziona Sport se réserve le droit de refuser, suspendre ou révoquer un accès à tout moment, sans justification.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>2. Données personnelles</div>
              <p style={{ margin: 0 }}>
                Les données saisies par l'utilisateur (nom du club, joueurs, photos, médias) sont stockées de manière sécurisée chez nos prestataires d'hébergement. Elles ne sont jamais transmises à des tiers à des fins commerciales. Le traitement est conforme au Règlement Général sur la Protection des Données (RGPD) et à la Loi fédérale suisse sur la protection des données (nLPD). L'utilisateur peut demander à tout moment la suppression de ses données en écrivant à <a href="mailto:contact@viziona-sport.com" style={{ color: "#0a0a0a" }}>contact@viziona-sport.com</a>.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>3. Propriété intellectuelle</div>
              <p style={{ margin: 0 }}>
                Les visuels créés via Viziona Sport appartiennent intégralement au club utilisateur, qui en conserve l'usage exclusif. Viziona Sport se réserve néanmoins le droit d'utiliser des captures anonymisées (sans nom de club identifiable) à des fins de démonstration commerciale, marketing ou de présentation du produit.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>4. Limitation de responsabilité</div>
              <p style={{ margin: 0 }}>
                Le service est fourni en l'état, sans garantie de disponibilité continue. Viziona Sport ne saurait être tenu responsable d'une interruption de service, d'une perte de données, d'une indisponibilité temporaire, ni d'un usage inapproprié des visuels créés par l'utilisateur (notamment publication à caractère diffamatoire, contrefaisant ou violant les droits de tiers).
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>5. Droit applicable et juridiction</div>
              <p style={{ margin: 0 }}>
                Les présentes conditions sont soumises au droit suisse. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux de Genève, sous réserve des voies de recours auprès du Tribunal fédéral.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>6. Contact</div>
              <p style={{ margin: 0 }}>
                Pour toute question relative aux présentes conditions ou au service : <a href="mailto:contact@viziona-sport.com" style={{ color: "#0a0a0a" }}>contact@viziona-sport.com</a>.
              </p>
            </div>
          </div>
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
          © 2025 Viziona Sport · Suisse
        </span>
        <a href="mailto:contact@viziona-sport.com" style={{
          fontSize: 12,
          color: "#aaa",
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}>
          contact@viziona-sport.com
        </a>
      </footer>
    </div>
  );
}
