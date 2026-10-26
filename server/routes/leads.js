import { Router } from "express";
import { FOLLOW_UP_DAYS, SOURCES } from "../../shared/constants.js";
import { schemas, validate } from "../../shared/validation.js";
import { db, nowIso, transaction } from "../db.js";
import { ENGINE_MODE } from "../engine/pipeline.js";
import { planState } from "../plans.js";
import { HttpError, parseId, validationError } from "../security.js";

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

const LEAD_COLUMNS = `
  d.id, d.status, d.rating, d.notes, d.won_amount, d.delivered_on, d.contacted_at, d.replied_at, d.won_at,
  d.lost_at, d.followup1_done_at, d.followup2_done_at, d.updated_at,
  l.title, l.source, l.source_url, l.discipline, l.description, l.location, l.budget_hint, l.fit_score,
  l.urgency, l.reasons, l.posted_at,
  c.name AS company_name, c.domain AS company_domain, c.sector AS company_sector, c.size AS company_size,
  c.city AS company_city, c.tech_stack AS company_stack,
  m.first_name AS dm_first_name, m.last_name AS dm_last_name, m.role AS dm_role, m.email AS dm_email,
  m.phone AS dm_phone, m.linkedin_url AS dm_linkedin
`;
const LEAD_FROM = `
  FROM leads d
  JOIN listings l ON l.id = d.listing_id
  JOIN companies c ON c.id = l.company_id
  LEFT JOIN decision_makers m ON m.id = l.decision_maker_id
`;

// Sort keys map to fixed SQL; user input never reaches the ORDER BY clause.
const ORDER_BY = {
  score: "l.fit_score DESC, d.id DESC",
  newest: "d.delivered_on DESC, l.fit_score DESC, d.id DESC",
  urgency: "CASE l.urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, l.fit_score DESC, d.id DESC",
};

const q = {
  latestDelivery: db.prepare("SELECT MAX(delivered_on) AS day FROM deliveries WHERE user_id = ?"),
  batch: db.prepare("SELECT * FROM batches WHERE batch_date = ?"),
  deliveredCount: db.prepare("SELECT delivered FROM deliveries WHERE user_id = ? AND delivered_on = ?"),
  byId: db.prepare(`SELECT ${LEAD_COLUMNS} ${LEAD_FROM} WHERE d.id = ? AND d.user_id = ?`),
  activities: db.prepare("SELECT kind, detail, created_at FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 50"),
  addActivity: db.prepare("INSERT INTO activities (lead_id, kind, detail, created_at) VALUES (?, ?, ?, ?)"),
  update: db.prepare(`
    UPDATE leads SET
      status = ?, rating = ?, notes = ?, won_amount = ?,
      contacted_at = ?, replied_at = ?, won_at = ?, lost_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `),
  followUpDone: [
    db.prepare("UPDATE leads SET followup1_done_at = ?, updated_at = ? WHERE id = ? AND user_id = ?"),
    db.prepare("UPDATE leads SET followup2_done_at = ?, updated_at = ? WHERE id = ? AND user_id = ?"),
  ],
  contactedLeads: db.prepare(`
    SELECT ${LEAD_COLUMNS} ${LEAD_FROM}
    WHERE d.user_id = ? AND d.status = 'contacted' AND d.contacted_at IS NOT NULL
      AND (d.followup1_done_at IS NULL OR d.followup2_done_at IS NULL)
  `),
};

function followUps(row) {
  if (!row.contacted_at) return [];
  const start = Date.parse(row.contacted_at);
  return FOLLOW_UP_DAYS.map((days, index) => ({
    step: index + 1,
    days,
    dueAt: new Date(start + days * DAY_MS).toISOString(),
    doneAt: index === 0 ? row.followup1_done_at : row.followup2_done_at,
  }));
}

export function serializeLead(row) {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    notes: row.notes,
    wonAmount: row.won_amount,
    deliveredOn: row.delivered_on,
    contactedAt: row.contacted_at,
    repliedAt: row.replied_at,
    wonAt: row.won_at,
    lostAt: row.lost_at,
    updatedAt: row.updated_at,
    followUps: followUps(row),
    listing: {
      title: row.title,
      source: row.source,
      sourceLabel: SOURCES[row.source] ?? row.source,
      sourceUrl: row.source_url,
      discipline: row.discipline,
      description: row.description,
      location: row.location,
      budgetHint: row.budget_hint,
      fitScore: row.fit_score,
      urgency: row.urgency,
      reasons: JSON.parse(row.reasons),
      postedAt: row.posted_at,
    },
    company: {
      name: row.company_name,
      domain: row.company_domain,
      sector: row.company_sector,
      size: row.company_size,
      city: row.company_city,
      techStack: row.company_stack,
    },
    decisionMaker: row.dm_first_name
      ? {
          firstName: row.dm_first_name,
          lastName: row.dm_last_name,
          role: row.dm_role,
          email: row.dm_email,
          phone: row.dm_phone,
          linkedinUrl: row.dm_linkedin,
        }
      : null,
  };
}

const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

function getOwnedLead(req) {
  const row = q.byId.get(parseId(req.params.id), req.user.id);
  if (!row) throw new HttpError(404, "not_found", "Lead not found.");
  return row;
}

export const leadsRouter = Router();

leadsRouter.get("/", (req, res) => {
  const { ok, data, errors } = validate(schemas.leadQuery, req.query);
  if (!ok) throw validationError(errors);

  // WHERE fragments are fixed strings; every value is bound as a parameter.
  const where = ["d.user_id = ?"];
  const params = [req.user.id];
  let deliveredOn = null;

  if (data.view === "today") {
    deliveredOn = q.latestDelivery.get(req.user.id).day;
    where.push("d.delivered_on = ?");
    params.push(deliveredOn ?? "");
  }
  if (data.status) {
    where.push("d.status = ?");
    params.push(data.status);
  }
  if (data.discipline) {
    where.push("l.discipline = ?");
    params.push(data.discipline);
  }
  if (data.minScore !== undefined) {
    where.push("l.fit_score >= ?");
    params.push(data.minScore);
  }
  if (data.q) {
    const like = `%${escapeLike(data.q)}%`;
    where.push("(l.title LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }

  const whereSql = where.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS n ${LEAD_FROM} WHERE ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(`SELECT ${LEAD_COLUMNS} ${LEAD_FROM} WHERE ${whereSql} ORDER BY ${ORDER_BY[data.sort]} LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (data.page - 1) * PAGE_SIZE);

  res.json({ leads: rows.map(serializeLead), total, page: data.page, pageSize: PAGE_SIZE, deliveredOn });
});

leadsRouter.get("/delivery", (req, res) => {
  const deliveredOn = q.latestDelivery.get(req.user.id).day;
  const batch = deliveredOn ? q.batch.get(deliveredOn) : null;
  const plan = planState(req.user);
  const delivered = deliveredOn ? q.deliveredCount.get(req.user.id, deliveredOn).delivered : 0;
  const stages = batch ? JSON.parse(batch.stages) : [];
  for (const stage of stages) if (stage.id === "deliver") stage.count = delivered;
  res.json({ deliveredOn, delivered, quota: plan.leadsPerDay, stages, mode: ENGINE_MODE });
});

leadsRouter.get("/followups", (req, res) => {
  const now = Date.now();
  const items = [];
  for (const row of q.contactedLeads.all(req.user.id)) {
    const lead = serializeLead(row);
    const next = lead.followUps.find((f) => !f.doneAt);
    if (next) items.push({ lead, step: next.step, days: next.days, dueAt: next.dueAt, overdue: Date.parse(next.dueAt) <= now });
  }
  items.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  res.json({ items });
});

leadsRouter.get("/:id", (req, res) => {
  const row = getOwnedLead(req);
  const activities = q.activities.all(row.id).map((a) => ({ kind: a.kind, detail: a.detail, createdAt: a.created_at }));
  res.json({ lead: serializeLead(row), activities });
});

leadsRouter.patch("/:id", (req, res) => {
  const row = getOwnedLead(req);
  const { ok, data, errors } = validate(schemas.leadUpdate, req.body, { partial: true });
  if (!ok) throw validationError(errors);

  const now = nowIso();
  const next = {
    status: data.status ?? row.status,
    rating: data.rating !== undefined ? data.rating : row.rating,
    notes: data.notes !== undefined ? data.notes : row.notes,
    wonAmount: data.wonAmount !== undefined ? data.wonAmount : row.won_amount,
    contactedAt: row.contacted_at,
    repliedAt: row.replied_at,
    wonAt: row.won_at,
    lostAt: row.lost_at,
  };

  // Reaching a later stage implies the earlier ones happened.
  if (["contacted", "replied", "won", "lost"].includes(next.status)) next.contactedAt ??= now;
  if (["replied", "won"].includes(next.status)) next.repliedAt ??= now;
  if (next.status === "won") next.wonAt ??= now;
  if (next.status === "lost") next.lostAt ??= now;
  if (next.status !== "won") next.wonAt = null;
  if (next.status !== "lost") next.lostAt = null;

  transaction(() => {
    q.update.run(
      next.status, next.rating, next.notes, next.wonAmount,
      next.contactedAt, next.repliedAt, next.wonAt, next.lostAt, now, row.id, req.user.id
    );
    if (data.status && data.status !== row.status) q.addActivity.run(row.id, "status", data.status, now);
    if (data.rating !== undefined && data.rating !== row.rating) q.addActivity.run(row.id, "rating", data.rating, now);
    if (data.notes !== undefined && data.notes !== row.notes) q.addActivity.run(row.id, "note", null, now);
  });

  res.json({ lead: serializeLead(q.byId.get(row.id, req.user.id)) });
});

leadsRouter.post("/:id/followups", (req, res) => {
  const row = getOwnedLead(req);
  const { ok, data, errors } = validate(schemas.followUpDone, req.body);
  if (!ok) throw validationError(errors);
  if (!row.contacted_at) throw new HttpError(409, "not_contacted", "Mark the lead as contacted first.");

  const now = nowIso();
  q.followUpDone[data.step - 1].run(now, now, row.id, req.user.id);
  q.addActivity.run(row.id, "followup", String(data.step), now);
  res.json({ lead: serializeLead(q.byId.get(row.id, req.user.id)) });
});
