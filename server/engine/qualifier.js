// Stage 2: decide whether a job listing hides a freelance need.
// Rules-based scorer with human-readable reasons. An LLM classifier can replace `qualify` as long as it
// returns the same shape: { score 0-100, urgency, reasons[] }.

const RULES = [
  { re: /\b(freelance|freelancer|independent|indépendant|consultant externe)\b/i, points: 30, reason: "Explicitly open to freelancers" },
  { re: /\b(\d{1,2})[- ](week|month|mois|semaine)s?\b/i, points: 22, reason: (m) => `Fixed-length mission (${m[1]} ${m[2].toLowerCase()}s)` },
  { re: /\b(mission|contract|contractor|project-based|one-off|ponctuel)\b/i, points: 18, reason: "Scoped as a mission, not a permanent role" },
  { re: /\b(part-time|temps partiel|\d days? (a|per) week)\b/i, points: 10, reason: "Part-time workload" },
  { re: /(€|eur)\s?\d{2,4}\s?(-|–|to)\s?\d{2,4}\s?(\/day|per day|\/jour|tjm)|\b(daily rate|tjm)\b/i, points: 12, reason: "Daily rate or budget mentioned" },
  { re: /\b(launch|campaign|rebrand|migration|redesign|refonte)\b/i, points: 8, reason: "Tied to a one-time project" },
  { re: /\b(cdi|permanent|full-time employee|temps plein|career growth|stock options)\b/i, points: -35, reason: null },
  { re: /\b(intern|internship|stage|stagiaire|alternance|apprentice)\b/i, points: -70, reason: null },
];

const URGENT_RE = /\b(asap|urgent|immediately|dès que possible|this week|next monday)\b/i;
const SOON_RE = /\b(next month|within (2|two|3|three) weeks|early (january|february|march|april|may|june|july|august|september|october|november|december))\b/i;

export const QUALIFY_THRESHOLD = 55;

export function qualify({ title, description }) {
  const text = `${title}\n${description}`;
  let score = 35;
  const reasons = [];

  for (const rule of RULES) {
    const match = text.match(rule.re);
    if (!match) continue;
    score += rule.points;
    if (rule.reason) reasons.push(typeof rule.reason === "function" ? rule.reason(match) : rule.reason);
  }

  let urgency = "low";
  if (URGENT_RE.test(text)) {
    urgency = "high";
    score += 6;
    reasons.push("Needs someone to start right away");
  } else if (SOON_RE.test(text)) {
    urgency = "medium";
    reasons.push("Starts within the next few weeks");
  }

  return { score: Math.max(0, Math.min(100, score)), urgency, reasons: reasons.slice(0, 4) };
}
