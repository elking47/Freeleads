// Built-in contact templates (business plan: cold email, LinkedIn InMail and call script, per discipline).
import { db, nowIso } from "./db.js";

const TEMPLATES = [
  {
    name: "Short intro: spotted your listing",
    channel: "email",
    discipline: null,
    subject: "Your {{jobTitle}} listing: a faster option",
    body: `Hi {{firstName}},

I saw that {{company}} is looking for a {{jobTitle}}. I'm a freelancer and I do exactly this kind of mission. I could start quickly, without a long hiring process.

Would a 15-minute call this week work for you? I can share two similar projects I delivered recently.

Best,
{{myName}}`,
  },
  {
    name: "Follow-up (D+3)",
    channel: "email",
    discipline: null,
    subject: "Re: your {{jobTitle}} listing",
    body: `Hi {{firstName}},

Just following up on my note from earlier this week. If the {{jobTitle}} need is still open, I'm available to start soon at {{dailyRate}}.

Happy to send a short proposal if useful.

{{myName}}`,
  },
  {
    name: "Web: scoped mission proposal",
    channel: "email",
    discipline: "web",
    subject: "{{company}}: shipping your {{jobTitle}} scope in weeks, not months",
    body: `Hi {{firstName}},

Your {{jobTitle}} listing reads like a well-scoped project. Rather than a long hire, I could take it on as a fixed-length mission with weekly demos, so your team stays focused on the roadmap.

Recent work: dashboard rebuilds, API integrations and front-end migrations for SaaS teams.

Open to a quick call to scope it together?

{{myName}}`,
  },
  {
    name: "Video: launch content",
    channel: "linkedin",
    discipline: "video",
    subject: null,
    body: `Hi {{firstName}}, I saw {{company}} is preparing launch content. I'm a freelance motion designer and I deliver short launch videos in 2–4 weeks. Happy to share my reel if it helps.`,
  },
  {
    name: "LinkedIn: quick note",
    channel: "linkedin",
    discipline: null,
    subject: null,
    body: `Hi {{firstName}}, I noticed {{company}}'s {{jobTitle}} opening. I'm a freelancer who does this kind of mission and I could start soon. Worth a quick chat?`,
  },
  {
    name: "Call script: 60 seconds",
    channel: "call",
    discipline: null,
    subject: null,
    body: `1. Hi {{firstName}}, this is {{myName}}. I'm calling about the {{jobTitle}} listing at {{company}}. Do you have one minute?
2. I'm a freelancer: I can take this on as a mission and start quickly, without a hiring cycle.
3. Question: what does success look like for this role in the first 2 months?
4. Next step: can I send you a short proposal and book 20 minutes this week?`,
  },
];

export function seedTemplates() {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM templates WHERE user_id IS NULL").get();
  if (n > 0) return;
  const insert = db.prepare(`
    INSERT INTO templates (user_id, name, channel, discipline, subject, body, created_at, updated_at)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = nowIso();
  for (const t of TEMPLATES) insert.run(t.name, t.channel, t.discipline, t.subject, t.body, now, now);
}
