// Product constants shared by the browser and the server.
// Disciplines and plans follow maquette v6 (Gratuit / Pro / Studio, free for companies).

export const DISCIPLINES = Object.freeze([
  { id: "video", label: "Vidéo", detail: "Motion, montage, captation", decisionMaker: "Head of Content" },
  { id: "design", label: "Design", detail: "Identité, print, UI", decisionMaker: "Directeur·rice artistique" },
  { id: "web", label: "Développement web", detail: "Front, back, fullstack", decisionMaker: "CTO" },
  { id: "marketing", label: "Marketing", detail: "SEO, SEA, CRM, growth", decisionMaker: "CMO" },
  { id: "copywriting", label: "Rédaction", detail: "SEO, technique", decisionMaker: "Responsable contenu" },
  { id: "photography", label: "Photographie", detail: "Corporate, produit", decisionMaker: "Responsable marketing" },
  { id: "communications", label: "Communication", detail: "RP, marque, événements", decisionMaker: "Directeur·rice communication" },
  { id: "sales", label: "Développement commercial", detail: "Prospection B2B", decisionMaker: "Directeur·rice commercial" },
]);

export const DISCIPLINE_IDS = Object.freeze(DISCIPLINES.map((d) => d.id));

// leadsPerDay / contactsPerMonth: null means unlimited.
export const PLANS = Object.freeze({
  free: { id: "free", label: "Gratuit", price: 0, leadsPerDay: null, contactsPerMonth: 5, disciplines: 3, seats: 1, api: false },
  pro: { id: "pro", label: "Pro", price: 19, leadsPerDay: null, contactsPerMonth: null, disciplines: 3, seats: 1, api: false },
  studio: { id: "studio", label: "Studio", price: 49, leadsPerDay: null, contactsPerMonth: null, disciplines: 8, seats: 3, api: true },
});

export const PLAN_IDS = Object.freeze(Object.keys(PLANS));
export const TRIAL_DAYS = 14;

export const LEAD_STATUSES = Object.freeze([
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
]);

export const LEAD_STATUS_IDS = Object.freeze(LEAD_STATUSES.map((s) => s.id));

export const CHANNELS = Object.freeze([
  { id: "email", label: "Cold email" },
  { id: "linkedin", label: "LinkedIn InMail" },
  { id: "call", label: "Call script" },
]);

export const CHANNEL_IDS = Object.freeze(CHANNELS.map((c) => c.id));

export const SOURCES = Object.freeze({
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  wttj: "Welcome to the Jungle",
});

// Automated follow-up reminders after first contact (D+3 and D+7).
export const FOLLOW_UP_DAYS = Object.freeze([3, 7]);

export const TEMPLATE_VARIABLES = Object.freeze([
  "firstName",
  "company",
  "role",
  "jobTitle",
  "myName",
  "dailyRate",
]);

export const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id;
