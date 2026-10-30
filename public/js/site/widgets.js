// Interactive pieces of the landing pages. Everything is built with text nodes (no innerHTML),
// animations stop for people who prefer reduced motion, and auto-advancing content can be paused.
import { h } from "../lib/dom.js";
import { CRITERIA, DEMO, HERO_MISSIONS, JOBS, NEVER_SCORED, PROFILES } from "./content.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** French typography: non-breaking spaces in amounts ("2 400 €", "50 %"). */
export const nb = (text) =>
  String(text).replace(/(\d) (\d{3})\b/g, "$1 $2").replace(/ (€|%)/g, " $1");

const formatInt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function onVisible(el, callback) {
  if (!("IntersectionObserver" in window)) return callback();
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      callback();
    }
  }, { threshold: 0.3 });
  observer.observe(el);
}

/**
 * Count a number up/down to `to` (instant when motion is reduced). A new call takes over from the
 * value currently on screen, so dragging a slider never makes the number jump.
 */
function tween(el, to, format, duration = 450) {
  const from = el.shownValue ?? to;
  const run = (el.tweenRun ?? 0) + 1;
  el.tweenRun = run;
  const show = (value) => {
    el.shownValue = value;
    el.textContent = format(value);
  };
  if (reducedMotion || from === to) return show(to);
  const start = performance.now();
  const step = (now) => {
    if (el.tweenRun !== run) return; // A newer tween took over.
    const t = Math.min(1, (now - start) / duration);
    show(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Timer for auto-advancing content. Pauses on hover/focus and via a "Pause" button
 * (WCAG 2.2.2), and never starts when the user prefers reduced motion.
 */
function autoAdvance(root, pauseButton, intervalMs, tick) {
  let timer = null;
  let userPaused = false;
  let hovering = false;

  const running = () => !userPaused && !hovering && !reducedMotion;
  const sync = () => {
    clearInterval(timer);
    timer = running() ? setInterval(tick, intervalMs) : null;
    if (pauseButton) {
      pauseButton.textContent = userPaused ? "Lecture" : "Pause";
      pauseButton.setAttribute("aria-pressed", String(userPaused));
    }
  };

  if (reducedMotion && pauseButton) pauseButton.hidden = true;
  pauseButton?.addEventListener("click", () => {
    userPaused = !userPaused;
    sync();
  });
  root.addEventListener("pointerenter", () => { hovering = true; sync(); });
  root.addEventListener("pointerleave", () => { hovering = false; sync(); });
  root.addEventListener("focusin", () => { hovering = true; sync(); });
  root.addEventListener("focusout", () => { hovering = false; sync(); });
  sync();

  return {
    stop() {
      userPaused = true;
      sync();
    },
  };
}

// ---- Hero (freelance): an example mission arrives every ~6 s -------------------------------------

export function initExample(root) {
  const body = root.querySelector("[data-example-body]");
  let index = 0;

  const render = (mission) => {
    const ring = h("span", { class: "ring", "aria-label": `Score ${mission.score} sur 100` }, String(mission.score));
    ring.style.setProperty("--value", String(mission.score));
    body.replaceChildren(
      ring,
      h("div", {},
        h("p", { class: "example-title" }, mission.title),
        h("p", { class: "example-meta" }, nb(mission.meta)),
        h("p", { class: "example-dm" },
          h("span", { class: "tag tag-mint" }, mission.discipline),
          h("span", { class: "tag" }, mission.source),
          h("span", {}, `Décideur : ${mission.dm} · e-mail vérifié`))
      )
    );
  };

  render(HERO_MISSIONS[0]);
  autoAdvance(root, root.querySelector("[data-pause]"), 6000, () => {
    index = (index + 1) % HERO_MISSIONS.length;
    body.dataset.leaving = "true";
    setTimeout(() => {
      render(HERO_MISSIONS[index]);
      delete body.dataset.leaving;
    }, 350);
  });
}

// ---- Métiers: tabs that move on their own every 4 s until the visitor picks one ----------------------

export function initJobs(root) {
  const tabs = root.querySelector("[data-job-tabs]");
  const list = root.querySelector("[data-job-list]");
  let current = 0;

  const buttons = JOBS.map((job, i) =>
    h("button", {
      type: "button",
      role: "tab",
      id: `job-tab-${job.id}`,
      "aria-controls": "job-panel",
      onClick: () => {
        rotation.stop();
        select(i);
      },
      onKeydown: (event) => {
        const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!move) return;
        event.preventDefault();
        rotation.stop();
        select((i + move + JOBS.length) % JOBS.length, { focus: true });
      },
    }, job.label)
  );
  tabs.replaceChildren(...buttons);

  function select(i, { focus = false } = {}) {
    current = i;
    buttons.forEach((button, j) => {
      button.setAttribute("aria-selected", String(j === i));
      button.tabIndex = j === i ? 0 : -1;
    });
    if (focus) buttons[i].focus();
    // Keep the active chip in view without scrolling the page vertically.
    tabs.scrollTo({ left: buttons[i].offsetLeft - 14, behavior: reducedMotion ? "auto" : "smooth" });
    list.setAttribute("aria-labelledby", buttons[i].id);
    list.replaceChildren(
      ...JOBS[i].missions.map((m) =>
        h("li", {},
          h("div", {}, h("p", { class: "job-title" }, m.title), h("p", { class: "job-meta" }, m.where)),
          h("span", { class: m.source === "Offre CDI" ? "tag" : "tag tag-mint" }, m.source),
          h("span", { class: "job-price" }, nb(m.price))
        )
      )
    );
  }

  select(0);
  const rotation = autoAdvance(root, root.querySelector("[data-pause]"), 4000, () => select((current + 1) % JOBS.length));
}

// ---- Score: same score on both sides, with the detail of every criterion ---------------------------

export function initScore(root, audience) {
  let profile = PROFILES[0];
  let criterionId = CRITERIA[0].id;
  let revealed = reducedMotion;

  const total = (p) => Math.round(CRITERIA.reduce((sum, c) => sum + (c.weight * p.values[c.id]) / 100, 0));

  const switchButtons = PROFILES.map((p) =>
    h("button", { type: "button", "aria-pressed": "false", onClick: () => { profile = p; update(); } }, p.switchLabel)
  );
  const who = h("p", { class: "score-who" });
  const totalValue = h("strong", {});
  const criteriaButtons = new Map();
  const detail = h("div", { class: "panel", id: "score-detail", "aria-live": "polite" });

  const criteriaList = h("ul", { class: "criteria" },
    CRITERIA.map((c) => {
      const value = h("b", {});
      const fill = h("span", {});
      const button = h("button", {
        class: "criterion",
        type: "button",
        "aria-pressed": "false",
        "aria-controls": "score-detail",
        onClick: () => { criterionId = c.id; update(); },
      },
        h("span", { class: "criterion-row" }, c.label, h("small", {}, nb(`· ${c.weight} %`)), value),
        h("span", { class: "bar", "aria-hidden": "true" }, fill));
      criteriaButtons.set(c.id, { button, value, fill });
      return h("li", {}, button);
    })
  );

  root.replaceChildren(
    h("div", { class: "score-switch", role: "group", "aria-label": "Exemple de profil" }, switchButtons),
    h("div", { class: "score-grid" },
      h("div", { class: "panel" },
        who,
        h("p", { class: "score-total" }, totalValue, h("span", {}, "/100")),
        h("p", { class: "score-hint" }, "Cliquez sur un critère pour voir le détail"),
        criteriaList),
      h("div", {},
        detail,
        h("div", { class: "panel" },
          h("h3", {}, "Ce qu’on ne note jamais"),
          h("ul", { class: "never-list" }, NEVER_SCORED.map((item) => h("li", {}, item))),
          h("p", { class: "panel-text" },
            "La décision reste toujours humaine. Un score vous semble faux ? Contestez-le en un clic, on le revoit à la main.")))
    )
  );

  function update() {
    switchButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(PROFILES[i] === profile)));
    who.textContent = profile.who;
    tween(totalValue, revealed ? total(profile) : 0, String, 700);

    for (const c of CRITERIA) {
      const { button, value, fill } = criteriaButtons.get(c.id);
      button.setAttribute("aria-pressed", String(c.id === criterionId));
      value.textContent = String(profile.values[c.id]);
      fill.style.setProperty("width", `${revealed ? profile.values[c.id] : 0}%`);
    }

    const c = CRITERIA.find((x) => x.id === criterionId);
    detail.replaceChildren(
      h("p", { class: "detail-title" }, c.label, h("span", { class: "pill" }, nb(`Poids ${c.weight} %`))),
      h("div", { class: "detail-block" }, h("h4", {}, "Ce qu’on mesure"), h("p", {}, c.measure)),
      h("div", { class: "detail-block" }, h("h4", {}, "D’où viennent les données"), h("p", {}, c.data)),
      audience === "freelance"
        ? h("div", { class: "detail-block detail-tip" }, h("h4", {}, "Pour le faire monter"), h("p", {}, profile.tips[c.id]))
        : null
    );
  }

  update();
  onVisible(root, () => {
    revealed = true;
    update();
  });
}

// ---- Calculator: drag the sliders, the result moves with them ----------------------------------------

export function initCalc(form) {
  const inputs = { rate: form.elements.rate, hours: form.elements.hours, share: form.elements.share };
  const outputs = Object.fromEntries([...form.querySelectorAll("[data-out]")].map((o) => [o.dataset.out, o]));
  const money = form.querySelector('[data-result="money"]');
  const time = form.querySelector('[data-result="time"]');
  const formula = form.querySelector('[data-result="formula"]');
  const WEEKS_PER_MONTH = 4.33;

  // Clamp to the slider's own bounds: values come from the DOM and could be tampered with.
  const read = (input) => {
    const value = Number(input.value);
    const min = Number(input.min);
    const max = Number(input.max);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  };

  function update() {
    const rate = read(inputs.rate);
    const hours = read(inputs.hours);
    const share = read(inputs.share);

    outputs.rate.textContent = nb(`${rate} €`);
    outputs.hours.textContent = `${hours} h`;
    outputs.share.textContent = nb(`${share} %`);
    for (const input of Object.values(inputs)) {
      const fill = ((read(input) - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty("--fill", `${fill}%`);
      input.setAttribute("aria-valuetext", input === inputs.rate ? `${rate} euros` : input === inputs.hours ? `${hours} heures` : `${share} pour cent`);
    }

    tween(money, Math.round(rate * hours * (share / 100) * WEEKS_PER_MONTH), (v) => `${formatInt.format(v)} €`);
    tween(time, Math.round(hours * (share / 100) * WEEKS_PER_MONTH), (v) => `${v} h`);
    formula.textContent = nb(`${rate} € × ${hours} h × ${share} % × 4,33 semaines. Estimation indicative.`);
  }

  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => event.preventDefault());
  update();
}

// ---- Company hero demo: the offer link types itself, then 5 freelances appear ----------------------

export function initDemo(root) {
  const url = root.querySelector("[data-demo-url]");
  const progress = root.querySelector("[data-demo-progress]");
  const tags = root.querySelector("[data-demo-tags]");
  const list = root.querySelector("[data-demo-list]");
  const status = root.querySelector("[data-demo-status]");
  let run = 0;

  const wait = (ms, id) => new Promise((resolve, reject) => setTimeout(() => (id === run ? resolve() : reject()), ms));
  const row = (person) =>
    h("li", {},
      h("span", { class: "avatar", "aria-hidden": "true" }, person.initials),
      h("span", {}, person.name, h("small", {}, nb(person.detail))),
      h("b", {}, String(person.score)));

  const showTags = () =>
    tags.replaceChildren(...DEMO.tags.map((t, i) => h("span", { class: i === 0 ? "tag tag-mint" : "tag" }, nb(t))));

  function finalState() {
    url.textContent = DEMO.url;
    progress.style.setProperty("width", "100%");
    showTags();
    list.replaceChildren(...DEMO.shortlist.map(row));
    status.textContent = "Shortlist prête · 5 freelances";
  }

  async function play() {
    const id = ++run;
    url.textContent = "";
    tags.replaceChildren();
    list.replaceChildren();
    progress.style.setProperty("width", "0%");
    status.textContent = "Lien de votre offre d’emploi…";
    if (reducedMotion) return finalState();
    try {
      for (let i = 1; i <= DEMO.url.length; i++) {
        url.textContent = DEMO.url.slice(0, i);
        await wait(28, id);
      }
      status.textContent = "Analyse de l’offre…";
      progress.style.setProperty("width", "100%");
      await wait(1300, id);
      showTags();
      status.textContent = "Mission extraite de votre offre en CDI";
      await wait(700, id);
      for (const person of DEMO.shortlist) {
        list.append(row(person));
        await wait(260, id);
      }
      status.textContent = "Shortlist prête · 5 freelances";
    } catch {
      // A newer run (replay) took over.
    }
  }

  root.querySelector("[data-demo-replay]").addEventListener("click", play);
  onVisible(root, play);
}

// ---- Company "délai" bars fill to scale --------------------------------------------------------------

export function initDelay(root) {
  const bars = [...root.querySelectorAll("[data-width]")];
  const fill = () => bars.forEach((bar) => bar.style.setProperty("width", `${Number(bar.dataset.width)}%`));
  if (reducedMotion) fill();
  else onVisible(root, fill);
}
