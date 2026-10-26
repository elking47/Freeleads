// The nightly Freeleads engine (business plan §4):
//   Stage 1 · Scraping    22:00–03:00  collect and dedupe listings from the job boards
//   Stage 2 · AI filter   03:00–05:00  keep only hidden freelance needs, score fit and urgency
//   Stage 3 · Enrichment  05:00–07:00  identify the decision-maker and their contact details
//   Stage 4 · Delivery    07:00–08:00  fill each account by discipline and plan, notify at 8 AM
//
// This MVP ships with a demo source (fictional companies, reserved .example domains). Real job-board
// and enrichment adapters plug in at `scrape` and `enrich` without changing the rest of the pipeline.

import { DISCIPLINES, DISCIPLINE_IDS, SOURCES } from "../../shared/constants.js";
import { config } from "../config.js";
import { db, nowIso, transaction } from "../db.js";
import { planState } from "../plans.js";
import { COMPANIES, FIRST_NAMES, LAST_NAMES, LISTING_TEMPLATES } from "./demo-data.js";
import { QUALIFY_THRESHOLD, qualify } from "./qualifier.js";

export const ENGINE_MODE = "demo";
const RAW_LISTINGS_PER_DISCIPLINE = 30;
const SOURCE_IDS = Object.keys(SOURCES);

// ---- Deterministic randomness (same day => same demo batch) ----------------------------------

function seededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const slug = (text) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function sourceUrl(source, id, company) {
  switch (source) {
    case "linkedin": return `https://www.linkedin.example/jobs/view/${id}`;
    case "indeed": return `https://fr.indeed.example/viewjob?jk=${id}`;
    case "glassdoor": return `https://www.glassdoor.example/job-listing/${id}`;
    default: return `https://www.welcometothejungle.example/fr/companies/${slug(company)}/jobs/${id}`;
  }
}

// ---- Dates -----------------------------------------------------------------------------------

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.deliveryTimezone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** The batch currently on display: today's once the delivery hour has passed, else yesterday's. */
export function currentBatchDate(now = new Date()) {
  const { day, hour } = zonedParts(now);
  if (hour >= config.deliveryHour) return day;
  return zonedParts(new Date(now.getTime() - 86_400_000)).day;
}

export function shiftDate(day, deltaDays) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

// ---- Stage 1 · Scraping ----------------------------------------------------------------------

export function scrape(batchDate) {
  const random = seededRandom(`scrape:${batchDate}`);
  const listings = [];
  for (const discipline of DISCIPLINE_IDS) {
    const templates = LISTING_TEMPLATES[discipline];
    const freelanceKinds = templates.filter((t) => t.kind === "freelance" || t.kind === "hidden");
    const noise = templates.filter((t) => t.kind === "fte" || t.kind === "intern");
    for (let i = 0; i < RAW_LISTINGS_PER_DISCIPLINE; i++) {
      // Roughly 1 in 4 raw listings hides a freelance need; the rest are FTE roles and internships.
      const template = random() < 0.25 || noise.length === 0 ? pick(random, freelanceKinds) : pick(random, noise);
      const company = pick(random, COMPANIES);
      const source = pick(random, SOURCE_IDS);
      const id = `${batchDate.replaceAll("-", "")}${DISCIPLINE_IDS.indexOf(discipline)}${String(i).padStart(3, "0")}`;
      listings.push({
        discipline,
        source,
        sourceUrl: sourceUrl(source, id, company.name),
        title: template.title,
        description: template.text.replaceAll("{company}", company.name).replaceAll("{city}", company.city),
        location: company.city,
        company,
        postedAt: shiftDate(batchDate, -Math.floor(random() * 3)),
      });
    }
  }
  // Dedupe: the same company posting the same role on several boards is one opportunity.
  const seen = new Set();
  return listings.filter((listing) => {
    const key = `${listing.company.name}|${listing.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- Stage 3 · Enrichment --------------------------------------------------------------------

const upsertCompany = db.prepare(`
  INSERT INTO companies (name, domain, sector, size, city, tech_stack) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET domain = excluded.domain
  RETURNING id
`);
const findDecisionMaker = db.prepare("SELECT id FROM decision_makers WHERE company_id = ? AND role = ?");
const insertDecisionMaker = db.prepare(`
  INSERT INTO decision_makers (company_id, first_name, last_name, role, email, phone, linkedin_url)
  VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
`);

export function enrich(listing) {
  const { company } = listing;
  const companyId = upsertCompany.get(company.name, company.domain, company.sector, company.size, company.city, company.stack).id;
  const role = DISCIPLINES.find((d) => d.id === listing.discipline).decisionMaker;
  const existing = findDecisionMaker.get(companyId, role);
  if (existing) return { companyId, decisionMakerId: existing.id };

  const random = seededRandom(`person:${company.name}:${role}`);
  const first = pick(random, FIRST_NAMES);
  const last = pick(random, LAST_NAMES);
  const digits = () => String(Math.floor(random() * 100)).padStart(2, "0");
  const decisionMakerId = insertDecisionMaker.get(
    companyId,
    first,
    last,
    role,
    `${slug(first)}.${slug(last)}@${company.domain}`,
    `+33 6 39 98 ${digits()} ${digits()}`,
    `https://www.linkedin.example/in/${slug(first)}-${slug(last)}-${Math.floor(random() * 9000 + 1000)}`
  ).id;
  return { companyId, decisionMakerId };
}

// ---- Batch run (stages 1–3) ------------------------------------------------------------------

const findBatch = db.prepare("SELECT * FROM batches WHERE batch_date = ?");
const insertBatch = db.prepare(
  "INSERT INTO batches (batch_date, scraped, qualified, enriched, stages, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertListing = db.prepare(`
  INSERT OR IGNORE INTO listings
    (batch_date, source, source_url, title, company_id, discipline, description, location, budget_hint,
     fit_score, urgency, reasons, decision_maker_id, posted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const BUDGET_RE = /(€\s?\d{2,4}\s?[–-]\s?\d{2,4}\s?\/day)/;

export function runBatch(batchDate) {
  const existing = findBatch.get(batchDate);
  if (existing) return existing;

  return transaction(() => {
    const raw = scrape(batchDate);
    const qualified = raw
      .map((listing) => ({ listing, verdict: qualify(listing) }))
      .filter(({ verdict }) => verdict.score >= QUALIFY_THRESHOLD);

    for (const { listing, verdict } of qualified) {
      const { companyId, decisionMakerId } = enrich(listing);
      insertListing.run(
        batchDate, listing.source, listing.sourceUrl, listing.title, companyId, listing.discipline,
        listing.description, listing.location, listing.description.match(BUDGET_RE)?.[1] ?? null,
        verdict.score, verdict.urgency, JSON.stringify(verdict.reasons), decisionMakerId, listing.postedAt
      );
    }

    const stages = [
      { id: "scrape", label: "Scraping", window: "22:00–03:00", count: raw.length },
      { id: "filter", label: "AI filtering", window: "03:00–05:00", count: qualified.length },
      { id: "enrich", label: "Enrichment", window: "05:00–07:00", count: qualified.length },
      { id: "deliver", label: "Delivery", window: `${String(config.deliveryHour).padStart(2, "0")}:00`, count: null },
    ];
    insertBatch.run(batchDate, raw.length, qualified.length, qualified.length, JSON.stringify(stages), nowIso());
    return findBatch.get(batchDate);
  });
}

// ---- Stage 4 · Delivery ----------------------------------------------------------------------

const findDelivery = db.prepare("SELECT delivered FROM deliveries WHERE user_id = ? AND delivered_on = ?");
const insertDelivery = db.prepare(
  "INSERT INTO deliveries (user_id, delivered_on, delivered, created_at) VALUES (?, ?, ?, ?)"
);
const insertLead = db.prepare(`
  INSERT OR IGNORE INTO leads (user_id, listing_id, delivered_on, updated_at) VALUES (?, ?, ?, ?)
`);
const userDisciplines = db.prepare("SELECT discipline FROM user_disciplines WHERE user_id = ?");

// Best matches first, and never the same company + role twice for one user.
const candidateListings = db.prepare(`
  SELECT l.id FROM listings l
  WHERE l.batch_date = ?
    AND l.discipline IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (
      SELECT 1 FROM leads d JOIN listings x ON x.id = d.listing_id
      WHERE d.user_id = ? AND x.company_id = l.company_id AND x.title = l.title
    )
  ORDER BY l.fit_score DESC, CASE l.urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, l.id
  LIMIT ?
`);

export function deliverToUser(user, batchDate) {
  const already = findDelivery.get(user.id, batchDate);
  if (already) return already.delivered;

  const plan = planState(user);
  if (!plan.canReceiveLeads) return 0;

  runBatch(batchDate);
  const disciplines = userDisciplines.all(user.id).map((row) => row.discipline);
  return transaction(() => {
    // SQLite treats a negative LIMIT as "no limit" (Team plan).
    const ids = candidateListings.all(batchDate, JSON.stringify(disciplines), user.id, plan.leadsPerDay ?? -1);
    const timestamp = nowIso();
    for (const { id } of ids) insertLead.run(user.id, id, batchDate, timestamp);
    insertDelivery.run(user.id, batchDate, ids.length, timestamp);
    return ids.length;
  });
}

const allUsers = db.prepare("SELECT id, plan, trial_ends_at FROM users");

/** Run tonight's batch and deliver it to every account that has not received it yet. */
export function runDailyCycle(now = new Date()) {
  const batchDate = currentBatchDate(now);
  runBatch(batchDate);
  let delivered = 0;
  for (const row of allUsers.all()) {
    delivered += deliverToUser({ id: row.id, plan: row.plan, trialEndsAt: row.trial_ends_at }, batchDate);
  }
  return { batchDate, delivered };
}
