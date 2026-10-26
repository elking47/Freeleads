import { Router } from "express";
import { db } from "../db.js";
import { currentBatchDate, shiftDate } from "../engine/pipeline.js";

const q = {
  totals: db.prepare(`
    SELECT
      COUNT(*) AS delivered,
      COUNT(contacted_at) AS contacted,
      COUNT(replied_at) AS replied,
      COUNT(won_at) AS won,
      COUNT(lost_at) AS lost,
      COALESCE(SUM(CASE WHEN status = 'won' THEN won_amount END), 0) AS revenue,
      SUM(rating = 'up') AS rated_up,
      SUM(rating = 'down') AS rated_down
    FROM leads WHERE user_id = ?
  `),
  byDiscipline: db.prepare(`
    SELECT l.discipline, COUNT(*) AS delivered, COUNT(d.contacted_at) AS contacted,
           COUNT(d.replied_at) AS replied, COUNT(d.won_at) AS won
    FROM leads d JOIN listings l ON l.id = d.listing_id
    WHERE d.user_id = ? GROUP BY l.discipline ORDER BY delivered DESC
  `),
  deliveredPerDay: db.prepare(`
    SELECT delivered_on AS day, COUNT(*) AS n FROM leads
    WHERE user_id = ? AND delivered_on >= ? GROUP BY delivered_on
  `),
  contactedPerDay: db.prepare(`
    SELECT substr(contacted_at, 1, 10) AS day, COUNT(*) AS n FROM leads
    WHERE user_id = ? AND contacted_at >= ? GROUP BY day
  `),
};

const rate = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export const analyticsRouter = Router();

analyticsRouter.get("/", (req, res) => {
  const totals = q.totals.get(req.user.id);
  const today = currentBatchDate();
  const since = shiftDate(today, -13);
  const delivered = Object.fromEntries(q.deliveredPerDay.all(req.user.id, since).map((r) => [r.day, r.n]));
  const contacted = Object.fromEntries(q.contactedPerDay.all(req.user.id, since).map((r) => [r.day, r.n]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = shiftDate(since, i);
    return { day, delivered: delivered[day] ?? 0, contacted: contacted[day] ?? 0 };
  });

  res.json({
    totals: {
      delivered: totals.delivered,
      contacted: totals.contacted,
      replied: totals.replied,
      won: totals.won,
      lost: totals.lost,
      revenue: totals.revenue,
      ratedUp: totals.rated_up ?? 0,
      ratedDown: totals.rated_down ?? 0,
    },
    rates: {
      contact: rate(totals.contacted, totals.delivered),
      reply: rate(totals.replied, totals.contacted),
      close: rate(totals.won, totals.contacted),
    },
    byDiscipline: q.byDiscipline.all(req.user.id),
    days,
  });
});
