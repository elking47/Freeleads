// Discipline chip picker used by signup and settings. Disables extra choices beyond the plan limit.
import { DISCIPLINES } from "/shared/constants.js";
import { h } from "./dom.js";

export function renderDisciplinePicker(container, { max, selected = [] }) {
  const sync = () => {
    const boxes = [...container.querySelectorAll("input")];
    const count = boxes.filter((b) => b.checked).length;
    for (const box of boxes) box.disabled = !box.checked && count >= max;
  };
  container.replaceChildren(
    ...DISCIPLINES.map((d) =>
      h("label", { class: "chip", title: d.detail },
        h("input", { type: "checkbox", name: "disciplines", value: d.id, checked: selected.includes(d.id), "data-list": true, onChange: sync }),
        h("span", {}, d.label)
      )
    )
  );
  sync();
}
