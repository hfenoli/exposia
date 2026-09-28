// ─── RÉDACTION ASSISTÉE — CÔTÉ NAVIGATEUR ────────────────────────────────
// Ce fichier ne contient AUCUNE clé. Il prépare la demande, appelle la
// fonction serveur (netlify/functions/ai-text.mjs) et lit sa réponse. La clé
// Anthropic vit uniquement dans les variables d'environnement de Netlify.
//
// Le quota n'est pas appliqué ici : ce qui est écrit dans cette page est
// modifiable depuis la console du navigateur. Le compteur affiché n'est
// qu'un confort ; la vraie limite est posée en base par ai_consume_credit.

const POINT = "/.netlify/functions/ai-text";

// ── Combien de caractères tiennent dans un calque ? ────────────────────────
// C'est la mesure la plus importante de tout le dispositif : un texte trop
// long déborde du cadre et rend le visuel inutilisable. On l'estime à partir
// de la géométrie réelle du calque — largeur et hauteur en pourcentage du
// canevas, taille de police en pixels de ce même canevas.
//
// Les trois constantes ont été calibrées contre les 160 textes par défaut des
// gabarits, tous sports et tous types confondus : ce sont les seuls dont on
// sait qu'ils tiennent, puisque le club les voit à l'écran.
//   · 0.44 — largeur moyenne d'un caractère rapportée à la taille de police.
//     Impact, la police des titres, est très étroite ; DM Sans l'est moins.
//   · 0.35 — tolérance sur le nombre de lignes. Un cadre qui fait 1.7 fois la
//     hauteur d'une ligne en accueille deux, le débord étant absorbé par le
//     centrage vertical. En dessous de 1.65, non.
//   · 0.90 — marge de sécurité finale. Un texte qui tient est toujours
//     préférable à un texte qui dépasse.
// Avec ces valeurs, aucun texte par défaut ne dépasse sa propre limite, et la
// limite reste à environ deux fois leur longueur : assez pour écrire, pas
// assez pour déborder.
export function maxCharsFor(lay, cw, ch) {
  const W = (cw || 270) * (Number(lay.w) || 50) / 100;
  const H = (ch || 480) * (Number(lay.h) || 10) / 100;
  const fs = Number(lay.fontSize) || 20;
  const lh = Number(lay.lineHeight) || 1.2;
  const parLigne = Math.max(4, W / (fs * 0.44));
  const lignes = Math.max(1, Math.floor(H / (fs * lh) + 0.35));
  return Math.max(10, Math.min(260, Math.round(parLigne * lignes * 0.90)));
}

// Les calques que l'IA peut écrire : ceux qui portent du texte libre.
// Le filigrane en est exclu — c'est un mot unique décoratif, pas une phrase.
const TYPES_TEXTE = ["text", "heading", "subtext"];
export function textLayersFor(layers, cw, ch) {
  return (layers || [])
    .filter(l => l && TYPES_TEXTE.includes(l.type) && !l.locked)
    .sort((a, b) => (a.z || 0) - (b.z || 0))
    .slice(0, 8)
    .map(l => ({ id: l.id, label: l.label || "Texte", text: l.text || "", maxChars: maxCharsFor(l, cw, ch) }));
}

async function jeton(supabase) {
  const { data } = await supabase.auth.getSession();
  return (data && data.session && data.session.access_token) || null;
}

// Combien de générations reste-t-il ce mois-ci ?
// Renvoie null si la migration 0008 n'est pas appliquée : l'appelant masque
// alors la fonction au lieu d'afficher une erreur.
export async function creditsState(supabase) {
  const { data, error } = await supabase.rpc("ai_credits_state");
  if (error) {
    console.warn("[ia] credits indisponibles:", error.message);
    return null;
  }
  const l = Array.isArray(data) ? data[0] : data;
  if (!l) return null;
  return { used: l.used || 0, allowed: l.allowed || 0, remaining: l.remaining || 0 };
}

/**
 * Demande trois versions des textes du visuel.
 * Renvoie { versions, restants } ou { erreur, quota?, inactif? }.
 * Ne lève jamais : l'éditeur ne doit pas planter parce que le réseau a lâché.
 */
export async function askForText({ supabase, type, typeLabel, sportLabel, vocabulaire, club, brief, layers }) {
  const tk = await jeton(supabase);
  if (!tk) return { erreur: "Session expirée. Reconnectez-vous." };

  let r;
  try {
    r = await fetch(POINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + tk },
      body: JSON.stringify({ type, typeLabel, sportLabel, vocabulaire, club, brief, layers }),
    });
  } catch (e) {
    console.warn("[ia] reseau:", e && e.message);
    return { erreur: "Pas de connexion. Réessayez une fois le réseau revenu." };
  }

  // Un 404 signifie que la fonction n'est pas déployée — typiquement en
  // développement local, ou avant le premier déploiement qui l'embarque.
  if (r.status === 404) return { erreur: "La rédaction assistée n'est pas disponible ici.", inactif: true };

  let corps = null;
  try { corps = await r.json(); } catch { corps = null; }
  if (!corps) return { erreur: "Réponse illisible du serveur. Réessayez." };
  if (!r.ok) return { erreur: corps.erreur || "La rédaction n'a pas abouti.", quota: !!corps.quota, inactif: !!corps.inactif };
  if (!Array.isArray(corps.versions) || !corps.versions.length) return { erreur: "Aucune proposition reçue. Réessayez." };
  return { versions: corps.versions, restants: corps.restants };
}
