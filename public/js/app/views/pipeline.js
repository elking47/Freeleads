// Pipeline: kanban New → Contacted → Replied → Won / Lost. Drag cards, or use each card's status menu.
import { LEAD_STATUSES } from "/shared/constants.js";
import { api } from "../../lib/api.js";
import { formatDate, h } from "../../lib/dom.js";
import { disciplineLabel, pageHead, statusLabel, statusSelect, toast } from "../components.js";
import { openLead } from "../lead-drawer.js";
import { countsChanged } from "../state.js";

export async function render() {
  const board = h("div", { class: "board" });
  const columns = new Map();

  async function move(lead, status) {
    if (lead.status === status) return;
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: { status } });
      toast(`Moved to ${statusLabel(status)}.`);
      countsChanged();
      await load();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function card(lead) {
    const el = h("li", { class: "mini-card", draggable: "true" },
      h("button", { class: "mini-card-title", type: "button", onClick: () => openLead(lead.id, { onChange: load }) }, lead.listing.title),
      h("p", { class: "mini-card-meta" },
        h("span", {}, lead.company.name),
        h("span", { class: "badge" }, `${lead.listing.fitScore} fit`)),
      h("p", { class: "mini-card-meta" },
        h("span", {}, disciplineLabel(lead.listing.discipline)),
        h("span", {}, formatDate(lead.deliveredOn))),
      statusSelect(lead.status, (status) => move(lead, status), { label: `Status of ${lead.listing.title}` })
    );
    el.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", String(lead.id));
      event.dataTransfer.effectAllowed = "move";
      el.dataset.dragging = "true";
    });
    el.addEventListener("dragend", () => delete el.dataset.dragging);
    el._lead = lead;
    return el;
  }

  function column(status) {
    const list = h("ul", { class: "lead-list" });
    const count = h("span", { class: "badge" });
    const more = h("p", { class: "column-more" });
    const col = h("section", { class: "column", dataset: { status: status.id }, "aria-label": status.label },
      h("h2", { class: "column-head" }, status.label, count), list, more);

    col.addEventListener("dragover", (event) => {
      event.preventDefault();
      col.dataset.drop = "true";
    });
    col.addEventListener("dragleave", () => delete col.dataset.drop);
    col.addEventListener("drop", (event) => {
      event.preventDefault();
      delete col.dataset.drop;
      const id = Number(event.dataTransfer.getData("text/plain"));
      const dragged = board.querySelector(`[data-dragging="true"]`);
      if (dragged?._lead?.id === id) move(dragged._lead, status.id);
    });
    columns.set(status.id, { list, count, more });
    return col;
  }

  async function load() {
    const results = await Promise.all(
      LEAD_STATUSES.map((s) => api("/leads", { query: { status: s.id, sort: s.id === "new" ? "score" : "newest" } }))
    );
    LEAD_STATUSES.forEach((status, index) => {
      const { leads, total } = results[index];
      const { list, count, more } = columns.get(status.id);
      count.textContent = String(total);
      list.replaceChildren(...leads.map(card));
      more.replaceChildren(
        total > leads.length ? h("a", { href: `#/leads?status=${status.id}` }, `+${total - leads.length} more`) : ""
      );
    });
  }

  board.append(...LEAD_STATUSES.map(column));
  await load();
  return h("div", {},
    pageHead("Pipeline", "Drag a card to another column, or change its status from the card."),
    board);
}
