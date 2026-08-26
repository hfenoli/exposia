// ─── REGISTRE DES SPORTS ──────────────────────────────────────
// Un club = un sport, choisi à la première connexion.
//
// Le point important n'est pas le vocabulaire mais la STRUCTURE : natation et
// triathlon ne sont pas des sports d'équipe. « But » et « Composition XI » n'y
// ont aucun sens ; il leur faut leurs propres types de visuels (chrono,
// podium). D'où le champ `kind` et la liste `types` propre à chaque sport.
//
// Les clés de stockage (positions dans `players.position`, catégories dans
// `visuals.group_data`) restent volontairement les mêmes d'un sport à l'autre
// pour ne pas casser les visuels déjà enregistrés : seuls les libellés et les
// filtres changent.

export const DEFAULT_SPORT = "football";

// Vocabulaire par défaut — chaque sport n'écrase que ce qui diffère.
const BASE_TERMS = {
  player: "Joueur", players: "Joueurs", playerLower: "joueur", playersLower: "joueurs",
  squad: "Effectif", squadTitle: "Effectif & Photos", squadDesc: "Vos joueurs avec leurs photos.",
  newPlayer: "Nouveau joueur", addToSquad: "+ Ajouter à l'effectif", emptySquad: "Aucun joueur",
  positionLabel: "Poste", numberLabel: "Numéro", numberPlaceholder: "9",
  match: "Match", matchLower: "match", opponent: "Adversaire", venue: "Stade",
  competition: "Compétition", competitionPlaceholder: "2e ligue · J12",
  scoreEvent: "BUT !", scoreEventShort: "BUT",
  lineupTitle: "Composition XI", lineupShort: "Composition", formationLabel: "Formation",
  staff: "Staff", squadSection: "Joueurs & groupe",
};

// Définitions de base des types de visuels. Chaque sport en retient une
// sélection et peut en changer le libellé.
export const CTYPE_BASE = {
  goal:    { label: "But",            desc: "Célébration d'un but" },
  result:  { label: "Score Final",    desc: "Résultat du match" },
  match:   { label: "Affiche Match",  desc: "Avant-match" },
  group:   { label: "Groupe",         desc: "Convocation officielle" },
  lineup:  { label: "Composition XI", desc: "11 de départ" },
  recruit: { label: "Nouvelle Recrue", desc: "Arrivée d'un joueur" },
  post:    { label: "Poste / Annonce", desc: "Publication libre" },
  perf:    { label: "Performance",    desc: "Chrono, record personnel" },
  podium:  { label: "Podium",         desc: "Classement d'une épreuve" },
};

// Un rang de composition : n joueurs, un libellé affiché, et les postes dans
// lesquels le remplissage automatique va puiser (le libellé par défaut).
function R(n, l, p) { return { n, l, p: p || [l] }; }

const TEAM_TYPES = ["goal", "result", "match", "group", "lineup", "recruit", "post"];
const SOLO_TYPES = ["perf", "result", "podium", "match", "group", "recruit", "post"];

export const SPORTS = {
  football: {
    id: "football", label: "Football", kind: "team", pitch: "football",
    positions: ["Gardien", "Défenseur", "Milieu", "Attaquant"],
    defaultPosition: "Attaquant",
    formations: {
      "4-4-2":   [R(1,"Gardien"), R(4,"Défenseur"), R(4,"Milieu"), R(2,"Attaquant")],
      "4-3-3":   [R(1,"Gardien"), R(4,"Défenseur"), R(3,"Milieu"), R(3,"Attaquant")],
      "4-2-3-1": [R(1,"Gardien"), R(4,"Défenseur"), R(2,"Milieu"), R(3,"Milieu offensif",["Milieu","Attaquant"]), R(1,"Attaquant")],
      "3-5-2":   [R(1,"Gardien"), R(3,"Défenseur"), R(5,"Milieu"), R(2,"Attaquant")],
      "5-3-2":   [R(1,"Gardien"), R(5,"Défenseur"), R(3,"Milieu"), R(2,"Attaquant")],
      "3-4-3":   [R(1,"Gardien"), R(3,"Défenseur"), R(4,"Milieu"), R(3,"Attaquant")],
    },
    groupCats: [
      { k: "gk",      l: "Gardiens",   pos: ["Gardien"] },
      { k: "def",     l: "Défenseurs", pos: ["Défenseur"] },
      { k: "mid",     l: "Milieux",    pos: ["Milieu"] },
      { k: "fwd",     l: "Attaquants", pos: ["Attaquant"] },
      { k: "coaches", l: "Staff",      pos: null },
    ],
    types: TEAM_TYPES,
    terms: {},
  },

  rugby: {
    id: "rugby", label: "Rugby", kind: "team", pitch: "rugby",
    positions: ["Pilier", "Talonneur", "Deuxième ligne", "Troisième ligne", "Demi de mêlée", "Demi d'ouverture", "Centre", "Ailier", "Arrière"],
    defaultPosition: "Centre",
    formations: {
      // Rangs de l'arrière vers l'avant : 15 titulaires au total.
      "XV de départ": [R(1,"Arrière"), R(2,"Ailier"), R(2,"Centre"), R(2,"Demi",["Demi d'ouverture","Demi de mêlée"]), R(3,"Troisième ligne"), R(2,"Deuxième ligne"), R(3,"Première ligne",["Pilier","Talonneur"])],
      "Rugby à 7":    [R(1,"Arrière"), R(3,"Trois-quarts",["Centre","Ailier"]), R(3,"Avants",["Pilier","Talonneur","Troisième ligne"])],
      "Rugby à 10":   [R(1,"Arrière"), R(3,"Trois-quarts",["Centre","Ailier"]), R(3,"Demis & centres",["Demi d'ouverture","Demi de mêlée","Centre"]), R(3,"Avants",["Pilier","Talonneur","Deuxième ligne"])],
    },
    groupCats: [
      { k: "gk",      l: "Première ligne",  pos: ["Pilier", "Talonneur"] },
      { k: "def",     l: "Deuxième/troisième ligne", pos: ["Deuxième ligne", "Troisième ligne"] },
      { k: "mid",     l: "Demis",           pos: ["Demi de mêlée", "Demi d'ouverture"] },
      { k: "fwd",     l: "Trois-quarts",    pos: ["Centre", "Ailier", "Arrière"] },
      { k: "coaches", l: "Staff",           pos: null },
    ],
    types: TEAM_TYPES,
    terms: {
      scoreEvent: "ESSAI !", scoreEventShort: "ESSAI",
      lineupTitle: "Composition XV", competitionPlaceholder: "LNA · J12",
    },
    typeLabels: { goal: { label: "Essai", desc: "Célébration d'un essai" }, lineup: { label: "Composition XV", desc: "XV de départ" } },
  },

  hockey: {
    id: "hockey", label: "Hockey sur glace", kind: "team", pitch: "ice",
    positions: ["Gardien", "Défenseur", "Ailier", "Centre"],
    defaultPosition: "Centre",
    formations: {
      "Alignement 5+1": [R(1,"Gardien"), R(2,"Défenseur"), R(3,"Attaque",["Ailier","Centre"])],
      "Powerplay":      [R(1,"Gardien"), R(1,"Défenseur"), R(3,"Attaque",["Ailier","Centre"]), R(1,"Pointe",["Défenseur","Centre"])],
      "Box play":       [R(1,"Gardien"), R(2,"Défenseur"), R(2,"Attaque",["Ailier","Centre"])],
    },
    groupCats: [
      { k: "gk",      l: "Gardiens",   pos: ["Gardien"] },
      { k: "def",     l: "Défenseurs", pos: ["Défenseur"] },
      { k: "fwd",     l: "Attaquants", pos: ["Ailier", "Centre"] },
      { k: "coaches", l: "Staff",      pos: null },
    ],
    types: TEAM_TYPES,
    terms: {
      venue: "Patinoire", lineupTitle: "Alignement", lineupShort: "Alignement",
      formationLabel: "Ligne", competitionPlaceholder: "MyHockey League · J12",
    },
    typeLabels: { goal: { }, lineup: { label: "Alignement", desc: "Ligne de départ" } },
  },

  basketball: {
    id: "basketball", label: "Basketball", kind: "team", pitch: "court",
    positions: ["Meneur", "Arrière", "Ailier", "Ailier fort", "Pivot"],
    defaultPosition: "Ailier",
    formations: {
      "Cinq de départ": [R(2,"Extérieurs",["Meneur","Arrière"]), R(2,"Ailiers",["Ailier","Ailier fort"]), R(1,"Pivot")],
      "Small ball":     [R(2,"Extérieurs",["Meneur","Arrière"]), R(3,"Ailiers",["Ailier","Ailier fort"])],
      "Twin towers":    [R(1,"Meneur"), R(2,"Extérieurs",["Arrière","Ailier"]), R(2,"Intérieurs",["Ailier fort","Pivot"])],
    },
    groupCats: [
      { k: "gk",      l: "Meneurs",    pos: ["Meneur"] },
      { k: "mid",     l: "Extérieurs", pos: ["Arrière", "Ailier"] },
      { k: "fwd",     l: "Intérieurs", pos: ["Ailier fort", "Pivot"] },
      { k: "coaches", l: "Staff",      pos: null },
    ],
    types: TEAM_TYPES,
    terms: {
      venue: "Salle", scoreEvent: "PANIER !", scoreEventShort: "PANIER",
      lineupTitle: "Cinq de départ", lineupShort: "Cinq de départ",
      competitionPlaceholder: "SB League · J12",
    },
    typeLabels: { goal: { label: "Panier", desc: "Action décisive" }, lineup: { label: "Cinq de départ", desc: "Les 5 titulaires" } },
  },

  handball: {
    id: "handball", label: "Handball", kind: "team", pitch: "handball",
    positions: ["Gardien", "Ailier", "Arrière", "Demi-centre", "Pivot"],
    defaultPosition: "Arrière",
    formations: {
      "Sept de départ": [R(1,"Gardien"), R(3,"Arrières",["Arrière","Demi-centre"]), R(3,"Ailiers & pivot",["Ailier","Pivot"])],
      "Défense 6-0":    [R(1,"Gardien"), R(6,"Défense",["Arrière","Demi-centre","Ailier","Pivot"])],
      "Défense 5-1":    [R(1,"Gardien"), R(5,"Défense",["Arrière","Ailier","Pivot"]), R(1,"Avancé",["Demi-centre"])],
    },
    groupCats: [
      { k: "gk",      l: "Gardiens", pos: ["Gardien"] },
      { k: "def",     l: "Arrières", pos: ["Arrière", "Demi-centre"] },
      { k: "fwd",     l: "Ailiers & pivots", pos: ["Ailier", "Pivot"] },
      { k: "coaches", l: "Staff",    pos: null },
    ],
    types: TEAM_TYPES,
    terms: {
      venue: "Salle", lineupTitle: "Sept de départ", lineupShort: "Sept de départ",
      competitionPlaceholder: "SHL · J12",
    },
    typeLabels: { goal: { }, lineup: { label: "Sept de départ", desc: "Les 7 titulaires" } },
  },

  natation: {
    id: "natation", label: "Natation", kind: "individual", pitch: null,
    positions: ["Nage libre", "Dos", "Brasse", "Papillon", "4 nages", "Eau libre"],
    defaultPosition: "Nage libre",
    formations: null,
    groupCats: [
      { k: "fwd",     l: "Nageurs",      pos: null },
      { k: "coaches", l: "Encadrement",  pos: null },
    ],
    types: SOLO_TYPES,
    terms: {
      player: "Nageur", players: "Nageurs", playerLower: "nageur", playersLower: "nageurs",
      squad: "Équipe", squadTitle: "Nageurs & Photos", squadDesc: "Vos nageurs avec leurs photos.",
      newPlayer: "Nouveau nageur", addToSquad: "+ Ajouter à l'équipe", emptySquad: "Aucun nageur",
      positionLabel: "Spécialité", numberLabel: "N° de licence", numberPlaceholder: "1234",
      match: "Compétition", matchLower: "compétition", opponent: "Club adverse", venue: "Piscine",
      competitionPlaceholder: "Championnats romands",
      staff: "Encadrement", squadSection: "Nageurs & délégation",
    },
    typeLabels: {
      result:  { label: "Résultats",        desc: "Bilan d'une compétition" },
      match:   { label: "Affiche Compét'",  desc: "Annonce d'une compétition" },
      group:   { label: "Délégation",       desc: "Nageurs engagés" },
      recruit: { label: "Nouveau Nageur",   desc: "Arrivée dans le club" },
      perf:    { label: "Chrono",           desc: "Temps, record personnel" },
    },
  },

  triathlon: {
    id: "triathlon", label: "Triathlon", kind: "individual", pitch: null,
    positions: ["Sprint", "Olympique", "Half (70.3)", "Ironman", "Relais", "Cross"],
    defaultPosition: "Olympique",
    formations: null,
    groupCats: [
      { k: "fwd",     l: "Athlètes",     pos: null },
      { k: "coaches", l: "Encadrement",  pos: null },
    ],
    types: SOLO_TYPES,
    terms: {
      player: "Athlète", players: "Athlètes", playerLower: "athlète", playersLower: "athlètes",
      squad: "Équipe", squadTitle: "Athlètes & Photos", squadDesc: "Vos athlètes avec leurs photos.",
      newPlayer: "Nouvel athlète", addToSquad: "+ Ajouter à l'équipe", emptySquad: "Aucun athlète",
      positionLabel: "Format", numberLabel: "Dossard", numberPlaceholder: "142",
      match: "Course", matchLower: "course", opponent: "Épreuve", venue: "Lieu",
      competitionPlaceholder: "Ironman 70.3 Rapperswil",
      staff: "Encadrement", squadSection: "Athlètes & délégation",
    },
    typeLabels: {
      result:  { label: "Résultats",       desc: "Bilan d'une course" },
      match:   { label: "Affiche Course",  desc: "Annonce d'une épreuve" },
      group:   { label: "Délégation",      desc: "Athlètes engagés" },
      recruit: { label: "Nouvel Athlète",  desc: "Arrivée dans l'équipe" },
      perf:    { label: "Chrono",          desc: "Temps, record personnel" },
    },
  },
};

// Ordre d'affichage dans le sélecteur.
export const SPORT_LIST = ["football", "rugby", "hockey", "basketball", "handball", "natation", "triathlon"]
  .map(id => SPORTS[id]);

export function getSport(id) {
  return SPORTS[id] || SPORTS[DEFAULT_SPORT];
}

export function termsFor(id) {
  return Object.assign({}, BASE_TERMS, getSport(id).terms || {});
}

/** Types de visuels proposés pour ce sport, libellés compris. */
export function ctypesFor(id) {
  const sp = getSport(id);
  return sp.types.map(t => ctypeInfo(id, t));
}

/**
 * Un type de visuel, libellé selon le sport. Fonctionne aussi pour un type qui
 * n'est pas dans la liste du sport courant : un visuel enregistré avant un
 * changement de sport reste affichable dans l'historique.
 */
export function ctypeInfo(id, typeId) {
  const base = CTYPE_BASE[typeId];
  if (!base) return { id: typeId, label: "Visuel", desc: "" };
  const ov = (getSport(id).typeLabels || {})[typeId] || {};
  // L'icône est surchargeable au même titre que le libellé : sans ça un essai
  // au rugby ou un panier au basket s'affichait avec un ballon de football.
  return { id: typeId, icon: ov.icon || base.icon, label: ov.label || base.label, desc: ov.desc || base.desc };
}

export function isTeamSport(id) {
  return getSport(id).kind === "team";
}
