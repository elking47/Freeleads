// Public endpoint for companies: submit a job offer (link or description) to get a freelance shortlist.
// The offer link is stored as text for the team to review; the server never fetches it (no SSRF).
import { Router } from "express";
import { validateMissionRequest } from "../../shared/validation.js";
import { db, nowIso } from "../db.js";
import { missionLimiter, validationError } from "../security.js";

const insertRequest = db.prepare(`
  INSERT INTO mission_requests (offer_url, description, company, contact_name, email, phone, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const missionsRouter = Router();

missionsRouter.post("/", missionLimiter, (req, res) => {
  const { ok, data, errors } = validateMissionRequest(req.body);
  if (!ok) throw validationError(errors);
  insertRequest.run(
    data.offerUrl ?? null, data.description ?? null, data.company, data.name, data.email, data.phone ?? null, nowIso()
  );
  res.status(201).json({ ok: true });
});
