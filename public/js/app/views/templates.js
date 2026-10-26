// Templates: built-in scripts per channel and discipline, plus your own (create, edit, duplicate, delete).
import { CHANNELS, DISCIPLINES, TEMPLATE_VARIABLES, labelOf } from "/shared/constants.js";
import { schemas } from "/shared/validation.js";
import { api } from "../../lib/api.js";
import { h, icon } from "../../lib/dom.js";
import { bindForm } from "../../lib/forms.js";
import { disciplineLabel, pageHead, toast } from "../components.js";
import { loadTemplates } from "../state.js";

function field(id, label, control, hint) {
  return h("div", { class: "field" },
    h("label", { for: id }, label),
    control,
    hint ? h("p", { class: "hint" }, hint) : null,
    h("p", { class: "field-error", id: `err-${id}`, dataset: { errorFor: control.name } }));
}

export async function render() {
  let templates = await loadTemplates({ force: true });
  let selectedId = templates[0]?.id ?? null;
  const listPane = h("div", { class: "card" });
  const editorPane = h("div", { class: "card card-pad" });

  function renderList() {
    const groups = [
      { title: "My templates", items: templates.filter((t) => t.mine) },
      { title: "Built-in", items: templates.filter((t) => !t.mine) },
    ];
    listPane.replaceChildren(
      ...groups.filter((g) => g.items.length).map((group) =>
        h("div", {},
          h("p", { class: "nav-section" }, group.title),
          h("ul", { class: "template-list" }, group.items.map((t) =>
            h("li", {}, h("button", {
              class: "template-item",
              type: "button",
              "aria-current": String(t.id === selectedId),
              onClick: () => select(t.id),
            },
              h("strong", {}, t.name),
              h("span", {}, `${labelOf(CHANNELS, t.channel)} · ${t.discipline ? disciplineLabel(t.discipline) : "All disciplines"}`))))))
      )
    );
  }

  function select(id) {
    selectedId = id;
    renderList();
    renderEditor(templates.find((t) => t.id === id) ?? null);
  }

  async function reload(nextId) {
    templates = await loadTemplates({ force: true });
    select(nextId ?? templates[0]?.id ?? null);
  }

  function renderEditor(template) {
    const readOnly = template && !template.mine;
    const isNew = !template;

    const name = h("input", { class: "input", id: "tpl-name", name: "name", maxlength: "80", required: true, disabled: readOnly, value: template?.name ?? "" });
    const channel = h("select", { class: "select", id: "tpl-channel", name: "channel", disabled: readOnly },
      CHANNELS.map((c) => h("option", { value: c.id, selected: c.id === (template?.channel ?? "email") }, c.label)));
    const discipline = h("select", { class: "select", id: "tpl-discipline", name: "discipline", disabled: readOnly },
      h("option", { value: "" }, "All disciplines"),
      DISCIPLINES.map((d) => h("option", { value: d.id, selected: d.id === template?.discipline }, d.label)));
    const subject = h("input", { class: "input", id: "tpl-subject", name: "subject", maxlength: "150", disabled: readOnly, value: template?.subject ?? "" });
    const body = h("textarea", { class: "textarea", id: "tpl-body", name: "body", rows: "12", maxlength: "4000", required: true, disabled: readOnly });
    body.value = template?.body ?? "";

    const insertVariable = (variable) => {
      const token = `{{${variable}}}`;
      const start = body.selectionStart ?? body.value.length;
      body.setRangeText(token, start, body.selectionEnd ?? start, "end");
      body.focus();
    };

    const form = h("form", { class: "template-form" },
      h("p", { class: "form-error", role: "alert", dataset: { formError: "" } }),
      field("tpl-name", "Name", name),
      h("div", { class: "form-grid" }, field("tpl-channel", "Channel", channel), field("tpl-discipline", "Discipline", discipline)),
      field("tpl-subject", "Email subject", subject, "Only used for cold emails."),
      field("tpl-body", "Message", body),
      readOnly ? null : h("div", { class: "var-chips", "aria-label": "Insert a variable" },
        TEMPLATE_VARIABLES.map((v) => h("button", { type: "button", onClick: () => insertVariable(v) }, `{{${v}}}`))),
      h("div", { class: "button-row" },
        readOnly
          ? h("button", {
              class: "btn btn-primary",
              type: "button",
              onClick: async () => {
                const { id } = await api("/templates", {
                  method: "POST",
                  body: { name: `${template.name} (copy)`.slice(0, 80), channel: template.channel, discipline: template.discipline, subject: template.subject, body: template.body },
                });
                toast("Template duplicated. You can edit your copy.");
                reload(id);
              },
            }, icon("copy"), "Duplicate to edit")
          : h("button", { class: "btn btn-primary", type: "submit" }, isNew ? "Create template" : "Save changes"),
        template?.mine
          ? h("button", {
              class: "btn btn-ghost",
              type: "button",
              onClick: async () => {
                if (!confirm(`Delete "${template.name}"?`)) return;
                await api(`/templates/${template.id}`, { method: "DELETE" });
                toast("Template deleted.");
                reload();
              },
            }, icon("trash"), "Delete")
          : null
      )
    );

    if (!readOnly) {
      bindForm(form, schemas.template, async (data) => {
        if (isNew) {
          const { id } = await api("/templates", { method: "POST", body: data });
          toast("Template created.");
          reload(id);
        } else {
          await api(`/templates/${template.id}`, { method: "PUT", body: data });
          toast("Template saved.");
          reload(template.id);
        }
      });
    }

    editorPane.replaceChildren(
      h("h2", { class: "card-title" }, isNew ? "New template" : template.name),
      h("p", { class: "card-sub template-sub" }, readOnly ? "Built-in template (read-only). Duplicate it to make it yours." : "Variables are filled in from the lead and your profile."),
      form
    );
  }

  select(selectedId);
  return h("div", {},
    pageHead("Templates", "Cold emails, LinkedIn InMails and call scripts, ready to send.",
      h("button", { class: "btn btn-primary", type: "button", onClick: () => { selectedId = null; renderList(); renderEditor(null); } }, icon("plus"), "New template")),
    h("div", { class: "split" }, listPane, editorPane));
}
