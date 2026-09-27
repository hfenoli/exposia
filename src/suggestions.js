// ─── SUGGESTIONS DU JOUR ──────────────────────────────────────
// Un club amateur ne manque pas d'idées, il manque de temps : le samedi à
// 17h, personne n'ouvre l'app pour réfléchir à quoi publier. Ce module
// propose une ou deux actions selon le jour, le moment de la saison et le
// temps écoulé depuis le dernier visuel, et livre un texte déjà écrit que
// le club n'a plus qu'à corriger.
//
// Aucune donnée de calendrier n'existe côté base : les règles ne s'appuient
// donc que sur la date du téléphone et sur la date du dernier visuel.
//
// Trois principes de rédaction :
//  · le bandeau parle AU club (vouvoiement, comme le reste du studio) ;
//  · le texte pré-rempli est ce que le club PUBLIE : il s'adresse à ses
//    supporters et doit pouvoir partir tel quel, quitte à être corrigé ;
//  · rien qui sonne comme un reproche, y compris la relance après silence.

import { termsFor, isTeamSport, getSport } from "./sports";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
              "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « Samedi 3 octobre » — la date du prochain jour de match, pré-remplie sur
// l'affiche. C'est le seul élément que le club ne peut pas deviner plus vite
// que nous.
function prochainJour(now, dow) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let delta = (dow - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}
function dateLongue(d) {
  const j = JOURS[d.getDay()];
  return j.charAt(0).toUpperCase() + j.slice(1) + " " + d.getDate() + " " + MOIS[d.getMonth()];
}

/**
 * Contexte d'évaluation des règles.
 * @param now        Date courante (injectable pour les tests).
 * @param sport      Identifiant du sport du club.
 * @param clubName   Nom du club, ou chaîne vide.
 * @param lastAt     Date ISO du dernier visuel, ou null si le club n'en a aucun.
 */
export function suggestionContext(now, sport, clubName, lastAt) {
  const T = termsFor(sport);
  const jours = lastAt ? Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86400000) : null;
  return {
    now,
    dow: now.getDay(),
    heure: now.getHours(),
    mois: now.getMonth() + 1,
    jourDuMois: now.getDate(),
    annee: now.getFullYear(),
    sport,
    T,
    equipe: isTeamSport(sport),
    types: getSport(sport).types,
    club: (clubName || "").trim(),
    clubMaj: (clubName || "").trim().toUpperCase() || "NOTRE CLUB",
    joursDepuis: jours,
  };
}

// Chaque règle : quand elle s'applique, ce qu'elle dit au club, et ce qu'elle
// pré-remplit. `fill.layers` associe un identifiant de calque à son texte ;
// `fill.group` et `fill.lineup` visent les deux éditeurs qui n'utilisent pas
// de calques.
const REGLES = [

  // ── Silence ──────────────────────────────────────────────────────────
  // Priorité la plus haute : un compte qui s'éteint est le seul problème que
  // le club ne voit pas tout seul. Le ton reste factuel, jamais culpabilisant,
  // et la suggestion propose la publication la plus facile qui soit.
  {
    id: "silence",
    prio: 50,
    type: "post",
    when: c => c.joursDepuis !== null && c.joursDepuis >= 10,
    titre: c => "Rien publié depuis " + c.joursDepuis + " jours",
    corps: c => "Une photo d'entraînement suffit à garder le compte vivant entre deux " + (c.equipe ? "matchs" : "compétitions") + ".",
    action: "Publier une photo",
    fill: c => ({ layers: {
      h1: "À L'ENTRAÎNEMENT",
      h2: c.club || "Notre semaine",
      bd: "Le travail de la semaine, avant le prochain rendez-vous.",
    }}),
  },

  // ── Saison ───────────────────────────────────────────────────────────
  {
    id: "nouvel-an",
    prio: 42,
    type: "post",
    when: c => c.mois === 1 && c.jourDuMois <= 6,
    titre: "Bonne année",
    corps: "Le premier post de l'année est toujours l'un des plus vus.",
    action: "Écrire les vœux",
    fill: c => ({ layers: {
      h1: "BONNE ANNÉE " + c.annee,
      h2: c.club || "",
      bd: "Merci à nos " + c.T.playersLower + ", à l'encadrement, aux bénévoles et à tous ceux qui nous suivent. La suite arrive vite.",
    }}),
  },
  {
    id: "treve",
    prio: 40,
    type: "post",
    when: c => c.equipe && c.mois === 12 && c.jourDuMois >= 10,
    titre: "La trêve approche",
    corps: "Un mot de fin d'année avant que tout le monde décroche pour deux mois.",
    action: "Remercier la saison",
    fill: c => ({ layers: {
      h1: "MERCI POUR CE PREMIER TOUR",
      h2: c.club || "",
      bd: "On se retrouve à la reprise. D'ici là, bonnes fêtes à tous.",
    }}),
  },
  {
    id: "reprise",
    prio: 40,
    type: "post",
    when: c => c.equipe && c.mois === 8 && c.jourDuMois <= 20,
    titre: "La reprise approche",
    corps: "Annoncez la date du premier entraînement pendant que tout le monde rentre de vacances.",
    action: "Annoncer la reprise",
    fill: c => ({ layers: {
      h1: "REPRISE",
      h2: "Saison " + c.annee + "-" + (c.annee + 1),
      bd: "Premier entraînement le … à … au " + c.T.venue.toLowerCase() + ". Anciens et nouveaux, tout le monde est le bienvenu.",
    }}),
  },
  {
    id: "recrutement",
    prio: 38,
    type: "post",
    when: c => c.equipe && c.mois === 7,
    titre: "C'est la période des transferts",
    corps: "Juillet est le mois où les familles cherchent un club pour la rentrée.",
    action: "Lancer un appel",
    fill: c => ({ layers: {
      h1: "LE CLUB RECRUTE",
      h2: "Saison " + c.annee + "-" + (c.annee + 1),
      bd: "Toutes catégories. Venez essayer un entraînement, sans engagement.",
    }}),
  },
  {
    id: "fin-saison",
    prio: 38,
    type: "post",
    when: c => c.mois === 6,
    titre: "Fin de saison",
    corps: "Le moment de remercier tout le monde, joueurs comme bénévoles.",
    action: "Faire le bilan",
    fill: c => ({ layers: {
      h1: "FIN DE SAISON",
      h2: c.club || "",
      bd: "Merci à nos " + c.T.playersLower + ", à l'encadrement et à tous ceux qui étaient là toute l'année.",
    }}),
  },

  // ── Jour de match ────────────────────────────────────────────────────
  // Le matin la convocation, l'après-midi la composition, le soir le score.
  // C'est l'ordre réel d'un samedi, et c'est ce qui fait gagner du temps.
  {
    id: "jour-j-groupe",
    prio: 36,
    type: "group",
    when: c => (c.dow === 6 || c.dow === 0) && c.heure < 12,
    titre: c => "Jour de " + c.T.matchLower,
    corps: c => "Le groupe est connu ? Publiez la " + (c.equipe ? "convocation" : "délégation") + " avant le départ.",
    action: c => c.equipe ? "Publier le groupe" : "Publier la délégation",
    fill: c => ({ group: { title: c.T.groupTitle } }),
  },
  {
    id: "jour-j-compo",
    prio: 35,
    type: "lineup",
    when: c => (c.dow === 6 || c.dow === 0) && c.heure >= 12 && c.heure < 18,
    titre: "Coup d'envoi bientôt",
    corps: c => "La " + (c.T.lineupShort || "composition").toLowerCase() + ", une minute avant de rentrer au vestiaire.",
    action: "Publier la compo",
    fill: () => ({}),
  },
  {
    // Natation et triathlon n'ont pas de composition : l'après-midi d'une
    // compétition, ce qu'ils publient c'est un temps.
    id: "jour-j-chrono",
    prio: 34,
    type: "perf",
    when: c => !c.equipe && (c.dow === 6 || c.dow === 0) && c.heure >= 12 && c.heure < 18,
    titre: "En pleine épreuve",
    corps: "Un temps, un record personnel : publiez-le à chaud.",
    action: "Publier un chrono",
    fill: () => ({}),
  },
  {
    id: "jour-j-score",
    prio: 36,
    type: "result",
    when: c => (c.dow === 6 || c.dow === 0) && c.heure >= 18,
    titre: "Le résultat",
    corps: "Publiez-le tant que tout le monde est encore dessus.",
    action: "Publier le score",
    fill: () => ({}),
  },

  // ── Veille de match ──────────────────────────────────────────────────
  {
    id: "veille-affiche",
    prio: 30,
    type: "match",
    when: c => c.dow === 5,
    titre: c => "C'est " + (c.equipe ? "match" : "course") + " ce week-end",
    corps: "L'affiche publiée la veille au soir est le post qui fait venir le plus de monde.",
    action: "Préparer l'affiche",
    fill: c => {
      const d = prochainJour(c.now, 6);
      return { layers: {
        cn: c.clubMaj,
        dt: dateLongue(d),
        vn: c.T.venue,
        ev: dateLongue(d),
      }};
    },
  },

  // ── Semaine ──────────────────────────────────────────────────────────
  {
    id: "lundi-retour",
    prio: 22,
    type: "post",
    when: c => c.dow === 1,
    titre: "Retour sur le week-end",
    corps: c => "Un merci et une photo, et le compte tient jusqu'" + (c.T.matchLower === "match" ? "au prochain match" : "à la prochaine " + c.T.matchLower) + ".",
    action: "Écrire le retour",
    fill: c => ({ layers: {
      h1: "RETOUR SUR LE WEEK-END",
      h2: c.club || "",
      bd: "Merci à tous ceux qui étaient là pour nous soutenir. On remet ça très vite.",
    }}),
  },
  {
    id: "entrainement",
    prio: 14,
    type: "post",
    when: c => c.dow === 2 || c.dow === 4,
    titre: "Entraînement ce soir",
    corps: "Le rappel de la séance fait venir les indécis.",
    action: "Rappeler la séance",
    fill: c => ({ layers: {
      h1: "ENTRAÎNEMENT CE SOIR",
      h2: "19h00 · " + c.T.venue,
      bd: "On compte sur vous. Pensez à prévenir en cas d'absence.",
    }}),
  },
  {
    id: "portrait",
    prio: 12,
    type: "post",
    when: c => c.dow === 3,
    titre: c => "Présentez un de vos " + c.T.playersLower,
    corps: "Les portraits sont les publications les plus partagées par les familles.",
    action: "Faire un portrait",
    fill: c => ({ layers: {
      h1: "PORTRAIT",
      h2: "Prénom Nom",
      bd: "Au club depuis trois saisons. " + c.T.positionLabel + " : à compléter. Toujours le premier arrivé à l'entraînement.",
    }}),
  },
];

function resoudre(v, c) { return typeof v === "function" ? v(c) : v; }

/**
 * Jusqu'à `max` suggestions pour le contexte donné, les plus prioritaires
 * d'abord, sans deux fois le même type de visuel. Une règle dont le type
 * n'existe pas dans le sport du club est ignorée : pas de composition en
 * natation, pas de « but » en triathlon.
 */
export function suggestionsFor(ctx, max) {
  const vues = {};
  const out = [];
  REGLES.slice()
    .sort((a, b) => b.prio - a.prio)
    .forEach(r => {
      if (out.length >= (max || 2)) return;
      if (!ctx.types.includes(r.type)) return;
      if (vues[r.type]) return;
      let ok = false;
      try { ok = r.when(ctx); } catch { ok = false; }
      if (!ok) return;
      vues[r.type] = true;
      out.push({
        id: r.id,
        type: r.type,
        titre: resoudre(r.titre, ctx),
        corps: resoudre(r.corps, ctx),
        action: resoudre(r.action, ctx),
        fill: r.fill ? r.fill(ctx) : {},
      });
    });
  return out;
}
