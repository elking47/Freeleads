# Freeleads

Prospecting automation for freelancers. Every morning at 8 AM, qualified freelance opportunities with the
decision-maker's contact details land in a lightweight CRM.

- **Concept & reverse-engineering notes** (what we took from Collective.work and why): [CONCEPT.md](CONCEPT.md)
- **Stack**: Node.js 22 (built-in SQLite), Express 5, Helmet, express-rate-limit. Vanilla ES modules on
  the frontend: no build step and no `innerHTML`.

## Run it

```bash
npm install
cp .env.example .env        # then set SESSION_SECRET (see the command inside the file)
npm run dev                 # http://127.0.0.1:3000
npm test                    # security test suite
```

Sign up at `/signup`. The current day's Freeleads are delivered immediately. The engine runs its batch
every day at `DELIVERY_HOUR` (default 8 AM, Europe/Paris).

## What's inside

| Path | Purpose |
|---|---|
| `public/index.html` | Marketing site: hero, problem, 4-stage engine, CRM features, disciplines, pricing, FAQ |
| `public/signup.html`, `login.html` | Split-screen auth pages |
| `public/app.html` + `public/js/app/` | The app: Today (8 AM feed), All leads, Pipeline (kanban), Templates, Follow-ups (D+3/D+7), Analytics, Settings |
| `shared/` | Constants and **validation rules used by both the browser and the API** |
| `server/engine/` | Nightly pipeline: scrape → AI filter (`qualifier.js`) → enrich → deliver |
| `server/routes/` | JSON API (`/api/auth`, `/api/leads`, `/api/templates`, `/api/settings`, `/api/analytics`) |
| `test/security.test.js` | End-to-end security checks |

### Demo data

The MVP ships with a **demo source**: fictional companies, reserved `.example` domains and phone numbers
from the French range reserved for fiction. No real person's data is generated. The qualifier is real code:
it scores each listing's text for freelance fit and explains why. To go live, replace `scrape()` and
`enrich()` in `server/engine/pipeline.js` with real job-board and enrichment adapters (Dropcontact, Kaspr,
Hunter…). Read their API keys from new environment variables in `server/config.js`, never from code.

## Security (OWASP)

| Requirement | Where |
|---|---|
| Sanitize all user input | `shared/validation.js` normalizes Unicode and strips control and bidi characters. Every schema whitelists fields (unknown fields are rejected, so no mass assignment). The UI renders only with text nodes (`public/js/lib/dom.js`), URLs are limited to safe schemes, and a strict CSP allows no inline scripts |
| Rate limiting on every API endpoint | `server/security.js`: a global `/api` limiter plus stricter limits on signup/login (per IP **and** per account), password changes, and writes per user |
| No hard-coded API keys | `server/config.js` reads everything from the environment. `.env` is git-ignored and `.env.example` documents each variable. The app refuses to start in production without a strong `SESSION_SECRET` |
| Parameterized queries | Every SQL statement is a prepared statement with bound parameters. Dynamic filters only combine fixed SQL fragments, sort keys map to a whitelist, and `LIKE` wildcards are escaped |
| Validate on frontend and backend | `public/js/lib/forms.js` runs the same `shared/validation.js` schemas the API runs again on every request |
| Also | scrypt password hashing; session rotation on login; HttpOnly + SameSite=Strict (+ Secure in production) cookies; signed double-submit CSRF tokens bound to the session; ownership checks on every lead and template (no IDOR); account lockout after 5 failed logins; generic login errors with timing equalization; 20 kB JSON body limit; JSON-only writes; no stack traces in responses; Helmet headers and HSTS in production; GDPR account deletion |

**Before production**
- Run behind HTTPS with `NODE_ENV=production` and set `TRUST_PROXY` to the number of proxies in front of
  the app.
- The rate-limit store is in memory. Use a shared store (for example Redis) if you run several instances.
- Not built yet: email verification, password reset, SSO, Stripe billing (plan switching is free in this
  version), the 8 AM notification email, real scraping/enrichment adapters.
- Have a lawyer review scraping (job-board terms of service) and B2B contact processing under GDPR. The
  FAQ copy on the landing page states the intended policy.
