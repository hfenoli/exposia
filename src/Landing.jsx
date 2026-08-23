import { useState, useEffect } from "react";

// ─── PALETTE (thème clair) ────────────────────────────────────
const C = {
  bg:    "#FAFAFA",  // fond principal
  bgAlt: "#F4F4F2",  // sections alternées
  card:  "#FFFFFF",  // cartes/contraste léger
  tx:    "#0A0A0A",  // texte principal
  tx2:   "#3A3A3A",  // texte secondaire
  tx3:   "#666666",  // texte tertiaire
  tx4:   "#999999",  // texte muet
  bd:    "rgba(10,10,10,0.10)",  // bordure légère
  bdLite:"rgba(10,10,10,0.06)",  // bordure très légère
  bk:    "#0A0A0A",  // noir profond (mocks + CTAs)
  wh:    "#FAFAFA",  // blanc cassé (text sur noir)
};
const FONT_BODY = "'DM Sans', system-ui, sans-serif";
const FONT_H    = "'Bebas Neue', Impact, sans-serif";
const FONT_M    = "'DM Mono', ui-monospace, monospace";

// ─── CONTENT ──────────────────────────────────────────────────
const STATS = [
  { n: "18", l: "Templates" },
  { n: "30s", l: "Par visuel" },
  { n: "3",   l: "Formats" },
];

// Baseline de marque — sert au footer, aux méta-données, aux e-mails.
const BASELINE = "Le studio visuel de votre club.";

// ─── TARIFS ───────────────────────────────────────────────────
// Les identifiants correspondent à la colonne `clubs.plan` en base
// (BASIC / STANDARD / PREMIUM) : ne les renommez pas sans migrer les données
// et l'écran Admin. Seuls les prix et les libellés sont libres.
//
// Les limites annoncées ici doivent rester alignées sur ce que l'app applique
// réellement (`max_visuals_per_week`, `max_templates` sur la table clubs).
// Ne promettez rien qui ne soit pas appliqué côté serveur.
const PRICING = [
  {
    id: "BASIC",
    nom: "Équipe",
    pour: "Une équipe, un bénévole aux commandes",
    prixMois: 15,
    prixAn: 144,          // soit 12.-/mois, −20 %
    inclus: [
      "8 visuels par semaine",
      "6 templates",
      "Story 9:16, Post 4:5, Carré 1:1",
      "Effectif et photos illimités",
      "Export PNG haute définition",
    ],
    absent: ["Tous les templates", "Accompagnement au démarrage"],
  },
  {
    id: "STANDARD",
    nom: "Club",
    pour: "Plusieurs catégories, une vraie présence en ligne",
    prixMois: 29,
    prixAn: 288,          // soit 24.-/mois, −20 %
    populaire: true,
    inclus: [
      "30 visuels par semaine",
      "Les 18 templates",
      "Story 9:16, Post 4:5, Carré 1:1",
      "Détourage automatique des photos",
      "Bandeaux et pastilles pour votre logo",
      "Support par e-mail sous 48 h",
    ],
    absent: ["Accompagnement au démarrage"],
  },
  {
    id: "PREMIUM",
    nom: "Institution",
    pour: "Grands clubs, académies, fédérations",
    prixMois: 59,
    prixAn: 588,          // soit 49.-/mois, −20 %
    inclus: [
      "Visuels illimités",
      "Les 18 templates",
      "Tous les formats",
      "Accompagnement au démarrage (1 h en visio)",
      "Support prioritaire sous 24 h",
      "Vos retours priorisés dans la feuille de route",
    ],
    absent: [],
  },
];

// ─── EXEMPLES DE VISUELS ──────────────────────────────────────
// Reproductions fidèles des gabarits de l'app, dessinées en CSS : aucune image
// à charger, et la couleur d'accent change d'une carte à l'autre pour montrer
// que les visuels prennent les couleurs du club.
const EXAMPLES = [
  { type: "goal",    label: "But",             accent: "#E63329" },
  { type: "result",  label: "Score final",     accent: "#1D7A46" },
  { type: "match",   label: "Affiche match",   accent: "#0F5FA6" },
  { type: "lineup",  label: "Composition XI",  accent: "#C9A227" },
  { type: "recruit", label: "Nouvelle recrue", accent: "#7B2D8E" },
  { type: "post",    label: "Annonce",         accent: "#D4541E" },
];
const TICKER = ["But", "Score final", "Affiche de match", "Composition XI", "Convocation", "Nouvelle recrue", "Annonce", "Football", "Basketball", "Hockey", "Rugby", "Handball", "Story 9:16", "Post 4:5", "Carré 1:1"];
const FEATURES = [
  { n: "01", t: "Templates Pro", d: "18 templates conçus pour le sport. Pas de compétences graphiques requises. Résultat professionnel garanti à chaque fois." },
  { n: "02", t: "30 Secondes",  d: "Depuis le bord du terrain. Ouvrez l'app, choisissez le type, exportez. Publié avant le coup de sifflet final." },
  { n: "03", t: "Vos Couleurs", d: "Logo, couleurs, joueurs — configurés une fois, appliqués automatiquement à chaque visuel créé pour votre club." },
];
const STEPS = [
  { n: "01", t: "Votre club, une fois pour toutes",
    d: "Logo, deux couleurs, effectif avec les photos. Dix minutes le premier soir, et c'est fini : tous vos visuels s'y conforment ensuite tout seuls." },
  { n: "02", t: "Le type de visuel",
    d: "But, score final, affiche de match, composition, groupe, recrue, annonce. Vous choisissez le format de publication — story, post ou carré — et le gabarit se met à la bonne taille." },
  { n: "03", t: "Ce qui se remplit tout seul",
    d: "Vous sélectionnez un joueur : son nom et son poste se posent sur le visuel. Le fond de sa photo peut être détouré en un geste. Vos couleurs sont déjà là." },
  { n: "04", t: "Vous ajustez, vous exportez",
    d: "Chaque élément se déplace et se redimensionne au doigt. Puis un PNG haute définition part directement dans vos photos. Prêt à publier." },
];
const TEAM = [
  { nom: "Hugo Fenoli-Rebellato", role: "Co-fondateur", photo: "/team/hugo.jpg" },
  { nom: "Lucas Di Pasquale",     role: "Co-fondateur", photo: "/team/lucas.jpg" },
];
const FAQ_ITEMS = [
  { q: "Pour quels sports ?",                       a: "Tous les sports collectifs : football, basketball, hockey, rugby et plus. L'éditeur s'adapte aux compositions et formats de votre discipline." },
  { q: "Faut-il des compétences en design ?",       a: "Non. Vous configurez votre club une fois (logo, couleurs, joueurs), l'app fait le reste. Aucune connaissance graphique requise." },
  { q: "Ça marche sur téléphone ?",                 a: "Oui, l'app est pensée mobile. Installez-la sur votre écran d'accueil pour un accès en un tap, comme une vraie application." },
  { q: "Combien ça coûte ?",                        a: "Trois offres selon la taille du club, de 15 à 59 CHF par mois, avec 20 % de remise au paiement annuel. Le détail est dans la section Tarifs. Pas de frais d'installation, résiliable à tout moment." },
  { q: "Comment accéder ?",                         a: "L'accès est sur invitation. Envoyez-nous un message à contact@viziona-sport.com, on revient sous 24h." },
  { q: "Comment configurer mon club ?",             a: "Allez dans « Mon Club », uploadez votre logo, choisissez vos deux couleurs. Tout se met à jour automatiquement dans vos visuels." },
  { q: "Comment créer mon premier visuel ?",        a: "Cliquez sur « Créer », choisissez un type (ex : But), sélectionnez un joueur si besoin, puis cliquez sur Télécharger." },
  { q: "Comment ajouter mes joueurs ?",             a: "Section « Joueurs » → bouton « + Ajouter ». Nom, numéro, poste. Vous pouvez aussi uploader leur photo." },
  { q: "Le visuel se télécharge où ?",              a: "Directement dans vos photos sur iPhone et Android. Prêt à publier sur Instagram, WhatsApp ou Facebook." },
  { q: "Que deviennent les photos de nos joueurs ?", a: "Elles restent celles de votre club : nous ne les revendons pas et ne les transmettons à personne. Attention en revanche à un point qui vous incombe : pour un joueur mineur, il vous faut l'accord écrit des parents avant de publier son image. C'est détaillé dans nos conditions d'utilisation." },
  { q: "Peut-on essayer avant de payer ?",          a: "Oui. Les clubs acceptés en bêta disposent d'un mois complet sans engagement ni carte bancaire. Si ça ne vous convient pas, vous partez avec vos visuels et on supprime vos données." },
  { q: "Puis-je gérer plusieurs équipes ?",         a: "Aujourd'hui un compte correspond à un effectif. Vous pouvez y réunir tous vos joueurs et créer des compositions différentes selon les matchs, mais les catégories ne sont pas encore séparées en équipes distinctes. C'est prévu, et les clubs abonnés sont prioritaires sur cette évolution." },
];

// ─── DOCUMENTS JURIDIQUES ─────────────────────────────────────
// ⚠️ Rédigés comme base de travail, pas par un juriste. Deux choses à faire
// avant la mise en ligne commerciale :
//   1. compléter IDENTITE ci-dessous (raison sociale, adresse, IDE, TVA) —
//      c'est une obligation légale pour un site marchand suisse ;
//   2. faire relire l'ensemble, en particulier les articles sur le droit à
//      l'image des mineurs et sur la responsabilité.
const IDENTITE = {
  raisonSociale: "Viziona Sport",      // ← à compléter : forme juridique exacte
  adresse:       "à compléter",        // ← adresse du siège
  ide:           "à compléter",        // ← n° IDE (CHE-...)
  email:         "contact@viziona-sport.com",
  forJuridique:  "Genève",             // ← à confirmer : doit correspondre au siège
};
const MAJ_LEGAL = "23 août 2026";

const CGU = [
  { t: "1. Objet et acceptation",
    p: "Viziona Sport édite une application permettant aux clubs sportifs de créer des visuels pour leurs réseaux sociaux à partir de leurs propres données. L'utilisation du service vaut acceptation des présentes conditions. L'accès est délivré sur demande, après validation manuelle de chaque club." },
  { t: "2. Compte et accès",
    p: "L'accès se fait par lien de connexion envoyé à l'adresse e-mail du club, sans mot de passe. Le club est responsable de la confidentialité de sa boîte e-mail : toute personne y ayant accès peut se connecter au service. Viziona Sport peut suspendre un accès en cas d'usage manifestement abusif, de non-paiement, ou de contenu illicite, après en avoir informé le club sauf urgence." },
  { t: "3. Photographies et droit à l'image",
    p: "C'est le point le plus important de ces conditions. Le club garantit disposer, pour chaque photographie qu'il importe, de l'autorisation des personnes représentées. Pour un joueur mineur, cette autorisation doit être écrite et donnée par les représentants légaux, et peut être retirée à tout moment. Viziona Sport ne vérifie pas ces autorisations et n'a aucun moyen de le faire : la responsabilité en incombe entièrement au club, y compris en cas de réclamation d'un tiers. En cas de retrait d'une autorisation, le club doit supprimer les photos concernées depuis l'application et cesser de diffuser les visuels qui en découlent." },
  { t: "4. Contenus du club",
    p: "Les données importées (nom, couleurs, logo, effectif, photographies, visuels créés) restent la propriété du club. Viziona Sport n'en acquiert aucun droit d'exploitation et ne les cède à aucun tiers. Le club s'engage à ne pas importer de contenu illicite, diffamatoire, ou portant atteinte aux droits d'autrui — notamment des photographies ou logos dont il ne détient pas les droits." },
  { t: "5. Visuels créés et filigrane",
    p: "Les visuels produits appartiennent au club, qui peut les publier et les diffuser librement, y compris à des fins de communication institutionnelle ou de partenariat. Ils comportent une mention « Powered by Viziona » discrète, qui fait partie intégrante du service et ne peut pas être retirée. Viziona Sport peut citer le nom d'un club client et montrer ses visuels à des fins de démonstration, uniquement avec son accord écrit préalable." },
  { t: "6. Disponibilité du service",
    p: "Le service est en phase de développement actif. Il est fourni en l'état, sans garantie de disponibilité ininterrompue : des interruptions pour maintenance, correction ou évolution peuvent survenir. Viziona Sport s'efforce de les limiter et de prévenir lorsque c'est possible. Il appartient au club de conserver une copie des visuels qui lui importent, en les téléchargeant." },
  { t: "7. Responsabilité",
    p: "Viziona Sport répond des dommages causés par sa faute intentionnelle ou sa négligence grave. Sa responsabilité pour tout autre dommage est limitée au montant payé par le club au cours des douze mois précédant le fait générateur. Viziona Sport n'est en particulier pas responsable de l'usage que le club fait des visuels créés, ni des conséquences d'une publication ne respectant pas le droit à l'image." },
  { t: "8. Modification des conditions",
    p: "Les présentes conditions peuvent être modifiées. Toute modification substantielle est notifiée par e-mail au moins trente jours avant son entrée en vigueur. Le club qui n'accepte pas les nouvelles conditions peut résilier son abonnement sans frais jusqu'à cette date." },
  { t: "9. Droit applicable",
    p: "Les présentes conditions sont soumises au droit suisse, à l'exclusion des règles de conflit de lois. Le for est à " + IDENTITE.forJuridique + ", sous réserve des dispositions impératives protégeant les consommateurs et des recours au Tribunal fédéral." },
];

const CGV = [
  { t: "1. Champ d'application",
    p: "Les présentes conditions régissent la vente des abonnements au service Viziona Sport aux clubs, associations et structures sportives agissant à titre professionnel ou associatif. Elles complètent les conditions générales d'utilisation." },
  { t: "2. Offres et prix",
    p: "Trois offres sont proposées — Équipe, Club et Institution — dont le contenu et les prix figurent dans la section Tarifs du présent site. Les prix sont indiqués en francs suisses, hors TVA. La TVA au taux légal est ajoutée sur la facture lorsqu'elle est due. Les limites d'usage annoncées (nombre de visuels par semaine, gabarits accessibles) sont appliquées techniquement par le service." },
  { t: "3. Souscription et période d'essai",
    p: "L'abonnement est souscrit après validation de la demande d'accès. Les clubs admis en phase bêta bénéficient d'un premier mois gratuit, sans carte bancaire et sans engagement. À l'issue de cette période, l'abonnement ne démarre que sur confirmation explicite du club : aucun prélèvement n'intervient sans accord." },
  { t: "4. Facturation et paiement",
    p: "L'abonnement mensuel est facturé chaque mois d'avance. L'abonnement annuel est facturé en une fois, au tarif indiqué, correspondant à dix mois payés pour douze. Les factures sont payables à trente jours. En cas de retard, Viziona Sport peut suspendre l'accès après une relance restée sans effet pendant quinze jours." },
  { t: "5. Durée, reconduction et résiliation",
    p: "L'abonnement mensuel est conclu pour un mois et se reconduit tacitement ; il peut être résilié à tout moment pour la fin de la période en cours, sans frais ni justification. L'abonnement annuel est conclu pour douze mois et se reconduit tacitement pour la même durée, sauf résiliation notifiée au moins trente jours avant l'échéance. La résiliation se fait par simple e-mail à " + IDENTITE.email + "." },
  { t: "6. Changement d'offre",
    p: "Le passage à une offre supérieure prend effet immédiatement, la différence étant facturée au prorata de la période restante. Le passage à une offre inférieure prend effet à l'échéance de la période en cours." },
  { t: "7. Remboursement",
    p: "Les sommes versées ne sont pas remboursées en cas de résiliation en cours de période, l'accès restant ouvert jusqu'à son terme. Font exception les cas d'indisponibilité prolongée imputable à Viziona Sport : au-delà de sept jours consécutifs, le club peut demander le remboursement au prorata." },
  { t: "8. Fin de l'abonnement",
    p: "À la fin de l'abonnement, l'accès à l'application est fermé. Les données du club sont conservées trente jours, période pendant laquelle il peut demander leur export ou leur suppression immédiate, puis supprimées définitivement. Les visuels déjà téléchargés restent la propriété du club et peuvent continuer à être utilisés." },
];

const CONFIDENTIALITE = [
  { t: "1. Responsable du traitement",
    p: IDENTITE.raisonSociale + ", " + IDENTITE.adresse + ". Pour toute question relative à vos données : " + IDENTITE.email + "." },
  { t: "2. Données traitées",
    p: "Nous traitons : l'adresse e-mail du club et le nom du club (nécessaires à la connexion et à la facturation) ; les données que le club saisit lui-même sur son effectif (noms, numéros, postes) ; les photographies et images qu'il importe ; les visuels qu'il crée. Nous ne collectons ni données de navigation à des fins publicitaires, ni cookies de suivi tiers." },
  { t: "3. Finalités et base légale",
    p: "Ces données servent exclusivement à fournir le service et à facturer l'abonnement. La base légale est l'exécution du contrat qui nous lie au club. Elles ne sont utilisées ni pour de la prospection, ni pour de la publicité, ni pour entraîner des modèles d'intelligence artificielle, et ne sont vendues à personne." },
  { t: "4. Photographies de personnes",
    p: "Les photographies importées peuvent représenter des personnes identifiables, y compris des mineurs. Nous n'y accédons pas pour d'autres fins que le fonctionnement du service, n'exécutons aucune reconnaissance faciale et n'en tirons aucun profil. Le recueil du consentement des personnes photographiées relève du club (voir l'article 3 des conditions d'utilisation)." },
  { t: "5. Hébergement et sous-traitants",
    p: "Les données sont hébergées chez Supabase, qui assure le stockage et l'authentification. Selon la région d'hébergement retenue, elles peuvent être traitées hors de Suisse, y compris dans un pays ne bénéficiant pas d'une décision d'adéquation ; les garanties contractuelles usuelles (clauses types de protection des données) s'appliquent alors. La région exacte est communiquée sur simple demande." },
  { t: "6. Durée de conservation",
    p: "Les données sont conservées pendant toute la durée de l'abonnement, puis trente jours après sa fin, avant suppression définitive. Les documents comptables sont conservés dix ans, comme l'impose le droit suisse. Une demande de suppression anticipée est exécutée sous trente jours." },
  { t: "7. Vos droits",
    p: "Conformément à la loi fédérale sur la protection des données et, lorsqu'il s'applique, au RGPD, vous pouvez demander l'accès à vos données, leur rectification, leur suppression, leur portabilité, ainsi que la limitation ou l'opposition à leur traitement. Écrivez à " + IDENTITE.email + " : nous répondons sous trente jours. Vous pouvez également saisir le Préposé fédéral à la protection des données et à la transparence." },
  { t: "8. Sécurité",
    p: "L'accès se fait par lien à usage unique, sans mot de passe à retenir. Les échanges sont chiffrés en transit. Les données de chaque club sont cloisonnées au niveau de la base de données, de sorte qu'un club n'accède qu'aux siennes. En cas de violation de données présentant un risque élevé, les clubs concernés et l'autorité compétente sont informés dans les meilleurs délais." },
];

// ─── FONTS + STYLES INJECTION ─────────────────────────────────
const STYLE_ID = "viziona-landing-css";
const FONTS_ID = "viziona-landing-fonts";

function injectFontsAndStyles() {
  if (typeof document === "undefined") return;
  if (!document.getElementById(FONTS_ID)) {
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre1);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "anonymous";
    document.head.appendChild(pre2);
    const l = document.createElement("link");
    l.id = FONTS_ID;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes viz-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes viz-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes viz-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .viz-up { opacity: 0; animation: viz-up .6s ease forwards; }
      .viz-fade { opacity: 0; animation: viz-fade .8s ease .3s forwards; }
      .viz-ticker-in { display: inline-flex; gap: 52px; animation: viz-tick 32s linear infinite; }
      .viz-vcard:hover { transform: translateY(-2px); transition: transform .25s; }
      .viz-fc:hover { background: ${C.bgAlt} !important; }
      .viz-fc:hover .viz-fc-arr { color: ${C.tx} !important; transform: translate(2px,-2px) !important; }
      .viz-btn-main:hover { transform: translateY(-2px); opacity: 0.92; }
      .viz-btn-text:hover { color: ${C.tx} !important; }
      .viz-btn-text:hover .viz-btn-arr { transform: translate(2px,-2px); }
      .viz-cta-b:hover { transform: translateY(-2px); }
      .viz-nav-link:hover { color: ${C.tx} !important; }
      .viz-faq-btn:hover { color: ${C.tx} !important; }
      .viz-grain {
        position: fixed; inset: 0; pointer-events: none; z-index: 999;
        opacity: 0.35; mix-blend-mode: multiply;
        will-change: transform; transform: translateZ(0);
        background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/></svg>");
      }
      /* Exemples : 6 colonnes en grand écran, puis 3, puis 2 */
      @media (max-width: 1200px) { .viz-ex-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      @media (max-width: 900px) {
        .viz-ex-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
        .viz-price-grid { grid-template-columns: 1fr !important; }
        .viz-hero { grid-template-columns: 1fr !important; }
        .viz-hero-left { padding: 100px 24px 60px !important; border-right: none !important; }
        .viz-hero-right { padding: 0 24px 60px !important; grid-template-columns: 1fr !important; }
        .viz-feat-grid { grid-template-columns: 1fr !important; }
        .viz-how { grid-template-columns: 1fr !important; }
        .viz-how-l { border-right: none !important; padding: 80px 24px !important; }
        .viz-how-r { padding: 40px 24px 80px !important; }
        .viz-cta-w { grid-template-columns: 1fr !important; padding: 56px 28px !important; margin: 0 24px 80px !important; }
        .viz-nav { padding: 0 16px !important; }
        .viz-nav-links { gap: 10px !important; }
        .viz-features { padding: 80px 24px !important; }
        .viz-footer { padding: 24px !important; flex-direction: column !important; gap: 20px !important; text-align: center !important; }
        .viz-section { padding: 72px 24px !important; }
        .viz-team-row { flex-direction: column !important; align-items: flex-start !important; }
        .viz-hero-h1 { font-size: clamp(64px, 14vw, 100px) !important; }
        .viz-hero-stats { gap: 28px !important; flex-wrap: wrap !important; }
        .viz-nav-hide { display: none !important; }
        .viz-about { grid-template-columns: 1fr !important; padding: 80px 24px !important; }
      }
      /* Sous 620 px les deux boutons de la nav ne tiennent plus à côté du logo :
         on ne garde que l'appel à l'action principal. */
      @media (max-width: 620px) {
        .viz-nav-login { display: none !important; }
        .viz-nav-cta { padding: 8px 14px !important; font-size: 10px !important; letter-spacing: 0.06em !important; }
        .viz-nav-brand { font-size: 16px !important; }
      }
    `;
    document.head.appendChild(s);
  }
}

// ─── LOGO ─────────────────────────────────────────────────────
function VLogo({ size = 26, color }) {
  const c = color || C.tx;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path d="M2 4L13 22L24 4" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M7.5 4L13 15L18.5 4" stroke={c} strokeWidth="1.5" strokeLinecap="square" opacity="0.32"/>
    </svg>
  );
}

// ─── PLAYER SILHOUETTE SVG ────────────────────────────────────
function PlayerSilhouette({ color = "#fff", opacity = 0.18 }) {
  return (
    <svg viewBox="0 0 80 110" style={{ width: "100%", height: "100%", opacity }} preserveAspectRatio="xMidYMax meet">
      <circle cx="40" cy="22" r="14" fill={color}/>
      <path d="M10 110 Q10 55 40 55 Q70 55 70 110 Z" fill={color}/>
    </svg>
  );
}

// ─── EXEMPLE DE VISUEL ────────────────────────────────────────
// Reproduction fidèle des gabarits de l'app, en 9:16 comme dans l'éditeur.
// Tout est dessiné en CSS : rien à télécharger, et l'accent change d'une carte
// à l'autre pour montrer que le visuel prend les couleurs du club.
function VisualCard({ type, accent }) {
  return (
    <div style={{ containerType: "inline-size", width: "100%" }}>
      <VisualCardBody type={type} accent={accent}/>
    </div>
  );
}
function VisualCardBody({ type, accent }) {
  const box = {
    position: "relative", aspectRatio: "9 / 16", width: "100%",
    background: "#0b0b12", overflow: "hidden", borderRadius: 3,
    display: "flex", flexDirection: "column", color: "#fff",
    // La section est noire : sans liseré, les cartes s'y fondaient.
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
    // Toutes les tailles internes sont exprimées en `em` : la base suit la
    // largeur du conteneur parent, donc le contenu s'adapte au nombre de
    // colonnes sans jamais déborder.
    fontSize: "8cqw",
  };
  const band = { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, zIndex: 3 };
  const badge = (txt) => (
    <div style={{ position: "absolute", top: 10, left: 10, width: 22, height: 22, borderRadius: 3, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_H, fontSize: 11, letterSpacing: "0.04em", zIndex: 3 }}>{txt}</div>
  );
  const mark = (
    <div aria-hidden="true" style={{ position: "absolute", bottom: 5, right: 6, fontFamily: FONT_M, fontSize: 6, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.42)", padding: "1px 5px", borderRadius: 2, letterSpacing: "0.04em", zIndex: 4 }}>Powered by Viziona</div>
  );

  if (type === "goal") return (
    <div style={box}>
      <div style={band}/>{badge("FC")}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#0d0d18,#1c0a0a)" }}/>
      <div aria-hidden="true" style={{ position: "absolute", top: "16%", left: "50%", transform: "translateX(-50%)", fontFamily: FONT_H, fontSize: "3.4em", color: accent, opacity: 0.14, letterSpacing: "0.04em" }}>BUT</div>
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: "46%", height: "50%" }}><PlayerSilhouette color="#fff" opacity={0.3}/></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "16%", textAlign: "center", zIndex: 2 }}>
        <div style={{ fontFamily: FONT_H, fontSize: "2.4em", lineHeight: 1, letterSpacing: "0.03em", textShadow: "0 0 24px rgba(0,0,0,.6)" }}>BUT !</div>
        <div style={{ fontFamily: FONT_M, fontSize: "0.62em", color: accent, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>M. Rodriguez · #9</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "6%", display: "flex", justifyContent: "center", gap: 10, alignItems: "center", fontFamily: FONT_H, fontSize: "1em", zIndex: 2 }}>
        <span>1</span><span style={{ opacity: 0.35, fontSize: "0.7em" }}>—</span><span>0</span>
      </div>
      {mark}
    </div>
  );

  if (type === "result") return (
    <div style={box}>
      <div style={band}/>{badge("FC")}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#0a1410,#080d0b)" }}/>
      <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 3, border: "1px solid rgba(255,255,255,.28)", zIndex: 3 }}/>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        <div style={{ fontFamily: FONT_M, fontSize: "0.6em", letterSpacing: "0.2em", color: "rgba(255,255,255,.45)", textTransform: "uppercase" }}>Score final</div>
        <div style={{ fontFamily: FONT_H, fontSize: "0.9em", letterSpacing: "0.16em", color: accent, marginTop: 10 }}>VICTOIRE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
          <span style={{ fontFamily: FONT_H, fontSize: "3em", lineHeight: 1 }}>3</span>
          <span style={{ opacity: 0.3, fontSize: "1.2em" }}>—</span>
          <span style={{ fontFamily: FONT_H, fontSize: "3em", lineHeight: 1 }}>1</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "80%", marginTop: 10, fontFamily: FONT_H, fontSize: "0.72em", letterSpacing: "0.06em", opacity: 0.8 }}>
          <span>MON CLUB</span><span>ADVERSAIRE</span>
        </div>
      </div>
      {mark}
    </div>
  );

  if (type === "match") return (
    <div style={box}>
      <div style={band}/>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(200deg,#0a0f1a,#0a0a10)" }}/>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2, padding: "0 8%" }}>
        <div style={{ fontFamily: FONT_M, fontSize: "0.55em", letterSpacing: "0.2em", color: "rgba(255,255,255,.4)", textTransform: "uppercase" }}>2e ligue · J12</div>
        <div style={{ fontFamily: FONT_H, fontSize: "1.45em", lineHeight: 1.05, marginTop: 14, textAlign: "center", overflowWrap: "anywhere" }}>MON CLUB</div>
        <div style={{ fontFamily: FONT_M, fontStyle: "italic", fontSize: "0.9em", color: "rgba(255,255,255,.35)", margin: "4px 0" }}>vs</div>
        <div style={{ fontFamily: FONT_H, fontSize: "1.45em", lineHeight: 1.05, textAlign: "center", color: accent, overflowWrap: "anywhere" }}>ADVERSAIRE</div>
        <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
          <div style={{ width: 26, height: 26, borderRadius: 3, background: accent }}/>
          <div style={{ width: 26, height: 26, borderRadius: 3, border: "1px solid rgba(255,255,255,.28)" }}/>
        </div>
        <div style={{ fontFamily: FONT_M, fontSize: "0.6em", color: "rgba(255,255,255,.6)", marginTop: 18, letterSpacing: "0.08em" }}>Samedi 12 avril · 17h00</div>
        <div style={{ fontFamily: FONT_M, fontSize: "0.55em", color: "rgba(255,255,255,.3)", marginTop: 3, letterSpacing: "0.08em" }}>Stade municipal</div>
      </div>
      {mark}
    </div>
  );

  if (type === "lineup") return (
    <div style={box}>
      <div style={band}/>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#07110b,#050a07)" }}/>
      <div aria-hidden="true" style={{ position: "absolute", inset: "14% 8% 16%", border: "1px solid rgba(255,255,255,.09)" }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.09)" }}/>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "34%", aspectRatio: "1", borderRadius: "50%", border: "1px solid rgba(255,255,255,.09)" }}/>
      </div>
      <div style={{ position: "absolute", top: "6%", left: 0, right: 0, textAlign: "center", fontFamily: FONT_H, fontSize: "0.95em", letterSpacing: "0.14em", zIndex: 2 }}>COMPOSITION</div>
      <div style={{ position: "absolute", inset: "16% 10% 18%", display: "flex", flexDirection: "column", justifyContent: "space-around", zIndex: 2 }}>
        {[[9],[7,10,11],[4,6,8],[2,5,3,16],[1]].map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: "7%" }}>
            {row.map(n => (
              <div key={n} style={{ width: "0.85em", height: "0.85em", borderRadius: "50%", background: "rgba(255,255,255,.1)", border: "1px solid " + accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_H, fontSize: "0.55em" }}>{n}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: "7%", left: 0, right: 0, textAlign: "center", fontFamily: FONT_M, fontSize: "0.55em", letterSpacing: "0.14em", color: accent, textTransform: "uppercase", zIndex: 2 }}>4-3-3 · vs Adversaire</div>
      {mark}
    </div>
  );

  if (type === "recruit") return (
    <div style={box}>
      <div style={band}/>{badge("FC")}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(165deg,#140a18,#0a0a12)" }}/>
      <div style={{ position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)", width: "58%", height: "56%" }}><PlayerSilhouette color="#fff" opacity={0.3}/></div>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: "linear-gradient(to top,rgba(0,0,0,.92),transparent)" }}/>
      <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "9%", zIndex: 2 }}>
        <div style={{ fontFamily: FONT_M, fontSize: "0.55em", letterSpacing: "0.24em", color: accent, textTransform: "uppercase", fontWeight: 500 }}>Nouvelle recrue</div>
        <div style={{ fontFamily: FONT_H, fontSize: "1.45em", lineHeight: 1.02, marginTop: 6, overflowWrap: "anywhere" }}>THOMAS<br/>MARCHAND</div>
        <div style={{ fontFamily: FONT_M, fontSize: "0.6em", color: "rgba(255,255,255,.6)", marginTop: 6, letterSpacing: "0.1em" }}>Milieu · #8</div>
      </div>
      {mark}
    </div>
  );

  return (
    <div style={box}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "#0a0a10" }}/>
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "34%", background: accent }}/>
      <div style={{ position: "absolute", top: "11%", left: "50%", transform: "translateX(-50%)", width: 26, height: 26, borderRadius: 4, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.35)", zIndex: 2 }}/>
      <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", zIndex: 2 }}>
        <div style={{ fontFamily: FONT_H, fontSize: "1.45em", lineHeight: 1.02, letterSpacing: "0.02em" }}>MATCH<br/>REPORTÉ</div>
        <div style={{ width: 28, height: 2, background: accent, margin: "12px 0" }}/>
        <div style={{ fontFamily: FONT_BODY, fontSize: "0.62em", lineHeight: 1.6, color: "rgba(255,255,255,.62)", fontWeight: 300 }}>
          Le match de dimanche est reporté au samedi 18 mai, 15h00. Merci de votre compréhension.
        </div>
        <div style={{ fontFamily: FONT_M, fontSize: "0.55em", color: accent, marginTop: 12, letterSpacing: "0.1em" }}>#MonClub</div>
      </div>
      {mark}
    </div>
  );
}

// ─── SECTION HEAD ─────────────────────────────────────────────
function SHead({ tag, h2_a, h2_b, counter }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 72, paddingBottom: 36, borderBottom: "1px solid " + C.bdLite, gap: 24, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>{tag}</div>
        <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
          {h2_a}<br/>
          <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>{h2_b}</em>
        </h2>
      </div>
      {counter && <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.1em" }}>{counter}</span>}
    </div>
  );
}

// ─── CTA LABEL ────────────────────────────────────────────────
const CTA_LABEL = "Accéder / Demander l'accès";

// ─── MAIN ─────────────────────────────────────────────────────
export default function Landing({ onEnter }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [billing, setBilling] = useState("mois");
  const [legalTab, setLegalTab] = useState("cgu");
  useEffect(() => { injectFontsAndStyles(); }, []);
  const handleEnter = (mode) => (e) => { if (e) e.preventDefault(); if (onEnter) onEnter(mode); };

  return (
    <div style={{ background: C.bg, color: C.tx, fontFamily: FONT_BODY, overflowX: "hidden", minHeight: "100dvh", position: "relative" }}>
      <div className="viz-grain" aria-hidden="true"/>

      {/* ─── NAV ─── */}
      <nav className="viz-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 60, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 52px", borderBottom: "1px solid " + C.bdLite, background: "rgba(250,250,250,0.85)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <a href="#" onClick={(e)=>e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <VLogo size={26}/>
          <span className="viz-nav-brand" style={{ fontFamily: FONT_H, fontSize: 19, letterSpacing: "0.16em", color: C.tx }}>Viziona</span>
        </a>
        <div className="viz-nav-links" style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <a href="#about"    className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>À propos</a>
          <a href="#examples" className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Exemples</a>
          <a href="#features" className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Fonctionnalités</a>
          <a href="#how"      className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Comment</a>
          <a href="#pricing"  className="viz-nav-link viz-nav-hide" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", transition: "color .2s" }}>Tarifs</a>
          <a href="#" onClick={handleEnter("login")} className="viz-btn-text viz-nav-login" style={{ padding: "9px 18px", border: "1px solid " + C.bk, color: C.bk, borderRadius: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", transition: "all .2s" }}>Se connecter</a>
          <a href="#" onClick={handleEnter("signup")} className="viz-btn-main viz-nav-cta" style={{ background: C.bk, color: C.wh, padding: "9px 22px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", transition: "transform .2s, opacity .2s" }}>Demander l'accès</a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="viz-hero" style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "55% 45%", paddingTop: 60, position: "relative" }}>
        <div className="viz-hero-left" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "80px 52px", borderRight: "1px solid " + C.bdLite, position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", bottom: 60, right: -40, fontFamily: FONT_H, fontSize: 320, lineHeight: 1, color: "rgba(10,10,10,0.045)", letterSpacing: "-0.02em", pointerEvents: "none", zIndex: 0, whiteSpace: "nowrap" }}>30s</span>
          <span className="viz-up" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.22em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 12, marginBottom: 28, position: "relative", zIndex: 1, animationDelay: ".1s" }}>
            <span style={{ width: 28, height: 1, background: C.tx3 }}/>
            Studio visuel · Tous les sports
          </span>
          <h1 className="viz-up viz-hero-h1" style={{ fontFamily: FONT_H, fontSize: "clamp(88px, 10.5vw, 148px)", lineHeight: 0.87, letterSpacing: "-0.01em", margin: 0, fontWeight: 400, position: "relative", zIndex: 1, animationDelay: ".25s", color: C.tx }}>
            Du terrain<br/>
            <span style={{ color: "transparent", WebkitTextStroke: "1.5px " + C.tx }}>au feed.</span><br/>
            En 30s.
          </h1>
          <p className="viz-up" style={{ marginTop: 36, fontSize: 14, color: C.tx2, lineHeight: 1.8, fontWeight: 300, maxWidth: 440, position: "relative", zIndex: 1, animationDelay: ".4s" }}>
            Le sifflet vient de retentir. Le temps de rejoindre le vestiaire, l'affiche du score est publiée — à vos couleurs, avec le bon joueur, au bon format. {BASELINE}
          </p>
          <div className="viz-up" style={{ marginTop: 52, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", position: "relative", zIndex: 1, animationDelay: ".55s" }}>
            <a href="#" onClick={handleEnter("login")} className="viz-btn-text" style={{ background: "transparent", color: C.bk, border: "1.5px solid " + C.bk, padding: "13px 28px", borderRadius: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "all .2s" }}>Se connecter</a>
            <a href="#" onClick={handleEnter("signup")} className="viz-btn-main" style={{ background: C.bk, color: C.wh, padding: "14px 32px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "transform .2s, opacity .2s" }}>Demander l'accès</a>
            <a href="#how" className="viz-btn-text" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", display: "flex", alignItems: "center", gap: 7, transition: "color .2s" }}>
              Voir comment <span className="viz-btn-arr" style={{ transition: "transform .2s" }}>↗</span>
            </a>
          </div>
          <div className="viz-up viz-hero-stats" style={{ marginTop: 80, paddingTop: 36, borderTop: "1px solid " + C.bdLite, display: "flex", gap: 48, position: "relative", zIndex: 1, animationDelay: ".7s" }}>
            {STATS.map(s => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontFamily: FONT_H, fontSize: 44, letterSpacing: "0.04em", lineHeight: 1, color: C.tx }}>{s.n}</div>
                <div style={{ fontFamily: FONT_M, fontSize: 9, color: C.tx3, letterSpacing: "0.16em", textTransform: "uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HERO RIGHT — 4 mocks enrichis sur fond noir */}
        <div className="viz-fade viz-hero-right" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto auto", gap: 1, background: C.bk }}>
          {/* But */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>But · Célébration</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(155deg, #08080f, #160808)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", position: "relative", overflow: "hidden", padding: 10 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#E63329,#FF7035)" }}/>
              <div aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 110, color: "rgba(230,51,41,0.07)", letterSpacing: "0.04em", top: "15%" }}>BUT</div>
              {/* Silhouette joueur avec numéro */}
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 68, height: 92 }}>
                <PlayerSilhouette color="#fff" opacity={0.22}/>
                <div style={{ position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", fontFamily: FONT_H, fontSize: 28, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em", textShadow: "0 0 14px rgba(0,0,0,.5)" }}>9</div>
              </div>
              <div style={{ fontFamily: FONT_H, fontSize: 44, color: "#fff", letterSpacing: "0.04em", position: "relative", zIndex: 1, textShadow: "0 0 50px rgba(230,51,41,0.5)", lineHeight: 1 }}>BUT !</div>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(230,80,40,0.78)", letterSpacing: "0.14em", textTransform: "uppercase", position: "relative", zIndex: 1, marginTop: 4 }}>M. Rodriguez · #9</div>
            </div>
          </div>
          {/* Score */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Score · Final</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "#0b0b0b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 10 }}>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(250,250,250,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 2 }}>SCORE FINAL</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: FONT_H, fontSize: 56, color: "#fff", lineHeight: 1 }}>2</span>
                <span style={{ fontSize: 20, color: "rgba(250,250,250,0.3)" }}>—</span>
                <span style={{ fontFamily: FONT_H, fontSize: 56, color: "#fff", lineHeight: 1 }}>1</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 8 }}>
                <span style={{ fontFamily: FONT_H, fontSize: 12, color: "rgba(250,250,250,0.82)", letterSpacing: "0.06em" }}>FC BAVOIS</span>
                <span style={{ fontFamily: FONT_H, fontSize: 12, color: "rgba(250,250,250,0.82)", letterSpacing: "0.06em" }}>CS RENENS</span>
              </div>
            </div>
          </div>
          {/* Composition */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Composition · XI</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(to bottom, #04040e, #080814)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: 10, position: "relative", overflow: "hidden" }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='160'%3E%3Crect x='4' y='4' width='92' height='152' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3Cline x1='4' y1='80' x2='96' y2='80' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3Cellipse cx='50' cy='80' rx='20' ry='20' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3C/svg%3E\")", backgroundSize: "100% 100%" }}/>
              {[[7,9,11],[2,5,6,8],[3,4,16,14],[1]].map((nums, ri) => (
                <div key={ri} style={{ display: "flex", gap: 6, justifyContent: "center", position: "relative", zIndex: 1 }}>
                  {nums.map((n, i) => (
                    <div key={i} style={{ width: 17, height: 17, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.32)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_H, fontSize: 9, color: "#fff", letterSpacing: "0.02em" }}>{n}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Annonce */}
          <div className="viz-vcard" style={{ background: C.bk, padding: "24px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>Annonce · Post</div>
            <div style={{ flex: 1, minHeight: 160, borderRadius: 2, background: "linear-gradient(135deg, #090909, #11161a)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#00C896,#00A8FF)" }}/>
              <div aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 90, color: "rgba(0,200,150,0.05)", letterSpacing: "0.04em", top: "20%", right: -8 }}>VS</div>
              <div style={{ fontFamily: FONT_H, fontSize: 22, color: "#fff", lineHeight: 1, letterSpacing: "0.02em", position: "relative", zIndex: 1 }}>DERBY<br/>DIMANCHE</div>
              <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(0,200,150,0.78)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4, position: "relative", zIndex: 1 }}>15:00 · Stade Municipal</div>
            </div>
          </div>
          {/* Wide tags */}
          <div style={{ gridColumn: "1 / -1", background: "#0d0d0d", padding: "18px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Types de visuels</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["But","Score","Composition","Groupe","Recrue","Affiche","Annonce"].map(t => (
                <span key={t} style={{ background: "#161616", color: "rgba(250,250,250,0.6)", padding: "4px 11px", borderRadius: 1, fontFamily: FONT_M, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── TICKER ─── */}
      <div style={{ background: C.bgAlt, padding: "12px 0", overflow: "hidden", whiteSpace: "nowrap", borderTop: "1px solid " + C.bdLite, borderBottom: "1px solid " + C.bdLite }}>
        <div className="viz-ticker-in">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.18em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 14 }}>
              {t} <span style={{ color: C.tx4, fontSize: 7 }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── À PROPOS ─── */}
      <section id="about" className="viz-about" style={{ background: C.bg, padding: "140px 52px", maxWidth: 1340, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>À propos</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 64px)", letterSpacing: "0.005em", lineHeight: 1, fontWeight: 400, margin: 0, color: C.tx }}>
            Chaque club mérite<br/>d'exister sur<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>les réseaux.</em>
          </h2>
        </div>
        <div style={{ paddingTop: 40 }}>
          <p style={{ fontSize: 15, color: C.tx2, lineHeight: 1.8, fontWeight: 300, margin: 0, marginBottom: 22 }}>
            Des milliers de clubs amateurs s'entraînent, gagnent des matchs, font progresser des joueurs — et personne ne le voit. Pas parce qu'il ne se passe rien, mais parce qu'ils n'ont ni le temps ni les outils pour le raconter.
          </p>
          <p style={{ fontSize: 15, color: C.tx2, lineHeight: 1.8, fontWeight: 300, margin: 0, marginBottom: 22 }}>
            Viziona est né de ce constat. Une app pensée pour le dirigeant bénévole qui gère tout seul, le coach qui n'a pas d'agence de comm, le club qui mérite autant d'exister en ligne qu'en compétition.
          </p>
          <p style={{ fontSize: 15, color: C.tx, lineHeight: 1.8, fontWeight: 500, margin: 0, borderLeft: "2px solid " + C.tx, paddingLeft: 16 }}>
            En 30 secondes, depuis le bord du terrain, votre club peut publier comme un pro.
          </p>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="viz-features" style={{ background: C.bgAlt, padding: "120px 52px", borderTop: "1px solid " + C.bdLite }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <SHead tag="Pourquoi Viziona" h2_a="Ce que vous" h2_b="obtenez" counter="03 fonctionnalités"/>
          <div className="viz-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.bd }}>
            {FEATURES.map(f => (
              <div key={f.n} className="viz-fc" style={{ background: C.bg, padding: "42px 38px", position: "relative", transition: "background .25s" }}>
                <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx4, letterSpacing: "0.14em", marginBottom: 32 }}>{f.n}</div>
                <div style={{ marginBottom: 22, opacity: 0.7 }}>
                  {f.n === "01" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="3" y="3" width="26" height="26" rx="1" stroke={C.tx} strokeWidth="1.5"/><path d="M3 13h26M13 3v26" stroke={C.tx} strokeWidth="1.5"/></svg>)}
                  {f.n === "02" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke={C.tx} strokeWidth="1.5"/><path d="M16 7v9l5.5 3.5" stroke={C.tx} strokeWidth="1.5" strokeLinecap="square"/></svg>)}
                  {f.n === "03" && (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 3L3 11v8l13 10 13-10v-8L16 3z" stroke={C.tx} strokeWidth="1.5"/><path d="M3 11l13 8 13-8M16 3v18" stroke={C.tx} strokeWidth="1.5"/></svg>)}
                </div>
                <div style={{ fontFamily: FONT_H, fontSize: 30, letterSpacing: "0.04em", marginBottom: 12, color: C.tx }}>{f.t}</div>
                <p style={{ fontSize: 13, color: C.tx3, lineHeight: 1.8, fontWeight: 300, margin: 0 }}>{f.d}</p>
                <span className="viz-fc-arr" style={{ position: "absolute", bottom: 32, right: 32, color: C.tx4, fontSize: 18, transition: "color .2s, transform .2s" }}>↗</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EXEMPLES ─── */}
      <section id="examples" className="viz-features" style={{ background: C.bk, padding: "120px 52px", borderTop: "1px solid " + C.bdLite }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 64, paddingBottom: 36, borderBottom: "1px solid rgba(250,250,250,0.12)", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: FONT_M, fontSize: 10, color: "rgba(250,250,250,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Exemples</div>
              <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.wh }}>
                Ce que vous<br/>
                <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.wh }}>publiez.</em>
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "rgba(250,250,250,0.55)", lineHeight: 1.8, fontWeight: 300, maxWidth: 320, margin: 0 }}>
              Sept types de visuels, dix-huit gabarits. Chacun reprend le logo et les deux couleurs de votre club — c'est ce qui change d'une carte à l'autre ci-dessous.
            </p>
          </div>
          <div className="viz-ex-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
            {EXAMPLES.map(ex => (
              <div key={ex.type}>
                <VisualCard type={ex.type} accent={ex.accent}/>
                <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.5)", letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 12 }}>{ex.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(250,250,250,0.12)", display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.45)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Un visuel, trois formats</span>
            {[["Story", "9 : 16", "Instagram, TikTok"], ["Post", "4 : 5", "Fil Instagram"], ["Carré", "1 : 1", "Facebook, X"]].map(([n, r, u]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ display: "block", width: n === "Story" ? 14 : n === "Post" ? 18 : 21, height: n === "Story" ? 25 : n === "Post" ? 22 : 21, border: "1.5px solid rgba(250,250,250,0.4)", borderRadius: 2, flexShrink: 0 }}/>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: 17, letterSpacing: "0.06em", color: C.wh, lineHeight: 1 }}>{n} <span style={{ fontSize: 12, opacity: 0.5 }}>{r}</span></div>
                  <div style={{ fontFamily: FONT_M, fontSize: 9, color: "rgba(250,250,250,0.4)", letterSpacing: "0.08em", marginTop: 3 }}>{u}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="viz-how" style={{ background: C.bg, borderTop: "1px solid " + C.bdLite, display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 1340, margin: "0 auto" }}>
        <div className="viz-how-l" style={{ padding: "120px 52px", borderRight: "1px solid " + C.bdLite }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Comment ça marche</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
            Simple.<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>Vraiment.</em>
          </h2>
          <div style={{ marginTop: 56 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 20, padding: "28px 0", borderBottom: "1px solid " + C.bdLite, borderTop: i === 0 ? "1px solid " + C.bdLite : "none" }}>
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx4, letterSpacing: "0.1em", paddingTop: 4 }}>{s.n}</span>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: 22, letterSpacing: "0.06em", marginBottom: 6, color: C.tx }}>{s.t}</div>
                  <p style={{ fontSize: 13, color: C.tx3, lineHeight: 1.65, fontWeight: 300, margin: 0 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="viz-how-r" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, background: C.bgAlt }}>
          <div style={{ width: 224, height: 448, background: "#1a1a1a", borderRadius: 30, border: "1px solid " + C.bd, overflow: "hidden", position: "relative", boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 10px 20px rgba(0,0,0,0.1)" }}>
            <div style={{ position: "absolute", inset: 10, background: C.bk, borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(250,250,250,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: FONT_H, fontSize: 13, letterSpacing: "0.12em", color: C.wh }}>VIZIONA</span>
                <span style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(250,250,250,0.45)", letterSpacing: "0.1em" }}>FC BAVOIS</span>
              </div>
              <div style={{ flex: 1, background: "linear-gradient(155deg, #060610, #110606)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#E63329,#FF8035)" }}/>
                <div style={{ width: 60, height: 80, marginBottom: 6 }}><PlayerSilhouette color="#fff" opacity={0.22}/></div>
                <div style={{ fontFamily: FONT_H, fontSize: 50, color: "#fff", letterSpacing: "0.04em", textShadow: "0 0 60px rgba(230,51,41,0.35)", zIndex: 1, lineHeight: 1 }}>BUT !</div>
                <div style={{ fontFamily: FONT_M, fontSize: 8, color: "rgba(230,80,40,0.85)", letterSpacing: "0.12em", textTransform: "uppercase", zIndex: 1, marginTop: 4 }}>M. Rodriguez · #9</div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                <div style={{ flex: 1, background: C.wh, color: C.bk, borderRadius: 2, padding: "10px 4px", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textAlign: "center", textTransform: "uppercase" }}>Télécharger</div>
                <div style={{ flex: 1, background: "rgba(250,250,250,0.07)", color: "rgba(250,250,250,0.45)", borderRadius: 2, padding: "10px 4px", fontSize: 8, fontWeight: 600, letterSpacing: "0.08em", textAlign: "center", textTransform: "uppercase" }}>Sauver</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bgAlt }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56, paddingBottom: 36, borderBottom: "1px solid " + C.bdLite, gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Tarifs</div>
              <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(48px, 5.5vw, 76px)", letterSpacing: "0.02em", lineHeight: 0.9, fontWeight: 400, margin: 0, color: C.tx }}>
                Le prix de<br/>
                <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>votre taille.</em>
              </h2>
            </div>
            {/* Bascule mensuel / annuel */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", border: "1px solid " + C.bd, borderRadius: 1, overflow: "hidden" }}>
                {[["mois", "Mensuel"], ["an", "Annuel"]].map(([v, lbl]) => (
                  <button key={v} onClick={() => setBilling(v)}
                    style={{ background: billing === v ? C.bk : "transparent", color: billing === v ? C.wh : C.tx3, border: "none", padding: "10px 20px", fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all .2s" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.08em" }}>−20 % à l’année</span>
            </div>
          </div>

          <div className="viz-price-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.bd, border: "1px solid " + C.bd }}>
            {PRICING.map(pl => {
              const mis = pl.populaire;
              const prix = billing === "an" ? Math.round(pl.prixAn / 12) : pl.prixMois;
              return (
                <div key={pl.id} style={{ background: mis ? C.bk : C.bg, color: mis ? C.wh : C.tx, padding: "40px 34px", display: "flex", flexDirection: "column", position: "relative" }}>
                  {mis && (
                    <span style={{ position: "absolute", top: 16, right: 16, fontFamily: FONT_M, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", background: "rgba(250,250,250,0.14)", color: C.wh, padding: "4px 9px", borderRadius: 1 }}>Le plus choisi</span>
                  )}
                  <div style={{ fontFamily: FONT_H, fontSize: 34, letterSpacing: "0.05em", lineHeight: 1 }}>{pl.nom}</div>
                  <p style={{ fontSize: 12, lineHeight: 1.65, fontWeight: 300, color: mis ? "rgba(250,250,250,0.6)" : C.tx3, margin: "10px 0 28px", minHeight: 40 }}>{pl.pour}</p>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span style={{ fontFamily: FONT_M, fontSize: 13, color: mis ? "rgba(250,250,250,0.5)" : C.tx4 }}>CHF</span>
                    <span style={{ fontFamily: FONT_H, fontSize: 62, letterSpacing: "0.02em", lineHeight: 1 }}>{prix}</span>
                    <span style={{ fontFamily: FONT_M, fontSize: 11, color: mis ? "rgba(250,250,250,0.5)" : C.tx4, letterSpacing: "0.06em" }}>/ mois</span>
                  </div>
                  <div style={{ fontFamily: FONT_M, fontSize: 10, color: mis ? "rgba(250,250,250,0.42)" : C.tx4, letterSpacing: "0.05em", marginTop: 7, minHeight: 15 }}>
                    {billing === "an" ? "soit " + pl.prixAn + " CHF facturés une fois par an" : "sans engagement, résiliable chaque mois"}
                  </div>

                  <div style={{ height: 1, background: mis ? "rgba(250,250,250,0.14)" : C.bd, margin: "28px 0 22px" }}/>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 11, flex: 1 }}>
                    {pl.inclus.map(f => (
                      <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.5, fontWeight: 300, color: mis ? "rgba(250,250,250,0.85)" : C.tx2 }}>
                        <span style={{ color: mis ? C.wh : C.tx, flexShrink: 0, fontSize: 11, lineHeight: 1.7 }}>—</span>{f}
                      </li>
                    ))}
                    {pl.absent.map(f => (
                      <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.5, fontWeight: 300, color: mis ? "rgba(250,250,250,0.3)" : C.tx4, textDecoration: "line-through", textDecorationThickness: "1px" }}>
                        <span style={{ flexShrink: 0, fontSize: 11, lineHeight: 1.7, textDecoration: "none" }}>·</span>{f}
                      </li>
                    ))}
                  </ul>

                  <a href="#" onClick={handleEnter("signup")}
                    style={{ marginTop: 32, display: "block", textAlign: "center", background: mis ? C.wh : "transparent", color: mis ? C.bk : C.bk, border: mis ? "1.5px solid " + C.wh : "1.5px solid " + C.bk, padding: "13px 20px", borderRadius: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "opacity .2s" }}
                    className="viz-btn-main">
                    Demander l'accès
                  </a>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, fontSize: 12, color: C.tx3, fontWeight: 300, lineHeight: 1.6 }}>
              <li>— Premier mois offert pour les clubs de la bêta, sans carte bancaire.</li>
              <li>— Résiliable à tout moment. Vous gardez les visuels déjà créés.</li>
              <li>— Prix hors TVA. Association ou club sans but lucratif : écrivez-nous, on s'arrange.</li>
            </ul>
            <a href="mailto:contact@viziona-sport.com" className="viz-btn-text" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tx3, textDecoration: "none", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              Un besoin particulier ? Parlons-en <span className="viz-btn-arr" style={{ transition: "transform .2s" }}>↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── TEAM ─── */}
      <section className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bg }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Équipe</div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 60px)", letterSpacing: "0.02em", lineHeight: 1, fontWeight: 400, margin: 0, color: C.tx, maxWidth: 880 }}>
            Deux fondateurs, une obsession :<br/>
            <em style={{ fontStyle: "normal", color: "transparent", WebkitTextStroke: "1px " + C.tx }}>donner à chaque club les outils des pros.</em>
          </h2>
          <div className="viz-team-row" style={{ marginTop: 56, display: "flex", gap: 48, flexWrap: "wrap" }}>
            {TEAM.map(p => (
              <div key={p.nom} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <img src={p.photo} alt={p.nom} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid " + C.bd }}/>
                <div>
                  <div style={{ fontFamily: FONT_H, fontSize: 22, letterSpacing: "0.04em", color: C.tx }}>{p.nom}</div>
                  <div style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>{p.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="viz-section" style={{ padding: "120px 52px", borderTop: "1px solid " + C.bdLite, background: C.bgAlt }}>
        <div style={{ maxWidth: 1340, margin: "0 auto" }}>
          <SHead tag="FAQ" h2_a="Questions" h2_b="fréquentes." counter={FAQ_ITEMS.length + " questions"}/>
          <div style={{ maxWidth: 820 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ borderBottom: "1px solid " + C.bdLite }}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="viz-faq-btn" style={{ width: "100%", background: "none", border: "none", padding: "22px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY, color: C.tx2, transition: "color .2s" }}>
                    <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em", flex: 1 }}>{item.q}</span>
                    <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 300, color: C.tx3, lineHeight: 1, flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "rotate(0)", transition: "transform .18s ease" }}>+</span>
                  </button>
                  <div style={{ maxHeight: isOpen ? 400 : 0, overflow: "hidden", transition: "max-height .25s ease" }}>
                    <p style={{ fontSize: 14, color: C.tx3, lineHeight: 1.75, margin: 0, paddingBottom: 22, paddingRight: 40, fontWeight: 300 }}>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA WIDE NOIR ─── */}
      <div className="viz-cta-w" style={{ margin: "0 52px 120px", background: C.bk, padding: "72px 80px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 60, position: "relative", overflow: "hidden", marginTop: 0 }}>
        <span aria-hidden="true" style={{ position: "absolute", fontFamily: FONT_H, fontSize: 200, color: "rgba(250,250,250,0.045)", right: -10, top: "50%", transform: "translateY(-50%)", letterSpacing: "0.04em", pointerEvents: "none", whiteSpace: "nowrap" }}>VIZIONA</span>
        <div>
          <h2 style={{ fontFamily: FONT_H, fontSize: "clamp(40px, 4.5vw, 60px)", color: C.wh, letterSpacing: "0.02em", lineHeight: 0.92, margin: 0, fontWeight: 400 }}>Prêt à élever<br/>votre club ?</h2>
          <p style={{ fontSize: 13, color: "rgba(250,250,250,0.55)", marginTop: 14, fontWeight: 300, lineHeight: 1.65 }}>Accès sur demande · Réponse sous 24h · Premiers clubs en bêta</p>
        </div>
        <a href="#" onClick={handleEnter("signup")} className="viz-cta-b" style={{ background: C.wh, color: C.bk, padding: "15px 38px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 1, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block", transition: "transform .2s", position: "relative", zIndex: 1 }}>
          Demander l'accès
        </a>
      </div>

      {/* ─── LÉGAL : CGU / CGV / CONFIDENTIALITÉ ─── */}
      <section id="cgu" style={{ width: "100%", background: C.bgAlt, borderTop: "1px solid " + C.bdLite, padding: "72px 0", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 900, padding: "0 52px", boxSizing: "border-box" }}>
          <p style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.tx3, marginBottom: 8, fontWeight: 500 }}>
            Informations légales
          </p>
          <p style={{ fontFamily: FONT_M, fontSize: 11, color: C.tx4, marginBottom: 24, letterSpacing: "0.02em" }}>
            En vigueur au {MAJ_LEGAL}
          </p>

          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.bd, marginBottom: 30, flexWrap: "wrap" }}>
            {[["cgu", "Utilisation"], ["cgv", "Vente"], ["privacy", "Confidentialité"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setLegalTab(k)}
                style={{ background: "none", border: "none", borderBottom: "2px solid " + (legalTab === k ? C.tx : "transparent"), padding: "10px 20px 12px", marginBottom: -1, fontFamily: FONT_BODY, fontSize: 12, fontWeight: legalTab === k ? 600 : 400, letterSpacing: "0.08em", textTransform: "uppercase", color: legalTab === k ? C.tx : C.tx3, cursor: "pointer", transition: "color .2s" }}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.75, display: "grid", gap: 18 }}>
            {(legalTab === "cgu" ? CGU : legalTab === "cgv" ? CGV : CONFIDENTIALITE).map(a => (
              <div key={a.t}>
                <div style={{ fontFamily: FONT_H, fontWeight: 400, fontSize: 18, letterSpacing: "0.04em", color: C.tx, marginBottom: 6 }}>{a.t}</div>
                <p style={{ margin: 0, fontWeight: 300 }}>{a.p}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 34, paddingTop: 20, borderTop: "1px solid " + C.bd, fontFamily: FONT_M, fontSize: 10, color: C.tx4, lineHeight: 1.8, letterSpacing: "0.02em" }}>
            <div>{IDENTITE.raisonSociale} · {IDENTITE.adresse} · IDE {IDENTITE.ide}</div>
            <div><a href={"mailto:" + IDENTITE.email} style={{ color: C.tx3, textDecoration: "underline" }}>{IDENTITE.email}</a></div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="viz-footer" style={{ padding: "36px 52px", borderTop: "1px solid " + C.bdLite, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <VLogo size={20}/>
          <span style={{ fontFamily: FONT_H, fontSize: 17, letterSpacing: "0.14em", color: C.tx }}>Viziona</span>
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, letterSpacing: "0.08em" }}>{BASELINE} · © 2026 Viziona Sport · Suisse</span>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <a href="mailto:contact@viziona-sport.com" className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>contact@viziona-sport.com</a>
          <a href="#cgu" onClick={() => setLegalTab("cgu")} className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>CGU</a>
          <a href="#cgu" onClick={() => setLegalTab("cgv")} className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>CGV</a>
          <a href="#cgu" onClick={() => setLegalTab("privacy")} className="viz-nav-link" style={{ fontFamily: FONT_M, fontSize: 10, color: C.tx3, textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase", transition: "color .2s" }}>Confidentialité</a>
        </div>
      </footer>
    </div>
  );
}
