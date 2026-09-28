// ════════════════════════════════════════════════════════════════════════════
// RÉDACTION ASSISTÉE — FONCTION SERVEUR
// ════════════════════════════════════════════════════════════════════════════
//
// POURQUOI UN SERVEUR
// Viziona est une application entièrement côté navigateur. Une clé API posée
// dans le bundle serait lisible par n'importe qui en trente secondes, et
// facturée au compte d'Anthropic de Viziona. Cette fonction est le seul
// endroit où la clé existe : elle n'est jamais envoyée au navigateur.
//
// CE QU'ELLE FAIT, DANS CET ORDRE
//   1. vérifie que l'appel porte un jeton de session Supabase valide ;
//   2. consomme un crédit EN BASE (fonction ai_consume_credit) — c'est là que
//      le quota est réellement appliqué, pas dans l'interface ;
//   3. appelle Claude ;
//   4. enregistre les jetons consommés, pour que la facture soit traçable.
//
// L'ordre compte : le crédit est pris AVANT l'appel payant. Si Claude échoue
// ensuite, on rend le crédit (voir plus bas) — l'inverse laisserait la porte
// ouverte à des appels gratuits en coupant la connexion au bon moment.
//
// FORMAT
// Écrite au format Web standard (Request → Response), qui est celui de
// Netlify Functions v2 ET de Cloudflare Workers / Pages Functions. Si le site
// déménage un jour chez Cloudflare, seul l'accès aux variables
// d'environnement change (voir `lireEnv`).
//
// VARIABLES D'ENVIRONNEMENT À DÉFINIR DANS NETLIFY
//   ANTHROPIC_API_KEY   la clé du compte Anthropic
//   VITE_SUPABASE_URL   déjà présente pour le site
//   VITE_SUPABASE_ANON_KEY  idem
// ════════════════════════════════════════════════════════════════════════════

const MODELE = "claude-sonnet-5";
const MAX_VARIANTES = 3;

function lireEnv(cle, contexte) {
  // Netlify et Node exposent process.env ; Cloudflare passe un objet `env`.
  if (contexte && contexte.env && contexte.env[cle]) return contexte.env[cle];
  if (typeof process !== "undefined" && process.env) return process.env[cle];
  return undefined;
}

function json(corps, statut) {
  return new Response(JSON.stringify(corps), {
    status: statut || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ─── Appels Supabase avec le jeton de l'utilisateur ─────────────────────────
// On ne se sert PAS de la clé de service : en transmettant le jeton de
// session, auth.uid() est renseigné côté base et les fonctions SECURITY
// DEFINER savent de quel club il s'agit. Aucun privilège élevé ne transite.
async function rpc(url, anon, jeton, nom, args) {
  const r = await fetch(url + "/rest/v1/rpc/" + nom, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anon,
      authorization: "Bearer " + jeton,
    },
    body: JSON.stringify(args || {}),
  });
  const texte = await r.text();
  let donnees = null;
  try { donnees = texte ? JSON.parse(texte) : null; } catch { donnees = texte; }
  return { ok: r.ok, statut: r.status, donnees };
}

// ─── Consigne de rédaction ──────────────────────────────────────────────────
// C'est ce bloc qui décide si le texte est utilisable ou s'il sonne comme une
// agence. Les interdits sont explicites parce qu'un modèle laissé libre
// produit spontanément le registre qu'on cherche justement à éviter.
function consigne(ctx) {
  const lignes = [
    "Tu écris les textes qui apparaissent SUR un visuel publié par un club de sport amateur suisse.",
    "",
    "CONTEXTE",
    "· Club : " + (ctx.club || "un club amateur"),
    "· Sport : " + (ctx.sportLabel || "sport collectif"),
    "· Type de visuel : " + (ctx.typeLabel || "publication"),
    "· Vocabulaire du sport à employer : " + (ctx.vocabulaire || "joueur, match, terrain"),
    "",
    "RÈGLES DE LONGUEUR — NON NÉGOCIABLES",
    "Chaque champ a une longueur maximale en caractères. Un texte plus long DÉBORDE",
    "du visuel et le rend inutilisable. Compte les caractères, espaces compris.",
    "Il vaut toujours mieux être plus court que la limite.",
    "",
    "RÈGLES D'ÉCRITURE",
    "· Français de Suisse romande. Vouvoiement si tu t'adresses au lecteur.",
    "· Le club parle à ses supporters, ses parents, ses joueurs. Pas à des clients.",
    "· Ton direct et fier, jamais grandiloquent.",
    "· N'invente AUCUN fait : ni score, ni nom, ni date, ni lieu qui ne soit pas",
    "  donné ci-dessous. S'il manque une information, écris un texte qui n'en a",
    "  pas besoin plutôt que de la deviner.",
    "· Pas d'emoji. Pas de hashtag. Pas de point d'exclamation multiple.",
    "· Interdits, parce qu'ils sonnent faux dans la bouche d'un club de village :",
    "  « incontournable », « au rendez-vous », « plus que jamais », « une page se",
    "  tourne », « dans l'ADN du club », « ensemble vers la victoire », « un état",
    "  d'esprit », « nos guerriers », « la famille », « l'aventure continue ».",
    "· Évite les phrases qui pourraient s'appliquer à n'importe quel club.",
    "  Ce qui est concret est toujours meilleur que ce qui est enthousiaste.",
    "",
    "CE QU'ON TE DEMANDE",
    "Propose " + MAX_VARIANTES + " versions NETTEMENT différentes les unes des autres :",
    "pas trois reformulations, trois angles. Par exemple un factuel, un chaleureux,",
    "un percutant. Chaque version remplit tous les champs demandés.",
  ];
  return lignes.join("\n");
}

function demande(ctx) {
  const champs = (ctx.layers || []).map(l =>
    "- id « " + l.id + " » : " + (l.label || "texte") +
    " — maximum " + l.maxChars + " caractères" +
    (l.text ? "\n  texte actuel (à remplacer, donne la longueur attendue) : " + JSON.stringify(l.text) : "")
  ).join("\n");
  return [
    "CE QUE LE CLUB VEUT DIRE",
    (ctx.brief && ctx.brief.trim()) ? ctx.brief.trim() : "(rien de précisé — reste général mais concret)",
    "",
    "CHAMPS À REMPLIR",
    champs || "(aucun)",
  ].join("\n");
}

// L'outil force une réponse structurée : pas de JSON à extraire d'une prose,
// donc pas d'échec de lecture à gérer.
function outil(ctx) {
  const props = {};
  for (const l of ctx.layers || []) {
    props[l.id] = { type: "string", description: (l.label || "texte") + ", " + l.maxChars + " caractères maximum" };
  }
  return {
    name: "proposer_textes",
    description: "Renvoie " + MAX_VARIANTES + " versions des textes du visuel.",
    input_schema: {
      type: "object",
      properties: {
        versions: {
          type: "array",
          minItems: MAX_VARIANTES,
          maxItems: MAX_VARIANTES,
          items: {
            type: "object",
            properties: Object.assign({
              angle: { type: "string", description: "Deux ou trois mots décrivant l'angle, affichés au club. Ex. « Factuel », « Chaleureux »." },
            }, props),
            required: ["angle"].concat(Object.keys(props)),
          },
        },
      },
      required: ["versions"],
    },
  };
}

export default async (request, contexte) => {
  if (request.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  const CLE = lireEnv("ANTHROPIC_API_KEY", contexte);
  const SB_URL = lireEnv("VITE_SUPABASE_URL", contexte) || lireEnv("SUPABASE_URL", contexte);
  const SB_ANON = lireEnv("VITE_SUPABASE_ANON_KEY", contexte) || lireEnv("SUPABASE_ANON_KEY", contexte);
  if (!CLE || !SB_URL || !SB_ANON) {
    console.error("[ai-text] variables d'environnement manquantes");
    return json({ erreur: "La rédaction assistée n'est pas configurée sur ce site." }, 503);
  }

  const auth = request.headers.get("authorization") || "";
  const jeton = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jeton) return json({ erreur: "Session expirée. Reconnectez-vous." }, 401);

  let ctx;
  try { ctx = await request.json(); } catch { return json({ erreur: "Requête illisible." }, 400); }

  const layers = Array.isArray(ctx.layers) ? ctx.layers.filter(l => l && l.id).slice(0, 8) : [];
  if (!layers.length) return json({ erreur: "Ce visuel n'a aucun texte à écrire." }, 400);
  for (const l of layers) {
    l.maxChars = Math.max(8, Math.min(400, parseInt(l.maxChars, 10) || 60));
    if (typeof l.text === "string") l.text = l.text.slice(0, 300);
    if (typeof l.label === "string") l.label = l.label.slice(0, 60);
  }
  ctx.layers = layers;
  if (typeof ctx.brief === "string") ctx.brief = ctx.brief.slice(0, 600);

  // ── Le quota, appliqué en base ────────────────────────────────────────────
  const credit = await rpc(SB_URL, SB_ANON, jeton, "ai_consume_credit", { p_kind: String(ctx.type || "") .slice(0, 24) });
  if (!credit.ok) {
    const msg = (credit.donnees && credit.donnees.message) || "";
    if (/Quota IA/.test(msg)) return json({ erreur: msg, quota: true }, 429);
    if (credit.statut === 401 || credit.statut === 403) return json({ erreur: "Session expirée. Reconnectez-vous." }, 401);
    if (/ai_consume_credit|function|does not exist|PGRST202/i.test(msg + JSON.stringify(credit.donnees || ""))) {
      // La migration 0008 n'est pas encore appliquée : on le dit clairement
      // plutôt que de laisser une erreur technique remonter.
      return json({ erreur: "La rédaction assistée n'est pas encore activée sur ce compte.", inactif: true }, 503);
    }
    console.error("[ai-text] credit refuse:", credit.statut, credit.donnees);
    return json({ erreur: "Impossible de vérifier votre quota. Réessayez dans un instant." }, 502);
  }
  const restants = typeof credit.donnees === "number" ? credit.donnees : null;

  // ── L'appel au modèle ─────────────────────────────────────────────────────
  // Tout échec à partir d'ici rend le crédit : le club ne paie pas une panne.
  async function echec(message, statut) {
    await rpc(SB_URL, SB_ANON, jeton, "ai_refund_credit", {})
      .catch(e => console.warn("[ai-text] remboursement impossible:", e && e.message));
    return json({ erreur: message, rendu: true }, statut || 502);
  }

  let rep;
  try {
    const t = outil(ctx);
    rep = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLE,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 1600,
        system: consigne(ctx),
        tools: [t],
        tool_choice: { type: "tool", name: t.name },
        messages: [{ role: "user", content: demande(ctx) }],
      }),
    });
  } catch (e) {
    console.error("[ai-text] reseau:", e && e.message);
    return echec("La rédaction n'a pas abouti. Votre crédit n'a pas été décompté.");
  }

  if (!rep.ok) {
    const detail = await rep.text().catch(() => "");
    console.error("[ai-text] anthropic", rep.status, detail.slice(0, 400));
    const msg = rep.status === 429
      ? "Le service de rédaction est saturé. Réessayez dans une minute."
      : "La rédaction n'a pas abouti. Réessayez dans un instant.";
    return echec(msg + " Votre crédit n'a pas été décompté.");
  }

  const data = await rep.json();
  const bloc = (data.content || []).find(c => c.type === "tool_use");
  const versions = bloc && bloc.input && Array.isArray(bloc.input.versions) ? bloc.input.versions : [];
  if (!versions.length) {
    console.error("[ai-text] reponse sans versions:", JSON.stringify(data).slice(0, 400));
    return echec("La rédaction n'a rien renvoyé. Réessayez — votre crédit n'a pas été décompté.");
  }

  // Le modèle dépasse parfois la limite d'un ou deux caractères. On tronque
  // proprement sur un mot plutôt que de renvoyer un texte qui déborde.
  const limites = {}; for (const l of layers) limites[l.id] = l.maxChars;
  const propres = versions.slice(0, MAX_VARIANTES).map(v => {
    const o = { angle: String(v.angle || "").slice(0, 40) };
    for (const id in limites) {
      let s = typeof v[id] === "string" ? v[id].trim() : "";
      if (s.length > limites[id]) {
        s = s.slice(0, limites[id]);
        const esp = s.lastIndexOf(" ");
        if (esp > limites[id] * 0.6) s = s.slice(0, esp);
        s = s.replace(/[\s,;:]+$/, "");
      }
      o[id] = s;
    }
    return o;
  });

  // Traçabilité de la facture. Un échec ici ne doit rien casser côté club.
  const u = data.usage || {};
  rpc(SB_URL, SB_ANON, jeton, "ai_record_tokens", { p_in: u.input_tokens || 0, p_out: u.output_tokens || 0 })
    .catch(e => console.warn("[ai-text] jetons non enregistres:", e && e.message));

  return json({ versions: propres, restants });
};
