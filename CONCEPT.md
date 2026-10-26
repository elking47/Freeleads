# Freeleads: website concept

Freeleads is prospecting automation for freelancers. Every morning at 8 AM it delivers qualified freelance
opportunities, each with the decision-maker's contact details, into a lightweight CRM.
This document explains how the site is structured and where each idea came from.

---

## 1. What we reverse-engineered from Collective.work

Collective's three URLs (`/`, `/recruiter`, `/talent`) are all behind a login wall
(`/auth/login?redirect=/talent`). REA's headless capture was stopped by a Cloudflare bot check. The public,
shipped JavaScript bundle (`main.64a95f9f00905b50.js`, 8.9 MB, React + Chakra UI) was analyzed statically
instead. Its route table, feature flags and embedded EN/FR/ES dictionaries show how the product is organized.

| What we observed in the bundle | What it tells us |
|---|---|
| One account, **two spaces** in a single sidebar menu: *Talent space* and *Recruiter space* | One app shell, with a role or plan switch that changes the navigation |
| Talent sidebar: **Find a job** (Home, All jobs, Job alerts, Watson), **Connect** (MegaSearch, My network, Messages), opportunity pipeline (New, Submitted, Hired, Archived) | The sidebar is grouped by intent ("find", "connect", "track") rather than by data type |
| Onboarding checklist "Set up your profile": import profile, set availability, choose expertises, phone, CV, each with "{{count}} min" | A short, timed checklist on the home screen helps users reach their first useful moment |
| **Watson**, the AI job scout: "Scanning 40M+ jobs → Shortlisting the closest matches → Grading each one", "graded picks, explained", feedback ("Watson learns from these") | AI results are shown with **visible pipeline steps**, a **score with reasons**, and a **feedback loop** |
| **Sherlock** (recruiter AI search): *Matches* vs *Near matches*, "AI evaluation: 87%", "Most often missed" criteria | Results are split into confidence tiers, with a percentage score and plain-language reasons |
| Job board filters: contract type, daily rate, location, company size, funding stage, industry, skills, "Only startups", "Only with a clear price" | Filters are tailored to freelancers |
| Recruiter: **Sequences**, **Templates** picker ("↑ ↓ to browse · Enter to use"), Lists, Analytics report, Plan & Billing (Basic / Start / Pro, seats) | Outreach automation and templates are core features; team plans are sold by seats |
| Engine feature flags: `scrap-jobs`, `ingest-external-jobs`, `linkedin-scraping`, `disable-fullenrich-enrichment`, `enable-pronto-enrichment`, `mix-enrichment-providers`, `sequence-sending`, `api-rate-limiting`, `shortlist-ai-evaluation-job` | Collective runs a scrape → AI-evaluate → enrich → outreach engine. This is the same 4-stage engine in the Freeleads plan, with **interchangeable enrichment providers** behind flags |
| Login: split screen (form on the left, brand-color panel on the right), Google / LinkedIn / Microsoft SSO plus email | Auth layout to reuse |

Evidence: REA scenario `ev_1cc118d9…` (Cloudflare page), REA bundle analysis `ev_6a95…` / `ev_d30b…`
(sources captured; `main.js` exceeded REA's capture budget), and REA static app analysis `ev_b9e2…`
(partial: `main.js` timed out after 300 s). The route table, flags and copy above come from targeted static
string and JSON extraction on that same bundle. No JavaScript was executed. The screens behind the login
were **not** observed, so layout details beyond the login page are inferred from routes and copy.

## 2. How the concept maps to Freeleads

Collective serves two sides (talent and recruiters). Freeleads serves **one side: the freelancer**.
We keep the patterns that help a freelancer prospect and drop the marketplace parts.

| Collective pattern | Freeleads version |
|---|---|
| Watson, the "job scout" with visible scan steps | **The 8 AM delivery**: a nightly timeline (Scrape 10 PM → AI filter 3 AM → Enrich 5 AM → Delivered 8 AM) with counts at each stage |
| Graded picks + reasons + feedback | Each Freeleads card has a **freelance-fit score**, an **urgency** level, an **"Why it's a freelance need"** reason list and 👍/👎 rating (the plan's mitigation for AI qualification risk) |
| Matches / Near matches | **Strong fits** / **Worth a look** sections in the daily feed |
| Opportunity pipeline (New / Submitted / Hired / Archived) | **Kanban CRM**: New → Contacted → Replied → Won (+ Lost) |
| Templates picker, Sequences | **Contact templates** per discipline and channel (email, LinkedIn InMail, call script) plus **automatic follow-ups at D+3 / D+7** |
| Analytics report | **Personal analytics**: contacted, reply rate, close rate, revenue won |
| Onboarding checklist with minutes | "Get your first Freeleads" checklist: pick disciplines, set daily rate, reveal a contact, send a first message |
| Plan & Billing (Basic / Start / Pro, seats) | **Solo €29 / Pro €59 / Team €149**, 14-day Pro trial with no card; Team = 5 seats + API |
| Swappable enrichment providers behind flags | Enrichment through **Dropcontact / Kaspr / Hunter adapters**, selected by environment variables, with a demo provider when no key is set |
| Split-screen login | Same layout, Freeleads indigo panel |

## 3. Sitemap

**Public site**
- `/`: landing page: hero ("Your next client, delivered at 8 AM"), problem (30% of the week lost, ~€40k/yr),
  the nightly 4-stage engine, CRM features, 8 disciplines, Léa's story, comparison (marketplaces / CRMs /
  Sales Nav), pricing, FAQ
- `/signup`, `/login`

**App** (`/app`, single page, sidebar grouped like Collective's)
- *Prospect*: **Today** (8 AM feed + delivery timeline + onboarding), **All leads** (filters), **Pipeline** (kanban)
- *Outreach*: **Templates**, **Follow-ups** (D+3 / D+7 due list)
- *Insights*: **Analytics**
- *Account*: **Settings** (disciplines, rate, plan, password, delete account)

## 4. Security baseline (OWASP)

| Requirement | Implementation |
|---|---|
| Sanitize all user input | Shared sanitizer strips control characters, normalizes Unicode and trims. Strict whitelists of allowed fields (unknown fields are rejected). The UI renders only through `textContent`, never `innerHTML` with data. Strict CSP with no inline scripts |
| Rate limiting on **every** API endpoint | Global `/api` limiter + stricter limiters on auth (per IP and per email) and on contact reveals |
| No hard-coded API keys | All secrets come from environment variables (`.env`, git-ignored; `.env.example` documents them). The server refuses to start in production without `SESSION_SECRET` |
| Parameterized queries | Every SQL statement is a prepared statement with bound parameters (`node:sqlite`). No string-built SQL |
| Validate on frontend **and** backend | One validation module (`shared/validation.js`) is imported by the browser forms and by the API, so the rules are identical on both sides. The server always re-validates |
| Also covered | scrypt password hashing, session rotation on login, HttpOnly/SameSite=Strict cookies, CSRF tokens, ownership checks on every lead (no IDOR), body-size limits, Helmet headers/HSTS, generic auth errors, no stack traces in responses |
