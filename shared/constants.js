// Product constants shared by the browser and the server.
// Values come from the Freeleads business plan (disciplines, tiers, pipeline stages).

export const DISCIPLINES = Object.freeze([
  { id: "web", label: "Web", detail: "Front, back, fullstack", decisionMaker: "CTO" },
  { id: "marketing", label: "Marketing", detail: "SEO, SEA, CRM, growth", decisionMaker: "CMO" },
  { id: "design", label: "Design", detail: "Identity, print", decisionMaker: "Creative Director" },
  { id: "copywriting", label: "Copywriting", detail: "SEO, technical", decisionMaker: "Head of Content" },
  { id: "video", label: "Video", detail: "Motion, editing, capture", decisionMaker: "Head of Content" },
  { id: "communications", label: "Communications", detail: "PR, brand, events", decisionMaker: "Head of Communications" },
  { id: "photography", label: "Photography", detail: "Corporate, product", decisionMaker: "Marketing Manager" },
  { id: "sales", label: "Sales", detail: "B2B prospecting", decisionMaker: "Head of Sales" },
]);

export const DISCIPLINE_IDS = Object.freeze(DISCIPLINES.map((d) => d.id));

export const PLANS = Object.freeze({
  solo: { id: "solo", label: "Solo", price: 29, leadsPerDay: 10, disciplines: 1, seats: 1, api: false },
  pro: { id: "pro", label: "Pro", price: 59, leadsPerDay: 30, disciplines: 3, seats: 1, api: false },
  // leadsPerDay: null means unlimited.
  team: { id: "team", label: "Team", price: 149, leadsPerDay: null, disciplines: 8, seats: 5, api: true },
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

// Automated follow-up reminders after first contact (business plan: D+3 and D+7).
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
