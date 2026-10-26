import { Router } from "express";
import { PLANS } from "../../shared/constants.js";
import { schemas, validate } from "../../shared/validation.js";
import { endSession, hashPassword, revokeOtherSessions, verifyPassword } from "../auth.js";
import { db, transaction } from "../db.js";
import { planState } from "../plans.js";
import { authIpLimiter, securityLog, validationError } from "../security.js";
import { publicUser } from "./auth.js";

const q = {
  passwordHash: db.prepare("SELECT password_hash FROM users WHERE id = ?"),
  updateName: db.prepare("UPDATE users SET name = ? WHERE id = ?"),
  updateRate: db.prepare("UPDATE users SET daily_rate = ? WHERE id = ?"),
  updateLocation: db.prepare("UPDATE users SET location = ? WHERE id = ?"),
  clearDisciplines: db.prepare("DELETE FROM user_disciplines WHERE user_id = ?"),
  addDiscipline: db.prepare("INSERT INTO user_disciplines (user_id, discipline) VALUES (?, ?)"),
  updatePassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
  updatePlan: db.prepare("UPDATE users SET plan = ?, trial_ends_at = NULL WHERE id = ?"),
  deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
};

async function requirePassword(req, password) {
  const { password_hash: hash } = q.passwordHash.get(req.user.id);
  if (!(await verifyPassword(password, hash))) {
    securityLog("reauth_failed", { userId: req.user.id, ip: req.ip });
    throw validationError({ password: "Password is incorrect." });
  }
}

const setDisciplines = (userId, disciplines) => {
  q.clearDisciplines.run(userId);
  for (const discipline of disciplines) q.addDiscipline.run(userId, discipline);
};

export const settingsRouter = Router();

settingsRouter.patch("/profile", (req, res) => {
  const { ok, data, errors } = validate(schemas.profile, req.body, { partial: true });
  if (!ok) throw validationError(errors);

  const allowed = planState(req.user).disciplines;
  if (data.disciplines && data.disciplines.length > allowed) {
    throw validationError({ disciplines: `Your plan includes ${allowed} discipline${allowed > 1 ? "s" : ""}. Upgrade to add more.` });
  }

  transaction(() => {
    if (data.name !== undefined) q.updateName.run(data.name, req.user.id);
    if (data.dailyRate !== undefined) q.updateRate.run(data.dailyRate, req.user.id);
    if (data.location !== undefined) q.updateLocation.run(data.location, req.user.id);
    if (data.disciplines) setDisciplines(req.user.id, data.disciplines);
  });
  res.json({ ok: true });
});

settingsRouter.post("/plan", (req, res) => {
  const { ok, data, errors } = validate(schemas.plan, req.body);
  if (!ok) throw validationError(errors);

  // Billing is not connected in the MVP: switching plans ends the trial without charging anything.
  const allowed = PLANS[data.plan].disciplines;
  transaction(() => {
    q.updatePlan.run(data.plan, req.user.id);
    if (req.user.disciplines.length > allowed) setDisciplines(req.user.id, req.user.disciplines.slice(0, allowed));
  });
  const trimmed = req.user.disciplines.length > allowed;
  res.json({ ok: true, trimmedDisciplines: trimmed });
});

settingsRouter.post("/password", authIpLimiter, async (req, res) => {
  const { ok, data, errors } = validate(schemas.passwordChange, req.body);
  if (!ok) throw validationError(errors);
  const { password_hash: hash } = q.passwordHash.get(req.user.id);
  if (!(await verifyPassword(data.currentPassword, hash))) {
    securityLog("password_change_failed", { userId: req.user.id, ip: req.ip });
    throw validationError({ currentPassword: "Current password is incorrect." });
  }
  q.updatePassword.run(await hashPassword(data.newPassword), req.user.id);
  revokeOtherSessions(req.user.id, req.session.tokenHash);
  res.json({ ok: true });
});

settingsRouter.post("/delete-account", authIpLimiter, async (req, res) => {
  const { ok, data, errors } = validate(schemas.deleteAccount, req.body);
  if (!ok) throw validationError(errors);
  await requirePassword(req, data.password);
  endSession(req, res);
  q.deleteUser.run(req.user.id); // Cascades to sessions, leads, templates and deliveries (GDPR erasure).
  securityLog("account_deleted", { userId: req.user.id });
  res.json({ ok: true });
});

settingsRouter.get("/", (req, res) => {
  res.json({ user: publicUser(req.user) });
});
