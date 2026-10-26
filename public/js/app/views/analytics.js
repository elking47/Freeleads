// Analytics: contact, reply and close rates, revenue won, 14-day activity and results by discipline.
import { api } from "../../lib/api.js";
import { formatDate, formatMoney, h } from "../../lib/dom.js";
import { disciplineLabel, pageHead } from "../components.js";

const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

export async function render() {
  const data = await api("/analytics");
  const { totals, rates, days, byDiscipline } = data;
  const max = Math.max(1, ...days.map((d) => Math.max(d.delivered, d.contacted)));

  const kpi = (label, value) =>
    h("div", { class: "card kpi" }, h("p", { class: "kpi-label" }, label), h("p", { class: "kpi-value" }, value));

  return h("div", {},
    pageHead("Analytics", "Where your missions come from, so you can sharpen your strategy."),

    h("div", { class: "kpis" },
      kpi("Freeleads delivered", totals.delivered.toLocaleString("en")),
      kpi("Contacted", `${totals.contacted} · ${rates.contact}%`),
      kpi("Reply rate", `${rates.reply}%`),
      kpi("Close rate", `${rates.close}%`),
      kpi("Revenue won", formatMoney(totals.revenue))
    ),

    h("section", { class: "card card-pad section-gap", "aria-labelledby": "activity-title" },
      h("div", { class: "page-head" },
        h("div", {}, h("h2", { class: "card-title", id: "activity-title" }, "Last 14 days"),
          h("p", { class: "card-sub" }, "Freeleads delivered vs. leads you contacted, per day.")),
        h("p", { class: "legend", "aria-hidden": "true" }, h("span", {}, "Delivered"), h("span", {}, "Contacted"))),
      h("div", { class: "chart", role: "img", "aria-label": `Bar chart of the last 14 days: ${days.reduce((s, d) => s + d.delivered, 0)} delivered, ${days.reduce((s, d) => s + d.contacted, 0)} contacted.` },
        days.map((d) =>
          h("div", { class: "chart-col", title: `${formatDate(d.day)}: ${d.delivered} delivered, ${d.contacted} contacted` },
            h("span", { class: "bar", vars: { h: `${(d.delivered / max) * 100}%` } }),
            h("span", { class: "bar bar-contacted", vars: { h: `${(d.contacted / max) * 100}%` } })))),
      h("div", { class: "chart-labels", "aria-hidden": "true" }, days.map((d, i) => h("span", {}, i % 2 === 0 ? formatDate(d.day) : "")))
    ),

    h("section", { class: "card section-gap", "aria-labelledby": "discipline-title" },
      h("div", { class: "card-pad" }, h("h2", { class: "card-title", id: "discipline-title" }, "By discipline")),
      byDiscipline.length
        ? h("div", { class: "table-scroll" },
            h("table", { class: "table" },
              h("thead", {}, h("tr", {},
                h("th", { scope: "col" }, "Discipline"),
                h("th", { scope: "col", class: "num" }, "Delivered"),
                h("th", { scope: "col", class: "num" }, "Contacted"),
                h("th", { scope: "col", class: "num" }, "Replied"),
                h("th", { scope: "col", class: "num" }, "Won"),
                h("th", { scope: "col", class: "num" }, "Reply rate"))),
              h("tbody", {}, byDiscipline.map((row) =>
                h("tr", {},
                  h("th", { scope: "row" }, disciplineLabel(row.discipline)),
                  h("td", { class: "num" }, String(row.delivered)),
                  h("td", { class: "num" }, String(row.contacted)),
                  h("td", { class: "num" }, String(row.replied)),
                  h("td", { class: "num" }, String(row.won)),
                  h("td", { class: "num" }, percent(row.replied, row.contacted)))))))
        : h("p", { class: "card-pad muted" }, "No data yet.")
    ),

    h("p", { class: "muted section-gap" },
      `Feedback given: ${totals.ratedUp} 👍 and ${totals.ratedDown} 👎. Ratings are saved as training feedback for the qualification model.`)
  );
}
