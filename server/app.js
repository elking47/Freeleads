import path from "node:path";
import express from "express";
import { loadSession, requireAuth } from "./auth.js";
import { config } from "./config.js";
import { analyticsRouter } from "./routes/analytics.js";
import { authRouter } from "./routes/auth.js";
import { leadsRouter } from "./routes/leads.js";
import { settingsRouter } from "./routes/settings.js";
import { templatesRouter } from "./routes/templates.js";
import {
  apiLimiter,
  apiNotFound,
  errorHandler,
  parseCookies,
  requireJson,
  securityHeaders,
  verifyCsrf,
  writeLimiter,
} from "./security.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(securityHeaders);
  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  });

  // ---- API: every endpoint is rate limited, JSON-only, CSRF-checked and never cached ----
  const api = express.Router();
  api.use(apiLimiter);
  api.use(requireJson);
  api.use(express.json({ limit: "20kb", strict: true }));
  api.use(loadSession);
  api.use(verifyCsrf);
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (READ_METHODS.has(req.method)) return next();
    writeLimiter(req, res, next);
  });

  api.use("/auth", authRouter);
  api.use("/leads", requireAuth, leadsRouter);
  api.use("/templates", requireAuth, templatesRouter);
  api.use("/settings", requireAuth, settingsRouter);
  api.use("/analytics", requireAuth, analyticsRouter);
  api.use(apiNotFound);
  app.use("/api", api);

  // ---- Static site ----
  const staticOptions = { index: false, maxAge: 0, setHeaders: (res) => res.set("Cache-Control", "no-cache") };
  app.use("/shared", express.static(path.join(config.rootDir, "shared"), staticOptions));
  app.use(express.static(path.join(config.rootDir, "public"), { ...staticOptions, index: "index.html", extensions: ["html"] }));
  app.get(/^\/app(\/.*)?$/, (_req, res) => res.sendFile(path.join(config.rootDir, "public", "app.html")));
  app.use((_req, res) => res.status(404).sendFile(path.join(config.rootDir, "public", "404.html")));

  app.use(errorHandler);
  return app;
}
