// Example content for the landing pages. Companies and people are fictional.

export const HERO_MISSIONS = [
  { score: 94, title: "Refonte d’identité visuelle", meta: "Mistral Vélos · Annecy · 400–500 €/j", discipline: "Design", source: "Offre CDI", dm: "Manon Blanc, directrice artistique" },
  { score: 91, title: "Motion designer · 6 semaines", meta: "Arbor Immobilier · Paris · 450–550 €/j", discipline: "Vidéo", source: "Offre CDI", dm: "Romain Morel, Head of Content" },
  { score: 87, title: "Série de 10 vidéos pour les réseaux", meta: "Pollen & Co · Paris · 3 500 €", discipline: "Vidéo", source: "Publiée sur Freeleads", dm: "Claire Dumas, responsable marketing" },
  { score: 82, title: "Captation d’un salon de 3 jours", meta: "Lanterne Média · Lyon · 2 400 €", discipline: "Vidéo", source: "Offre CDI", dm: "Paul Lefèvre, directeur de production" },
];

const CDI = "Offre CDI";
const DIRECT = "Publiée sur Freeleads";

export const JOBS = [
  { id: "video", label: "Vidéo", missions: [
    { title: "Motion designer · 6 semaines", where: "Arbor Immobilier · Paris", source: CDI, price: "450–550 €/j" },
    { title: "Captation d’un salon de 3 jours", where: "Lanterne Média · Lyon", source: CDI, price: "2 400 €" },
    { title: "Série de 10 vidéos pour les réseaux", where: "Pollen & Co · Paris", source: DIRECT, price: "3 500 €" },
  ] },
  { id: "design", label: "Design", missions: [
    { title: "Refonte d’identité visuelle", where: "Mistral Vélos · Annecy", source: CDI, price: "400–500 €/j" },
    { title: "Packaging d’une nouvelle gamme", where: "Maison Ardent · Bordeaux", source: CDI, price: "4 800 €" },
    { title: "Maquettes d’une application mobile", where: "Kipli Santé · Lille", source: DIRECT, price: "450 €/j" },
  ] },
  { id: "web", label: "Développement web", missions: [
    { title: "Développeur React · 3 mois", where: "Nexalune · Paris", source: CDI, price: "500–600 €/j" },
    { title: "Migration vers Shopify", where: "Corbeau Audio · Lyon", source: DIRECT, price: "6 500 €" },
    { title: "Intégration d’une API de paiement", where: "Tessera · Nantes", source: CDI, price: "550 €/j" },
  ] },
  { id: "marketing", label: "Marketing", missions: [
    { title: "Audit SEO de 1 200 pages", where: "Orbelle · Bordeaux", source: CDI, price: "5 200 €" },
    { title: "Campagnes d’acquisition pour un lancement", where: "Brindille · Lille", source: CDI, price: "450 €/j" },
    { title: "Refonte des scénarios e-mail", where: "Velours Maison · Nantes", source: DIRECT, price: "3 800 €" },
  ] },
  { id: "copywriting", label: "Rédaction", missions: [
    { title: "20 articles SEO en 2 mois", where: "Lumora Santé · Paris", source: CDI, price: "3 000 €" },
    { title: "Documentation d’API avant lancement", where: "Solvane · Toulouse", source: CDI, price: "400 €/j" },
    { title: "Textes du nouveau site (12 pages)", where: "Atelier Brume · Paris", source: DIRECT, price: "2 200 €" },
  ] },
  { id: "photography", label: "Photographie", missions: [
    { title: "Shooting de la nouvelle collection", where: "Sérac Outdoor · Annecy", source: CDI, price: "1 800 €" },
    { title: "Portraits d’équipe et photos des bureaux", where: "Rivemont Conseil · Paris", source: DIRECT, price: "1 200 €" },
    { title: "Packshots de 150 produits", where: "Aubépine Cosmétiques · Paris", source: CDI, price: "2 600 €" },
  ] },
  { id: "communications", label: "Communication", missions: [
    { title: "Relations presse pour une levée de fonds", where: "Gravelle Mobilité · Lyon", source: CDI, price: "6 000 €" },
    { title: "Communication d’un salon annuel", where: "Hélia Voyages · Nice", source: CDI, price: "450 €/j" },
    { title: "Charte éditoriale de marque", where: "Ondine · Toulouse", source: DIRECT, price: "2 800 €" },
  ] },
  { id: "sales", label: "Développement commercial", missions: [
    { title: "SDR pour l’ouverture du marché UK", where: "Cobaltine · Lyon", source: CDI, price: "400 €/j" },
    { title: "Mise en place de la prospection sortante", where: "Quartzite Robotique · Grenoble", source: CDI, price: "7 500 €" },
    { title: "Playbook commercial et formation", where: "Vertiflow · Nantes", source: DIRECT, price: "4 200 €" },
  ] },
];

// Score criteria (weights sum to 100 %). "measure" and "data" are shared; "tip" depends on the profile.
export const CRITERIA = [
  {
    id: "skills",
    label: "Compétences",
    weight: 40,
    measure: "Le recoupement entre les compétences demandées dans la mission et celles que le profil prouve.",
    data: "Le portfolio analysé, les missions réalisées, les certifications et des mini-tests facultatifs de 15 minutes.",
  },
  {
    id: "experience",
    label: "Expérience",
    weight: 25,
    measure: "Les années de pratique et les missions comparables déjà réalisées, dans le même secteur ou à la même échelle.",
    data: "L’historique de missions, les expériences passées et les avis laissés par les clients.",
  },
  {
    id: "budget",
    label: "Budget",
    weight: 20,
    measure: "L’écart entre le TJM du freelance et le budget annoncé ou estimé pour la mission.",
    data: "Le TJM indiqué sur le profil et le budget de la mission, annoncé par l’entreprise ou estimé par Freeleads.",
  },
  {
    id: "availability",
    label: "Disponibilité",
    weight: 15,
    measure: "La date de disponibilité comparée à la date de début souhaitée par l’entreprise.",
    data: "Le calendrier du profil, mis à jour en un clic.",
  },
];

export const PROFILES = [
  {
    id: "lea",
    switchLabel: "Léa · monteuse vidéo",
    who: "Léa Moreau × Motion designer — 6 semaines",
    values: { skills: 92, experience: 80, budget: 78, availability: 95 },
    tips: {
      skills: "Ajoutez trois projets récents à votre portfolio et passez le test Motion design pour atteindre le niveau Testé.",
      experience: "Ajoutez vos deux dernières missions dans l’immobilier : elles comptent pour ce type de client.",
      budget: "Votre TJM (560 €) dépasse un peu la fourchette (450–550 €/j). Indiquez une fourchette plutôt qu’un prix fixe.",
      availability: "Rien à faire : vous êtes libre dès le 4 novembre, la mission commence le 6.",
    },
  },
  {
    id: "karim",
    switchLabel: "Karim · développeur fullstack",
    who: "Karim Benali × Développeur fullstack — 3 mois",
    values: { skills: 95, experience: 88, budget: 70, availability: 60 },
    tips: {
      skills: "Passez le test Node.js : votre compétence passe de Vérifié à Testé.",
      experience: "Demandez un avis à votre dernier client : une mission notée pèse plus qu’une mission déclarée.",
      budget: "Le budget estimé est de 500 €/j pour un TJM à 650 €. Vous pouvez proposer un forfait.",
      availability: "Vous êtes pris jusqu’au 15 décembre. Proposez un démarrage à temps partiel pour gagner des points.",
    },
  },
];

export const NEVER_SCORED = ["Âge", "Genre", "Photo", "Origine", "Nom de l’école"];

export const DEMO = {
  url: "carrieres.arbor-exemple.fr/charge-contenu-video",
  tags: ["Motion design", "6 semaines", "450–550 €/j", "Paris, hybride", "Début sous 15 jours"],
  shortlist: [
    { name: "Inès Garnier", initials: "IG", detail: "7 ans · 520 €/j · libre le 4 nov.", score: 94 },
    { name: "Léa Moreau", initials: "LM", detail: "6 ans · 500 €/j · libre le 4 nov.", score: 91 },
    { name: "Théo Marchand", initials: "TM", detail: "5 ans · 480 €/j · libre le 12 nov.", score: 89 },
    { name: "Sarah Benali", initials: "SB", detail: "9 ans · 550 €/j · libre le 2 déc.", score: 83 },
    { name: "Hugo Perrin", initials: "HP", detail: "4 ans · 420 €/j · libre le 18 nov.", score: 80 },
  ],
};
