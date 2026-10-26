// Reusable UI pieces for the app views.
import { DISCIPLINES, LEAD_STATUSES, labelOf } from "/shared/constants.js";
import { api } from "../lib/api.js";
import { h, icon, initials } from "../lib/dom.js";

export const disciplineLabel = (id) => labelOf(DISCIPLINES, id);
export const statusLabel = (id) => labelOf(LEAD_STATUSES, id);

export function toast(message, kind = "info") {
  const region = document.querySelector("[data-toasts]");
  const el = h("div", { class: "toast", dataset: { kind } }, message);
  region.append(el);
  setTimeout(() => el.remove(), 3800);
}

export function pageHead(title, sub, ...actions) {
  return h("header", { class: "page-head" },
    h("div", {}, h("h1", {}, title), sub ? h("p", { class: "page-sub" }, sub) : null),
    actions.length ? h("div", { class: "page-actions" }, actions) : null
  );
}

export function emptyState(title, text, action) {
  return h("div", { class: "empty" }, h("h2", {}, title), h("p", {}, text), action ?? null);
}

export function scoreEl(score) {
  return h("span", { class: "score", dataset: { tier: score >= 80 ? "high" : "mid" }, title: `Freelance fit score: ${score}/100` },
    String(score), h("small", {}, "fit"));
}

export function urgencyBadge(urgency) {
  if (urgency === "high") return h("span", { class: "badge badge-amber badge-dot" }, "Starts ASAP");
  if (urgency === "medium") return h("span", { class: "badge badge-sky badge-dot" }, "Starts soon");
  return null;
}

export function statusBadge(status) {
  const tone = { new: "badge-primary", contacted: "badge-sky", replied: "badge-amber", won: "badge-green", lost: "" }[status];
  return h("span", { class: `badge ${tone}` }, statusLabel(status));
}

export function statusSelect(value, onChange, { label = "Status", id } = {}) {
  return h("select", { class: "select", id, "aria-label": id ? null : label, onChange: (e) => onChange(e.target.value) },
    LEAD_STATUSES.map((s) => h("option", { value: s.id, selected: s.id === value }, s.label))
  );
}

/** 👍 / 👎 feedback that trains the qualification model (business plan: risk mitigation). */
export function rateButtons(lead, onUpdated) {
  const make = (value, name, text) =>
    h("button", {
      class: "btn btn-sm btn-icon",
      type: "button",
      "aria-pressed": String(lead.rating === value),
      title: text,
      onClick: async () => {
        const rating = lead.rating === value ? null : value;
        const { lead: updated } = await api(`/leads/${lead.id}`, { method: "PATCH", body: { rating } });
        onUpdated?.(updated);
        toast(rating ? "Thanks, your feedback is saved." : "Rating removed.");
      },
    }, icon(name, { label: text }));
  return h("div", { class: "rate-buttons" }, make("up", "thumbUp", "Good lead"), make("down", "thumbDown", "Not relevant"));
}

export function leadCard(lead, { onOpen, onUpdated }) {
  const dm = lead.decisionMaker;
  const card = h("li", { class: "lead-card" });
  const render = (current) => {
    card.replaceChildren(
      scoreEl(current.listing.fitScore),
      h("div", {},
        h("div", { class: "lead-tags" },
          h("span", { class: "badge badge-primary" }, disciplineLabel(current.listing.discipline)),
          urgencyBadge(current.listing.urgency),
          current.status !== "new" ? statusBadge(current.status) : null
        ),
        h("h3", { class: "lead-title" }, h("button", { type: "button", onClick: () => onOpen(current.id) }, current.listing.title)),
        h("p", { class: "lead-meta" }, `${current.company.name} · ${current.listing.location} · ${current.company.size} employees · via ${current.listing.sourceLabel}`),
        current.listing.reasons.length
          ? h("ul", { class: "lead-reasons" }, current.listing.reasons.slice(0, 3).map((r) => h("li", {}, r)))
          : null,
        dm
          ? h("p", { class: "lead-dm" },
              h("span", { class: "avatar", "aria-hidden": "true" }, initials(dm.firstName, dm.lastName)),
              h("span", {}, h("strong", {}, `${dm.firstName} ${dm.lastName}`), ` · ${dm.role}`))
          : null
      ),
      h("div", { class: "lead-side" },
        h("button", { class: "btn btn-primary btn-sm", type: "button", onClick: () => onOpen(current.id) }, "Contact"),
        rateButtons(current, (updated) => {
          render(updated);
          onUpdated?.(updated);
        })
      )
    );
  };
  render(lead);
  return card;
}

export function fillTemplate(text, lead, user) {
  const values = {
    firstName: lead.decisionMaker?.firstName ?? "there",
    company: lead.company.name,
    role: lead.decisionMaker?.role ?? "",
    jobTitle: lead.listing.title,
    myName: user.name,
    dailyRate: user.dailyRate ? `€${user.dailyRate}/day` : "my usual daily rate",
  };
  return (text ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in values ? values[key] : match));
}
