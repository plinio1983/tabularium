"use client";

import { useEffect } from "react";

function selectedInputsForForm(formId: string) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
    ),
  );
  const uniqueById = new Map<string, HTMLInputElement>();
  inputs.forEach((input) => {
    if (!uniqueById.has(input.value)) uniqueById.set(input.value, input);
  });
  return Array.from(uniqueById.values());
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
  const bar = group.closest<HTMLElement>(".bulk-actions-bar");
  const edit = group.querySelector<HTMLAnchorElement>("[data-bulk-edit]");
  const copy = bar?.querySelector<HTMLElement>("[data-bulk-copy]");
  const del = group.querySelector<HTMLButtonElement>("[data-bulk-delete]");
  const payment = group.querySelector<HTMLButtonElement>("[data-bulk-add-payment]");
  const credit = group.querySelector<HTMLButtonElement>("[data-bulk-add-credit]");
  const singleEnabled = selected === 1;
  const anyEnabled = selected > 0;

  if (edit) {
    const multiEditEnabled = group.getAttribute("data-bulk-multi-edit") === "true";
    const editEnabled = singleEnabled || (multiEditEnabled && selected > 1);
    edit.classList.toggle("is-disabled", !editEnabled);
    edit.setAttribute("aria-disabled", editEnabled ? "false" : "true");
    edit.dataset.bulkEditMode = selected > 1 && multiEditEnabled ? "bulk" : "single";
    const triggerAttr = group.getAttribute("data-edit-trigger-attr");
    if (triggerAttr) {
      edit.href = "#";
      if (singleEnabled) edit.setAttribute(triggerAttr, firstId);
      else edit.removeAttribute(triggerAttr);
    } else {
      const editSuffix = group.getAttribute("data-edit-suffix") ?? "/edit";
      const editTarget = `${group.getAttribute("data-edit-base") ?? ""}${firstId}${editSuffix}`;
      const editReturnSeparator = editTarget.includes("?") ? "&" : "?";
      edit.href = singleEnabled ? `${editTarget}${editReturnSeparator}returnTo=${returnTo}` : "#";
    }
  }

  if (copy) {
    const singleOnly = group.getAttribute("data-copy-single-only") === "true";
    const copyEnabled = singleOnly ? singleEnabled : anyEnabled;
    copy.classList.toggle("is-disabled", !copyEnabled);
    copy.setAttribute("aria-disabled", copyEnabled ? "false" : "true");
    if (copy instanceof HTMLButtonElement) copy.disabled = !copyEnabled;
    const triggerAttr = group.getAttribute("data-copy-trigger-attr");
    if (triggerAttr) {
      if (copy instanceof HTMLAnchorElement) copy.href = "#";
      if (singleEnabled) copy.setAttribute(triggerAttr, firstId);
      else copy.removeAttribute(triggerAttr);
      copy.dataset.bulkCopyMode = !singleOnly && selected > 1 ? "bulk" : "single";
    } else if (copy instanceof HTMLAnchorElement) {
      copy.href = singleEnabled
        ? `${group.getAttribute("data-copy-base") ?? ""}${firstId}&returnTo=${returnTo}`
        : "#";
      copy.dataset.bulkCopyMode = !singleOnly && selected > 1 ? "bulk" : "single";
    }
  }

  if (payment) {
    const paymentEnabled = singleEnabled && selectedInputs[0]?.dataset.paymentComplete !== "true";
    payment.disabled = !paymentEnabled;
    payment.classList.toggle("is-disabled", !paymentEnabled);
    payment.setAttribute("aria-disabled", paymentEnabled ? "false" : "true");
    if (paymentEnabled) payment.setAttribute("data-expense-payment-id", firstId);
    else payment.removeAttribute("data-expense-payment-id");
  }

  if (credit) {
    const creditEnabled = singleEnabled && selectedInputs[0]?.dataset.creditComplete !== "true";
    credit.disabled = !creditEnabled;
    credit.classList.toggle("is-disabled", !creditEnabled);
    credit.setAttribute("aria-disabled", creditEnabled ? "false" : "true");
    if (creditEnabled) credit.setAttribute("data-income-credit-id", firstId);
    else credit.removeAttribute("data-income-credit-id");
  }

  if (del) del.disabled = !anyEnabled;
}

function buildFloatingButton(original: HTMLElement, label: string, icon: string, className = "", iconClassName = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `floating-bulk-button ${className}`.trim();
  const sicon = document.createElement("span");
  sicon.textContent = icon;
  const slabel = document.createElement("span");
  slabel.textContent = label;
  sicon.className = `btn-icon ${iconClassName}`;
  slabel.className = "floating-bulk-label";
  button.appendChild(sicon);
  button.appendChild(slabel);
  //button.innerHTML = `<span class="btn-icon">${icon}</span><span class="floating-bulk-label">${label}</span>`;
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

function buildFloatingSelectAll(original: HTMLInputElement) {
  const label = document.createElement("label");
  label.className = "bulk-select-all-inline floating-bulk-select-all-inline mobile-record-select";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute("aria-label", original.getAttribute("aria-label") ?? "Seleziona tutti");

  // const text = document.createElement("span");
  // text.textContent = original.closest("label")?.querySelector("span")?.textContent ?? "Seleziona tutti";

  checkbox.addEventListener("change", () => {
    original.checked = checkbox.checked;
    original.dispatchEvent(new Event("change", { bubbles: true }));
  });

  label.appendChild(checkbox);
  return label;
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
  const configuredSubject = form.dataset.bulkSubject;
  if (configuredSubject) return configuredSubject;
  if (form.id === "supplierBulkForm") return "fornitori";
  if (form.id === "clientBulkForm") return "clienti";
  if (form.id === "incomeBulkForm") return "incassi";
  if (form.id === "expenseBulkForm") return "spese";
  if (form.id === "recurringExpenseBulkForm") return "uscite ricorrenti";
  return "record";
}

function shouldUseBulkModal() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function closeBulkActionModal() {
  document.querySelectorAll<HTMLElement>(".bulk-action-modal-backdrop").forEach((modal) => modal.remove());
  document.body.classList.remove("bulk-action-modal-open");
}

function openBulkActionModal(sourceMenu: HTMLElement) {
  if (sourceMenu.classList.contains("bulk-action-menu-disabled")) return;

  const sourcePanel = sourceMenu.querySelector<HTMLElement>(".bulk-action-menu-panel");
  if (!sourcePanel) return;

  closeBulkActionModal();
  sourceMenu.removeAttribute("open");

  const backdrop = document.createElement("div");
  backdrop.className = "bulk-action-modal-backdrop";
  backdrop.setAttribute("role", "presentation");

  const modal = document.createElement("div");
  modal.className = "bulk-action-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Azioni bulk");

  const dragHandle = document.createElement("div");
  dragHandle.className = "bulk-action-modal-drag-handle";
  dragHandle.setAttribute("aria-hidden", "true");
  modal.appendChild(dragHandle);

  const header = document.createElement("div");
  header.className = "bulk-action-modal-header";

  const title = document.createElement("h3");
  title.textContent = "Azioni";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "bulk-action-modal-close";
  close.setAttribute("aria-label", "Chiudi azioni bulk");
  close.textContent = "×";
  close.addEventListener("click", closeBulkActionModal);

  header.appendChild(title);
  header.appendChild(close);
  modal.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "bulk-action-modal-actions";

  Array.from(sourcePanel.children).forEach((child) => {
    if (!(child instanceof HTMLButtonElement)) return;
    const sourceButton = child;
    const cloned = document.createElement("button");
    cloned.type = "button";
    cloned.innerHTML = sourceButton.innerHTML;
    cloned.className = sourceButton.className;
    cloned.disabled = sourceButton.disabled;
    cloned.addEventListener("click", () => {
      if (sourceButton.disabled) return;
      closeBulkActionModal();
      sourceButton.click();
    });
    actions.appendChild(cloned);
  });

  modal.appendChild(actions);
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeBulkActionModal();
  });

  let dragStartX = 0;
  let dragStartedAt = 0;
  let dragOffset = 0;
  let dragging = false;

  const resetDrag = () => {
    dragging = false;
    dragOffset = 0;
    modal.classList.remove("is-dragging");
    modal.style.removeProperty("--bulk-drawer-offset");
  };

  dragHandle.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragStartX = event.clientX;
    dragStartedAt = performance.now();
    dragOffset = 0;
    modal.classList.add("has-entered");
    modal.classList.add("is-dragging");
    dragHandle.setPointerCapture(event.pointerId);
  });

  dragHandle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    dragOffset = Math.max(0, dragStartX - event.clientX);
    modal.style.setProperty("--bulk-drawer-offset", `${dragOffset}px`);
  });

  const finishDrag = (event: PointerEvent) => {
    if (!dragging) return;
    const elapsed = Math.max(1, performance.now() - dragStartedAt);
    const velocity = dragOffset / elapsed;
    dragging = false;
    modal.classList.remove("is-dragging");
    if (dragOffset >= 90 || (dragOffset >= 42 && velocity >= .45)) {
      modal.style.setProperty("--bulk-drawer-offset", "100vw");
      backdrop.classList.add("is-closing");
      window.setTimeout(closeBulkActionModal, 180);
    } else {
      modal.style.removeProperty("--bulk-drawer-offset");
    }
    if (dragHandle.hasPointerCapture(event.pointerId)) dragHandle.releasePointerCapture(event.pointerId);
  };

  dragHandle.addEventListener("pointerup", finishDrag);
  dragHandle.addEventListener("pointercancel", resetDrag);
  modal.addEventListener("animationend", () => modal.classList.add("has-entered"), {once: true});

  document.body.appendChild(backdrop);
  document.body.classList.add("bulk-action-modal-open");
  close.focus();
}

function makeFloatingBar(sourceBar: HTMLElement) {
  const floating = document.createElement("div");
  floating.className = "floating-bulk-actions-bar";
  floating.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "floating-bulk-actions-inner";
  floating.appendChild(inner);

  const selectAll = sourceBar.querySelector<HTMLInputElement>(".bulk-select-all-inline .bulk-select-all");
  if (selectAll) inner.appendChild(buildFloatingSelectAll(selectAll));

  const useButtonGroup = sourceBar.dataset.bulkButtonGroup === "true";
  const actionTarget = useButtonGroup ? document.createElement("div") : inner;
  if (useButtonGroup) {
    actionTarget.className = "floating-bulk-button-group btn-group";
    inner.appendChild(actionTarget);
  }

  const sourceMenu = sourceBar.querySelector<HTMLElement>("[data-bulk-menu]");
  const sourcePanel = sourceMenu?.querySelector<HTMLElement>(".bulk-action-menu-panel");
  if (sourceMenu && sourcePanel) {
    const menuWrap = document.createElement("div");
    menuWrap.className = "floating-bulk-menu-wrap btn-group-item";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "floating-bulk-button floating-bulk-menu-trigger";
    // trigger.innerHTML = `<span class="btn-icon">⚙</span><span><span class="floating-bulk-label">Bulk </span>Actions</span><span class="floating-bulk-caret">▾</span>`;

    const caret = document.createElement("span");
    caret.className = "floating-bulk-caret";
    caret.textContent = "▾";
    const icon = document.createElement("span");
    icon.className = "btn-icon hidden-mobile";
    icon.textContent = "⚙";
    const label = document.createElement("span");
    const hLabel = document.createElement("span");
    hLabel.textContent = "Bulk ";
    hLabel.className = "floating-bulk-label";

    label.appendChild(hLabel);
    label.append("Actions");
    trigger.appendChild(icon);
    trigger.appendChild(label);
    trigger.appendChild(caret);

    const panel = document.createElement("div");
    panel.className = "floating-bulk-menu-panel";

    Array.from(sourcePanel.children).forEach((child) => {
      if (!(child instanceof HTMLButtonElement)) return;
      const sourceButton = child;
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
      if (shouldUseBulkModal()) {
        openBulkActionModal(sourceMenu);
        return;
      }
      menuWrap.classList.toggle("is-open");
    });

    menuWrap.appendChild(trigger);
    menuWrap.appendChild(panel);
    actionTarget.appendChild(menuWrap);
  }

  const edit = sourceBar.querySelector<HTMLElement>("[data-bulk-edit]");
  const directCopy = sourceBar.querySelector<HTMLElement>("[data-bulk-direct-actions] [data-bulk-copy]");
  const payment = sourceBar.querySelector<HTMLElement>("[data-bulk-add-payment]");
  const credit = sourceBar.querySelector<HTMLElement>("[data-bulk-add-credit]");
  const del = sourceBar.querySelector<HTMLElement>("[data-bulk-delete]");
  const newItem = sourceBar.querySelector<HTMLElement>("[data-bulk-new], [data-expense-new]");

  if (edit) actionTarget.appendChild(buildFloatingButton(edit, "Modifica", "✎", "floating-bulk-edit"));
  if (directCopy) actionTarget.appendChild(buildFloatingButton(directCopy, "Copia", "⧉", "floating-bulk-copy"));
  if (payment) actionTarget.appendChild(buildFloatingButton(payment, "Inserisci pagamento", "＋", "floating-bulk-payment"));
  if (credit) actionTarget.appendChild(buildFloatingButton(credit, "Inserisci accredito", "＋", "floating-bulk-credit"));
  if (del) actionTarget.appendChild(buildFloatingButton(del, "Elimina", "🗑", "floating-bulk-delete hidden-sp", "icon-small"));
  if (newItem) {
    const newItemWrap = document.createElement("div");
    const label = newItem.getAttribute("data-floating-label") ?? "Aggiungi spesa";
    const icon = newItem.getAttribute("data-floating-icon") ?? "+";
    newItemWrap.className = "bulk-inner-container";
    newItemWrap.appendChild(buildFloatingButton(newItem, label, icon, "floating-bulk-new btn-primary"));
    inner.appendChild(newItemWrap);
  }

  document.body.appendChild(floating);
  return floating;
}

function syncFloatingBar(sourceBar: HTMLElement, floating: HTMLElement) {
  const sourceMenu = sourceBar.querySelector<HTMLElement>("[data-bulk-menu]");
  const sourceEdit = sourceBar.querySelector<HTMLElement>("[data-bulk-edit]");
  const sourceDirectCopy = sourceBar.querySelector<HTMLElement>("[data-bulk-direct-actions] [data-bulk-copy]");
  const sourcePayment = sourceBar.querySelector<HTMLButtonElement>("[data-bulk-add-payment]");
  const sourceCredit = sourceBar.querySelector<HTMLButtonElement>("[data-bulk-add-credit]");
  const sourceDel = sourceBar.querySelector<HTMLButtonElement>("[data-bulk-delete]");
  const sourceSelectAll = sourceBar.querySelector<HTMLInputElement>(".bulk-select-all-inline .bulk-select-all");
  const floatingSelectAll = floating.querySelector<HTMLInputElement>(".floating-bulk-select-all-inline input");

  if (sourceSelectAll && floatingSelectAll) {
    floatingSelectAll.checked = sourceSelectAll.checked;
    floatingSelectAll.indeterminate = sourceSelectAll.indeterminate;
  }

  floating
    .querySelector(".floating-bulk-menu-trigger")
    ?.classList.toggle("is-disabled", Boolean(sourceMenu?.classList.contains("bulk-action-menu-disabled")));

  floating
    .querySelector(".floating-bulk-edit")
    ?.classList.toggle("is-disabled", Boolean(sourceEdit?.classList.contains("is-disabled")));

  floating
    .querySelector(".floating-bulk-copy")
    ?.classList.toggle("is-disabled", Boolean(sourceDirectCopy?.classList.contains("is-disabled")));

  const floatingPayment = floating.querySelector<HTMLButtonElement>(".floating-bulk-payment");
  if (floatingPayment) {
    floatingPayment.disabled = Boolean(sourcePayment?.disabled);
    floatingPayment.classList.toggle("is-disabled", Boolean(sourcePayment?.disabled));
  }

  const floatingCredit = floating.querySelector<HTMLButtonElement>(".floating-bulk-credit");
  if (floatingCredit) {
    floatingCredit.disabled = Boolean(sourceCredit?.disabled);
    floatingCredit.classList.toggle("is-disabled", Boolean(sourceCredit?.disabled));
  }

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
        const listCard = bar.closest<HTMLElement>(".record-list-card");
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

      const bulkActionTrigger = target.closest<HTMLElement>(".bulk-action-trigger");
      const bulkActionMenu = bulkActionTrigger?.closest<HTMLElement>("[data-bulk-menu]");
      if (bulkActionTrigger && bulkActionMenu && shouldUseBulkModal()) {
        event.preventDefault();
        event.stopPropagation();
        openBulkActionModal(bulkActionMenu);
        return;
      }

      const disabledLink = target.closest<HTMLAnchorElement>(".bulk-direct-link.is-disabled");
      if (disabledLink && disabledLink.dataset.bulkEditMode !== "bulk") {
        event.preventDefault();
        return;
      }

      const bulkCopy = target.closest<HTMLElement>("[data-bulk-copy]");
      if (bulkCopy?.dataset.bulkCopyMode === "bulk") {
        const formId = bulkCopy.closest<HTMLFormElement>("form")?.id ?? "";
        if (!formId) return;
        event.preventDefault();
        const eventName = formId === "incomeBulkForm" ? "income-bulk-copy-request" : "expense-bulk-copy-request";
        document.dispatchEvent(new CustomEvent(eventName, {
          detail: {formId},
        }));
        return;
      }

      const bulkEdit = target.closest<HTMLElement>("[data-bulk-edit]");
      if (bulkEdit?.dataset.bulkEditMode === "bulk") {
        const group = bulkEdit.closest<HTMLElement>("[data-bulk-direct-actions]");
        const formId = group?.getAttribute("data-bulk-form") ?? "";
        if (!formId) return;
        event.preventDefault();
        document.dispatchEvent(new CustomEvent("bulk-edit-request", {
          detail: {formId, selectedCount: selectedInputsForForm(formId).length},
        }));
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
      if (action === "export_csv") return;
      const subject = formSubject(form);
      const message = `Confermi di eseguire "${label}" su ${selected} ${subject} selezionati?`;
      if (!window.confirm(message)) event.preventDefault();
    };

    const onScrollOrResize = () => {
      syncBulkControls();
      updateFloatingVisibility();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBulkActionModal();
    };

    document.addEventListener("change", onChange);
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("keydown", onKeyDown);
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
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      document.querySelectorAll(".floating-bulk-actions-bar").forEach((bar) => bar.remove());
      closeBulkActionModal();
    };
  }, []);

  return null;
}
