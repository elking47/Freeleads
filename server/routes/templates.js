import { Router } from "express";
import { schemas, validate } from "../../shared/validation.js";
import { db, nowIso } from "../db.js";
import { HttpError, parseId, validationError } from "../security.js";

const q = {
  list: db.prepare(`
    SELECT id, user_id, name, channel, discipline, subject, body, updated_at FROM templates
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY user_id IS NULL, channel, name
  `),
  owned: db.prepare("SELECT id FROM templates WHERE id = ? AND user_id = ?"),
  insert: db.prepare(`
    INSERT INTO templates (user_id, name, channel, discipline, subject, body, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `),
  update: db.prepare(`
    UPDATE templates SET name = ?, channel = ?, discipline = ?, subject = ?, body = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `),
  remove: db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?"),
};

const serialize = (row) => ({
  id: row.id,
  mine: row.user_id !== null,
  name: row.name,
  channel: row.channel,
  discipline: row.discipline,
  subject: row.subject,
  body: row.body,
  updatedAt: row.updated_at,
});

function requireOwned(req) {
  const id = parseId(req.params.id);
  // System templates (user_id NULL) are read-only, so they never match here.
  if (!q.owned.get(id, req.user.id)) throw new HttpError(404, "not_found", "Template not found.");
  return id;
}

export const templatesRouter = Router();

templatesRouter.get("/", (req, res) => {
  res.json({ templates: q.list.all(req.user.id).map(serialize) });
});

templatesRouter.post("/", (req, res) => {
  const { ok, data, errors } = validate(schemas.template, req.body);
  if (!ok) throw validationError(errors);
  const now = nowIso();
  const { id } = q.insert.get(req.user.id, data.name, data.channel, data.discipline ?? null, data.subject ?? null, data.body, now, now);
  res.status(201).json({ id });
});

templatesRouter.put("/:id", (req, res) => {
  const id = requireOwned(req);
  const { ok, data, errors } = validate(schemas.template, req.body);
  if (!ok) throw validationError(errors);
  q.update.run(data.name, data.channel, data.discipline ?? null, data.subject ?? null, data.body, nowIso(), id, req.user.id);
  res.json({ ok: true });
});

templatesRouter.delete("/:id", (req, res) => {
  const id = requireOwned(req);
  q.remove.run(id, req.user.id);
  res.json({ ok: true });
});
