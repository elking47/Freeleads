// All leads: search and filters over every Freeleads ever delivered.
import { DISCIPLINES, LEAD_STATUSES } from "/shared/constants.js";
import { schemas, validate } from "/shared/validation.js";
import { api } from "../../lib/api.js";
import { h, icon } from "../../lib/dom.js";
import { emptyState, leadCard, pageHead } from "../components.js";
import { openLead } from "../lead-drawer.js";

const SCORE_OPTIONS = [
  { value: "", label: "Any fit score" },
  { value: "60", label: "Fit 60+" },
  { value: "80", label: "Fit 80+" },
  { value: "90", label: "Fit 90+" },
];

function select(name, label, options, value) {
  return h("select", { class: "select", name, "aria-label": label },
    options.map((o) => h("option", { value: o.value, selected: o.value === (value ?? "") }, o.label)));
}

export async function render(params) {
  // Hash params are user-controlled: keep only values the shared schema accepts.
  const initial = validate(schemas.leadQuery, params, { partial: true });
  const filters = { sort: "newest", page: 1, ...(initial.ok ? initial.data : {}) };

  const results = h("div", { "aria-live": "polite" });
  const search = h("input", { class: "input", type: "search", name: "q", placeholder: "Search title, company or listing", maxlength: "80", value: filters.q ?? "", "aria-label": "Search leads" });

  const form = h("form", { class: "filters", role: "search", onSubmit: (e) => e.preventDefault() },
    h("div", { class: "search-input" }, icon("search"), search),
    select("discipline", "Discipline", [{ value: "", label: "All disciplines" }, ...DISCIPLINES.map((d) => ({ value: d.id, label: d.label }))], filters.discipline),
    select("status", "Status", [{ value: "", label: "Any status" }, ...LEAD_STATUSES.map((s) => ({ value: s.id, label: s.label }))], filters.status),
    select("minScore", "Fit score", SCORE_OPTIONS, filters.minScore !== undefined ? String(filters.minScore) : ""),
    select("sort", "Sort by", [{ value: "newest", label: "Newest first" }, { value: "score", label: "Best fit first" }, { value: "urgency", label: "Most urgent first" }], filters.sort)
  );

  async function load() {
    const raw = { ...Object.fromEntries(new FormData(form)), page: filters.page };
    const { ok, data, errors } = validate(schemas.leadQuery, raw, { partial: true });
    if (!ok) {
      results.replaceChildren(h("p", { class: "field-error" }, Object.values(errors)[0]));
      return;
    }
    const response = await api("/leads", { query: data });
    const pages = Math.max(1, Math.ceil(response.total / response.pageSize));
    results.replaceChildren(
      response.leads.length
        ? h("ul", { class: "lead-list" }, response.leads.map((lead) => leadCard(lead, { onOpen: (id) => openLead(id, { onChange: load }) })))
        : emptyState("No leads match these filters", "Try removing a filter or searching for something else."),
      pages > 1
        ? h("nav", { class: "pager", "aria-label": "Pagination" },
            h("button", { class: "btn btn-sm", type: "button", disabled: filters.page <= 1, onClick: () => go(filters.page - 1) }, "Previous"),
            h("span", {}, `Page ${filters.page} of ${pages} · ${response.total} leads`),
            h("button", { class: "btn btn-sm", type: "button", disabled: filters.page >= pages, onClick: () => go(filters.page + 1) }, "Next"))
        : h("p", { class: "pager" }, `${response.total} lead${response.total === 1 ? "" : "s"}`)
    );
  }

  const go = (page) => {
    filters.page = page;
    load();
  };

  let debounce;
  form.addEventListener("input", (event) => {
    filters.page = 1;
    clearTimeout(debounce);
    debounce = setTimeout(load, event.target === search ? 300 : 0);
  });

  await load();
  return h("div", {}, pageHead("All leads", "Every Freeleads delivered to you, searchable."), form, results);
}
