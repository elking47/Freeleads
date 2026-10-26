// Follow-ups: reminders at D+3 and D+7 after first contact when there is no reply yet.
import { api } from "../../lib/api.js";
import { formatDate, h, icon, relativeDays, replace } from "../../lib/dom.js";
import { emptyState, pageHead, toast } from "../components.js";
import { openLead } from "../lead-drawer.js";
import { countsChanged } from "../state.js";

export async function render() {
  const container = h("div");

  async function load() {
    const { items } = await api("/leads/followups");
    if (!items.length) {
      container.replaceChildren(
        emptyState("No follow-ups due", "When you mark a lead as contacted, reminders appear here at D+3 and D+7.",
          h("a", { class: "btn", href: "#/today" }, "Go to today's Freeleads")));
      return;
    }

    const row = (item) => {
      const { lead } = item;
      const dm = lead.decisionMaker;
      return h("li", { class: "followup-row" },
        h("p", { class: "due", dataset: { overdue: String(item.overdue) } }, `D+${item.days}`, h("br"), relativeDays(item.dueAt)),
        h("div", {},
          h("p", { class: "lead-title" },
            h("button", { type: "button", onClick: () => openLead(lead.id, { onChange: load }) }, lead.listing.title)),
          h("p", { class: "lead-meta" },
            `${lead.company.name}${dm ? ` · ${dm.firstName} ${dm.lastName}, ${dm.role}` : ""} · contacted ${formatDate(lead.contactedAt)}`)),
        h("div", { class: "button-row" },
          h("button", { class: "btn btn-sm", type: "button", onClick: () => openLead(lead.id, { onChange: load }) }, icon("mail"), "Write follow-up"),
          h("button", {
            class: "btn btn-sm btn-primary",
            type: "button",
            onClick: async () => {
              await api(`/leads/${lead.id}/followups`, { method: "POST", body: { step: item.step } });
              toast(`Follow-up ${item.step} marked as done.`);
              countsChanged();
              load();
            },
          }, icon("check"), "Done"))
      );
    };

    const overdue = items.filter((i) => i.overdue);
    const upcoming = items.filter((i) => !i.overdue);
    replace(container,
      overdue.length ? h("h2", { class: "section-title" }, "Due now", h("span", { class: "badge badge-amber" }, String(overdue.length))) : null,
      overdue.length ? h("ul", { class: "card lead-list" }, overdue.map(row)) : null,
      upcoming.length ? h("h2", { class: "section-title" }, "Coming up", h("span", { class: "badge" }, String(upcoming.length))) : null,
      upcoming.length ? h("ul", { class: "card lead-list" }, upcoming.map(row)) : null
    );
  }

  await load();
  return h("div", {}, pageHead("Follow-ups", "Leads you contacted that haven't replied yet."), container);
}
