"use client";

import { useEffect } from "react";

function selectedInputsForForm(formId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
    ),
  );
}

function allInputsForForm(formId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[name="ids"][form="${formId}"], form#${formId} input[name="ids"]`,
    ),
  );
}

function syncDirectActionGroup(group: HTMLElement) {
  const formId = group.getAttribute("data-bulk-form") ?? "";
  const selectedInputs = formId ? selectedInputsForForm(formId) : [];
  const selected = selectedInputs.length;
  const firstId = selectedInputs[0]?.value ?? "";
  const returnTo = group.getAttribute("data-return-to") ?? "";
  const edit = group.querySelector<HTMLAnchorElement>("[data-bulk-edit]");
  const copy = group.querySelector<HTMLAnchorElement>("[data-bulk-copy]");
  const del = group.querySelector<HTMLButtonElement>("[data-bulk-delete]");
  const singleEnabled = selected === 1;
  const anyEnabled = selected > 0;

  if (edit) {
    edit.classList.toggle("is-disabled", !singleEnabled);
    edit.setAttribute("aria-disabled", singleEnabled ? "false" : "true");
    const triggerAttr = group.getAttribute("data-edit-trigger-attr");
    if (triggerAttr) {
      edit.href = "#";
      if (singleEnabled) edit.setAttribute(triggerAttr, firstId);
      else edit.removeAttribute(triggerAttr);
    } else {
      const editSuffix = group.getAttribute("data-edit-suffix") ?? "/edit";
      const editReturnSeparator = editSuffix.includes("?") ? "&" : "?";
      edit.href = singleEnabled
        ? `${group.getAttribute("data-edit-base") ?? ""}${firstId}${editSuffix}${editReturnSeparator}returnTo=${returnTo}`
        : "#";
    }
  }

  if (copy) {
    copy.classList.toggle("is-disabled", !singleEnabled);
    copy.setAttribute("aria-disabled", singleEnabled ? "false" : "true");
    const triggerAttr = group.getAttribute("data-copy-trigger-attr");
    if (triggerAttr) {
      copy.href = "#";
      if (singleEnabled) copy.setAttribute(triggerAttr, firstId);
      else copy.removeAttribute(triggerAttr);
    } else {
      copy.href = singleEnabled
        ? `${group.getAttribute("data-copy-base") ?? ""}${firstId}&returnTo=${returnTo}`
        : "#";
    }
  }

  if (del) del.disabled = !anyEnabled;
}

function buildFloatingButton(original: HTMLElement, label: string, icon: string, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `floating-bulk-button ${className}`.trim();
  button.innerHTML = `<span class="btn-icon">${icon}</span><span class="floating-bulk-label">${label}</span>`;
  button.addEventListener("click", () => {
    if (original instanceof HTMLAnchorElement) {
      if (original.classList.contains("is-disabled") || original.getAttribute("aria-disabled") === "true") return;
      original.click();
      return;
    }

    if (original instanceof HTMLButtonElement) {
      if (original.disabled) return;
      original.click();
      return;
    }

    original.click();
  });
  return button;
}

function submitterAction(submitter: HTMLElement | null) {
  if (!(submitter instanceof HTMLButtonElement) && !(submitter instanceof HTMLInputElement)) return "";
  return submitter.name === "bulkAction" ? submitter.value : "";
}

function submitterLabel(submitter: HTMLElement | null) {
  if (!submitter) return "questa azione";
  return submitter.getAttribute("data-confirm-label") || submitter.textContent?.trim() || "questa azione";
}

function formSubject(form: HTMLFormElement) {
  if (form.id === "supplierBulkForm") return "fornitori";
  if (form.id === "incomeBulkForm") return "incassi";
  if (form.id === "expenseBulkForm") return "spese";
  if (form.id === "recurringExpenseBulkForm") return "spese ricorrenti";
  return "record";
}

function makeFloatingBar(sourceBar: HTMLElement) {
  const floating = document.createElement("div");
  floating.className = "floating-bulk-actions-bar";
  floating.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "floating-bulk-actions-inner";
  floating.appendChild(inner);

  const sourceMenu = sourceBar.querySelector<HTMLElement>("[data-bulk-menu]");
  const sourcePanel = sourceMenu?.querySelector<HTMLElement>(".bulk-action-menu-panel");
  if (sourceMenu && sourcePanel) {
    const menuWrap = document.createElement("div");
    menuWrap.className = "floating-bulk-menu-wrap";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "floating-bulk-button floating-bulk-menu-trigger";
    trigger.innerHTML = `<span class="btn-icon">⚙</span><span class="floating-bulk-label">Bulk</span><span> Actions</span><span class="floating-bulk-caret">▾</span>`;

    const panel = document.createElement("div");
    panel.className = "floating-bulk-menu-panel";

    sourcePanel.querySelectorAll<HTMLButtonElement>("button").forEach((sourceButton) => {
      const cloned = document.createElement("button");
      cloned.type = "button";
      cloned.innerHTML = sourceButton.innerHTML;
      cloned.className = sourceButton.className;
      cloned.addEventListener("click", () => {
        if (sourceButton.disabled) return;
        sourceButton.click();
        menuWrap.classList.remove("is-open");
      });
      panel.appendChild(cloned);
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (sourceMenu.classList.contains("bulk-action-menu-disabled")) return;
      menuWrap.classList.toggle("is-open");
    });

    menuWrap.appendChild(trigger);
    menuWrap.appendChild(panel);
    inner.appendChild(menuWrap);
  }

  const edit = sourceBar.querySelector<HTMLElement>("[data-bulk-edit]");
  const copy = sourceBar.querySelector<HTMLElement>("[data-bulk-copy]");
  const del = sourceBar.querySelector<HTMLElement>("[data-bulk-delete]");
  const newItem = sourceBar.querySelector<HTMLElement>("[data-bulk-new], [data-expense-new]");

  if (edit) inner.appendChild(buildFloatingButton(edit, "Modifica", "✎", "floating-bulk-edit"));
  if (copy) inner.appendChild(buildFloatingButton(copy, "Copia", "＋", "floating-bulk-copy"));
  if (del) inner.appendChild(buildFloatingButton(del, "Elimina", "🗑", "floating-bulk-delete"));
  if (newItem) {
    const newItemWrap = document.createElement("div");
    const label = newItem.getAttribute("data-floating-label") ?? "Aggiungi spesa";
    const icon = newItem.getAttribute("data-floating-icon") ?? "+";
    newItemWrap.className = "bulk-inner-container";
    newItemWrap.appendChild(buildFloatingButton(newItem, label, icon, "floating-bulk-new primary-action"));
    inner.appendChild(newItemWrap);
  }

  document.body.appendChild(floating);
  return floating;
}

function syncFloatingBar(sourceBar: HTMLElement, floating: HTMLElement) {
  const sourceMenu = sourceBar.querySelector<HTMLElement>("[data-bulk-menu]");
  const sourceEdit = sourceBar.querySelector<HTMLElement>("[data-bulk-edit]");
  const sourceCopy = sourceBar.querySelector<HTMLElement>("[data-bulk-copy]");
  const sourceDel = sourceBar.querySelector<HTMLButtonElement>("[data-bulk-delete]");

  floating
    .querySelector(".floating-bulk-menu-trigger")
    ?.classList.toggle("is-disabled", Boolean(sourceMenu?.classList.contains("bulk-action-menu-disabled")));

  floating
    .querySelector(".floating-bulk-edit")
    ?.classList.toggle("is-disabled", Boolean(sourceEdit?.classList.contains("is-disabled")));

  floating
    .querySelector(".floating-bulk-copy")
    ?.classList.toggle("is-disabled", Boolean(sourceCopy?.classList.contains("is-disabled")));

  floating
    .querySelector(".floating-bulk-delete")
    ?.classList.toggle("is-disabled", Boolean(sourceDel?.disabled));
}

export default function BulkSelectionController() {
  useEffect(() => {
    const floatingBySource = new WeakMap<HTMLElement, HTMLElement>();

    const syncBulkControls = () => {
      document.querySelectorAll<HTMLElement>("[data-bulk-menu]").forEach((menu) => {
        const formId = menu.getAttribute("data-bulk-form") ?? "";
        const selected = formId ? selectedInputsForForm(formId).length : 0;
        menu.classList.toggle("bulk-action-menu-disabled", selected === 0);
        if (selected === 0) menu.removeAttribute("open");
      });

      document.querySelectorAll<HTMLElement>("[data-bulk-direct-actions]").forEach(syncDirectActionGroup);

      document.querySelectorAll<HTMLInputElement>(".bulk-select-all").forEach((checkbox) => {
        const formId = checkbox.getAttribute("data-bulk-target") ?? "";
        if (!formId) return;
        const inputs = allInputsForForm(formId);
        const checked = inputs.filter((input) => input.checked).length;
        checkbox.checked = inputs.length > 0 && checked === inputs.length;
        checkbox.indeterminate = checked > 0 && checked < inputs.length;
      });

      document.querySelectorAll<HTMLElement>(".bulk-actions-bar").forEach((bar) => {
        const floating = floatingBySource.get(bar);
        if (floating) syncFloatingBar(bar, floating);
      });
    };

    const updateFloatingVisibility = () => {
      document.querySelectorAll<HTMLElement>(".bulk-actions-bar").forEach((bar) => {
        if (!bar.querySelector("[data-bulk-menu], [data-bulk-direct-actions]")) return;

        let floating = floatingBySource.get(bar);
        if (!floating) {
          floating = makeFloatingBar(bar);
          floatingBySource.set(bar, floating);
        }

        syncFloatingBar(bar, floating);

        const rect = bar.getBoundingClientRect();
        const listCard = bar.closest<HTMLElement>(".expenses-list-card");
        const cardRect = listCard?.getBoundingClientRect();
        const hasScrollableArea = cardRect ? cardRect.bottom > 120 && cardRect.top < window.innerHeight - 80 : true;
        const shouldShow = rect.bottom < 0 && hasScrollableArea;

        floating.classList.toggle("is-visible", shouldShow);
        floating.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      });
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains("bulk-select-all")) {
        const formId = target.getAttribute("data-bulk-target") ?? "";
        if (formId) {
          allInputsForForm(formId).forEach((input) => {
            input.checked = target.checked;
          });
        }
      }

      if (target.matches('input[name="ids"]') || target.classList.contains("bulk-select-all")) {
        syncBulkControls();
        updateFloatingVisibility();
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const disabledLink = target.closest<HTMLAnchorElement>(".bulk-direct-link.is-disabled");
      if (disabledLink) {
        event.preventDefault();
        return;
      }

      if (!target.closest(".floating-bulk-menu-wrap")) {
        document.querySelectorAll<HTMLElement>(".floating-bulk-menu-wrap.is-open").forEach((menu) => {
          menu.classList.remove("is-open");
        });
      }

      document.querySelectorAll<HTMLElement>("[data-bulk-menu][open]").forEach((menu) => {
        if (!menu.contains(target)) menu.removeAttribute("open");
      });
    };

    const onToggle = (event: Event) => {
      const menu = event.target;
      if (!(menu instanceof HTMLElement)) return;
      if (!menu.matches("[data-bulk-menu][open]")) return;

      const formId = menu.getAttribute("data-bulk-form") ?? "";
      const selected = formId ? selectedInputsForForm(formId).length : 0;
      if (selected === 0) menu.removeAttribute("open");
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.classList.contains("confirm-bulk-form")) return;

      event.stopImmediatePropagation();

      const selected = form.id ? selectedInputsForForm(form.id).length : form.querySelectorAll('input[name="ids"]:checked').length;
      if (!selected) {
        window.alert("Seleziona almeno una riga.");
        event.preventDefault();
        return;
      }

      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      const action = submitterAction(submitter) || String(new FormData(form).get("bulkAction") || "");
      if (!action) {
        window.alert("Seleziona un'azione bulk.");
        event.preventDefault();
        return;
      }

      const label = submitterLabel(submitter);
      const subject = formSubject(form);
      const message = `Confermi di eseguire "${label}" su ${selected} ${subject} selezionati?`;
      if (!window.confirm(message)) event.preventDefault();
    };

    const onScrollOrResize = () => {
      syncBulkControls();
      updateFloatingVisibility();
    };

    document.addEventListener("change", onChange);
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("toggle", onToggle, true);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    window.requestAnimationFrame(() => {
      syncBulkControls();
      updateFloatingVisibility();
    });

    return () => {
      document.removeEventListener("change", onChange);
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      document.querySelectorAll(".floating-bulk-actions-bar").forEach((bar) => bar.remove());
    };
  }, []);

  return null;
}
