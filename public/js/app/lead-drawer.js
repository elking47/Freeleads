// Lead detail drawer: why it's a freelance need, decision-maker contacts, outreach composer, status.
import { CHANNELS } from "/shared/constants.js";
import { schemas, validate } from "/shared/validation.js";
import { api } from "../lib/api.js";
import { formatDate, formatMoney, h, icon, initials, relativeDays, replace, safeUrl } from "../lib/dom.js";
import { disciplineLabel, fillTemplate, rateButtons, scoreEl, statusLabel, statusSelect, toast, urgencyBadge } from "./components.js";
import { countsChanged, loadTemplates, state } from "./state.js";

let dialog;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = h("dialog", { class: "drawer", "aria-labelledby": "drawer-title" });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // Click on the backdrop.
  });
  document.body.append(dialog);
  return dialog;
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied.`);
  } catch {
    toast("Copy failed. Select the text and copy it manually.", "error");
  }
}

function contactRow(iconName, value, { href, copyLabel }) {
  return h("li", {},
    icon(iconName),
    href
      ? h("a", { class: "contact-value", href, target: "_blank", rel: "noopener noreferrer" }, value)
      : h("span", { class: "contact-value" }, value),
    copyLabel ? h("button", { class: "btn btn-sm btn-ghost", type: "button", onClick: () => copy(value, copyLabel) }, icon("copy"), "Copy") : null
  );
}

const ACTIVITY_TEXT = {
  status: (d) => `Moved to ${statusLabel(d)}`,
  rating: (d) => (d === "up" ? "Rated as a good lead" : "Rated as not relevant"),
  note: () => "Notes updated",
  followup: (d) => `Follow-up ${d} done`,
};

export async function openLead(id, { onChange } = {}) {
  const el = ensureDialog();
  el.replaceChildren(h("div", { class: "drawer-body" }, h("p", { class: "muted" }, "Loading…")));
  if (!el.open) el.showModal();

  let lead;
  let activities;
  try {
    ({ lead, activities } = await api(`/leads/${id}`));
  } catch (error) {
    el.replaceChildren(h("div", { class: "drawer-body" }, h("p", {}, error.message)));
    return;
  }
  const templates = await loadTemplates();
  const user = state.user;

  async function changed(updated) {
    onChange?.(updated);
    countsChanged();
    ({ lead, activities } = await api(`/leads/${updated.id}`));
    render();
  }

  async function update(body, message) {
    try {
      const { lead: updated } = await api(`/leads/${lead.id}`, { method: "PATCH", body });
      if (message) toast(message);
      await changed(updated);
    } catch (error) {
      toast(error.fields ? Object.values(error.fields)[0] : error.message, "error");
    }
  }

  function composer() {
    const relevant = templates.filter((t) => !t.discipline || t.discipline === lead.listing.discipline);
    const preview = h("div", { class: "preview", "aria-live": "polite" });
    const actions = h("div", { class: "button-row" });
    const select = h("select", { class: "select", id: "template-picker", onChange: () => show() },
      CHANNELS.map((channel) =>
        h("optgroup", { label: channel.label },
          relevant.filter((t) => t.channel === channel.id).map((t) => h("option", { value: String(t.id) }, t.name)))
      )
    );

    function show() {
      const template = relevant.find((t) => String(t.id) === select.value);
      if (!template) return;
      const subject = fillTemplate(template.subject, lead, user);
      const body = fillTemplate(template.body, lead, user);
      replace(preview, subject ? h("p", { class: "preview-subject" }, subject) : null, body);

      const full = subject ? `${subject}\n\n${body}` : body;
      const email = lead.decisionMaker?.email;
      const mailto = email && template.channel === "email"
        ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : null;
      replace(actions,
        h("button", { class: "btn btn-sm", type: "button", onClick: () => copy(full, "Message") }, icon("copy"), "Copy message"),
        mailto ? h("a", { class: "btn btn-sm", href: mailto }, icon("mail"), "Open in email") : null,
        lead.status === "new"
          ? h("button", { class: "btn btn-sm btn-primary", type: "button", onClick: () => update({ status: "contacted" }, "Marked as contacted. Follow-ups scheduled for D+3 and D+7.") },
              icon("check"), "Mark as contacted")
          : null
      );
    }

    // Default to the best opener: a template for this discipline, else any first-contact template.
    const preferred =
      relevant.find((t) => t.discipline === lead.listing.discipline) ??
      relevant.find((t) => !/follow-up/i.test(t.name)) ??
      relevant[0];
    if (preferred) select.value = String(preferred.id);
    queueMicrotask(show);
    return h("div", { class: "composer" },
      h("label", { class: "field-label", for: "template-picker" }, "Template"),
      select, preview, actions);
  }

  function notesForm() {
    const textarea = h("textarea", { class: "textarea", id: "lead-notes", name: "notes", maxlength: "2000", rows: "4" });
    textarea.value = lead.notes ?? "";
    const error = h("p", { class: "field-error", id: "err-lead-notes" });
    return h("form", {
      class: "field",
      onSubmit: async (event) => {
        event.preventDefault();
        const { ok, data, errors } = validate({ notes: schemas.leadUpdate.notes }, { notes: textarea.value });
        error.textContent = ok ? "" : errors.notes;
        textarea.toggleAttribute("aria-invalid", !ok);
        if (ok) await update(data, "Notes saved.");
      },
    },
      h("label", { for: "lead-notes" }, "Private notes"),
      textarea, error,
      h("div", {}, h("button", { class: "btn btn-sm", type: "submit" }, "Save notes"))
    );
  }

  function wonAmountForm() {
    const input = h("input", { class: "input", id: "won-amount", type: "number", min: "0", max: "10000000", step: "100", inputmode: "numeric", value: lead.wonAmount ?? "" });
    const error = h("p", { class: "field-error" });
    return h("form", {
      class: "field",
      onSubmit: async (event) => {
        event.preventDefault();
        const { ok, data, errors } = validate({ wonAmount: schemas.leadUpdate.wonAmount }, { wonAmount: input.value });
        error.textContent = ok ? "" : errors.wonAmount;
        if (ok) await update(data, "Mission value saved.");
      },
    },
      h("label", { for: "won-amount" }, "Mission value (€)"),
      h("div", { class: "composer-row" }, input, h("button", { class: "btn", type: "submit" }, "Save")),
      error
    );
  }

  function render() {
    const dm = lead.decisionMaker;
    // Re-rendering must not drop keyboard focus (controls are found again by id or rating).
    const focusedId = document.activeElement?.id;
    const focusedRating = document.activeElement?.dataset?.rating;
    el.replaceChildren(
      h("header", { class: "drawer-head" },
        scoreEl(lead.listing.fitScore),
        h("div", {},
          h("div", { class: "lead-tags" },
            h("span", { class: "badge badge-primary" }, disciplineLabel(lead.listing.discipline)),
            urgencyBadge(lead.listing.urgency),
            h("span", { class: "badge" }, `Delivered ${formatDate(lead.deliveredOn)}`)
          ),
          h("h2", { id: "drawer-title" }, lead.listing.title),
          h("p", { class: "lead-meta" }, `${lead.company.name} · ${lead.listing.location}`)
        ),
        h("button", { class: "btn btn-ghost btn-icon", type: "button", onClick: () => el.close() }, icon("close", { label: "Close" }))
      ),
      h("div", { class: "drawer-body" },
        h("section", { class: "drawer-section" },
          h("h3", {}, "Why it's a freelance need"),
          h("ul", { class: "lead-reasons" }, lead.listing.reasons.map((r) => h("li", {}, r))),
          h("div", { class: "button-row" },
            h("a", { class: "btn btn-sm btn-ghost", href: safeUrl(lead.listing.sourceUrl), target: "_blank", rel: "noopener noreferrer" },
              icon("external"), `View original listing on ${lead.listing.sourceLabel}`),
            rateButtons(lead, changed)
          )
        ),

        dm
          ? h("section", { class: "drawer-section" },
              h("h3", {}, "Decision-maker"),
              h("p", { class: "lead-dm" },
                h("span", { class: "avatar", "aria-hidden": "true" }, initials(dm.firstName, dm.lastName)),
                h("span", {}, h("strong", {}, `${dm.firstName} ${dm.lastName}`), ` · ${dm.role}, ${lead.company.name}`)),
              h("ul", { class: "contact-list" },
                dm.email ? contactRow("mail", dm.email, { href: `mailto:${dm.email}`, copyLabel: "Email" }) : null,
                dm.phone ? contactRow("phone", dm.phone, { href: `tel:${dm.phone.replace(/\s/g, "")}`, copyLabel: "Phone" }) : null,
                dm.linkedinUrl ? contactRow("linkedin", "LinkedIn profile", { href: safeUrl(dm.linkedinUrl) }) : null
              ))
          : null,

        h("section", { class: "drawer-section" },
          h("h3", {}, "Reach out"),
          composer()
        ),

        h("section", { class: "drawer-section" },
          h("h3", {}, "Pipeline"),
          h("div", { class: "status-row" },
            h("div", { class: "field" },
              h("label", { for: "lead-status" }, "Status"),
              statusSelect(lead.status, (status) => update({ status }, `Moved to ${statusLabel(status)}.`), { id: "lead-status" })),
            h("div", { class: "field" },
              h("span", { class: "field-label" }, "Follow-ups"),
              lead.followUps.length
                ? h("p", { class: "muted" }, lead.followUps.map((f) => `D+${f.days} ${f.doneAt ? "done" : relativeDays(f.dueAt)}`).join(" · "))
                : h("p", { class: "muted" }, "Scheduled once you mark the lead as contacted."))
          ),
          lead.status === "won" ? wonAmountForm() : null,
          lead.status === "won" && lead.wonAmount ? h("p", { class: "muted" }, `Signed for ${formatMoney(lead.wonAmount)}.`) : null
        ),

        h("section", { class: "drawer-section" }, notesForm()),

        h("section", { class: "drawer-section" },
          h("h3", {}, "Company"),
          h("dl", { class: "facts" },
            h("div", {}, h("dt", {}, "Sector"), h("dd", {}, lead.company.sector)),
            h("div", {}, h("dt", {}, "Size"), h("dd", {}, `${lead.company.size} employees`)),
            h("div", {}, h("dt", {}, "City"), h("dd", {}, lead.company.city)),
            h("div", {}, h("dt", {}, "Tech stack"), h("dd", {}, lead.company.techStack ?? "Unknown"))
          )
        ),

        h("section", { class: "drawer-section" },
          h("h3", {}, "Original listing"),
          h("p", { class: "listing-text" }, lead.listing.description)
        ),

        activities.length
          ? h("section", { class: "drawer-section" },
              h("h3", {}, "Activity"),
              h("ul", { class: "activity" }, activities.map((a) =>
                h("li", {}, `${formatDate(a.createdAt)} · ${(ACTIVITY_TEXT[a.kind] ?? (() => a.kind))(a.detail)}`))))
          : null
      )
    );
    if (focusedId) document.getElementById(focusedId)?.focus();
    else if (focusedRating) el.querySelector(`[data-rating="${focusedRating}"]`)?.focus();
  }

  render();
}
