"use client";

import {useEffect, useRef} from "react";

type Props = {
    currentStep: number;
    submitStep: number;
    onBack: () => void;
    onNext: () => void;
    onCancel?: () => void;
    cancelHref?: string;
    backLabel?: string;
    submitLabel: string;
    submittingLabel?: string;
    isSubmitting?: boolean;
    submitDisabled?: boolean;
    error?: string | null;
};

export default function MobileFormStickyActions({
                                                    currentStep,
                                                    submitStep,
                                                    onBack,
                                                    onNext,
                                                    onCancel,
                                                    cancelHref,
                                                    backLabel = "Indietro",
                                                    submitLabel,
                                                    submittingLabel = "Salvataggio...",
                                                    isSubmitting = false,
                                                    submitDisabled = false,
                                                    error,
                                                }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const showBack = currentStep > 1;
    const showSubmit = currentStep >= submitStep;

    useEffect(() => {
        const root = rootRef.current;
        const form = root?.closest("form");
        if (!root || !form || showSubmit) return;

        const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input:not([type='hidden']):not([type='file'])"));
        const previousHints = inputs.map(input => input.getAttribute("enterkeyhint"));
        inputs.forEach(input => input.setAttribute("enterkeyhint", "next"));

        function handleEnter(event: KeyboardEvent) {
            if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.repeat) return;
            if (getComputedStyle(root!).display === "none") return;
            const target = event.target;
            if (!(target instanceof HTMLElement) || !form!.contains(target)) return;
            if (target.closest("textarea, select, button, a")) return;

            const suggestionScope = target.closest<HTMLElement>(
                ".product-suggestion-picker, .entity-autocomplete, .app-autocomplete-control",
            );
            if (suggestionScope?.querySelector("[role='listbox']")) return;

            event.preventDefault();
            onNext();
        }

        document.addEventListener("keydown", handleEnter);
        return () => {
            document.removeEventListener("keydown", handleEnter);
            inputs.forEach((input, index) => {
                const previousHint = previousHints[index];
                if (previousHint === null) input.removeAttribute("enterkeyhint");
                else input.setAttribute("enterkeyhint", previousHint);
            });
        };
    }, [currentStep, onNext, showSubmit]);

    return <div ref={rootRef} className="app-form-wizard-actions mobile-form-sticky-actions full">
        {error ? <p className="inline-warning full">{error}</p> : null}
        <div className="app-form-wizard-actions-row mobile-form-sticky-actions-row">
            {showBack ? (
                <button className="btn btn-md btn-default" type="button" onClick={onBack}>
                    ← {backLabel}
                </button>
            ) : onCancel ? (
                <button className="btn btn-md btn-default" type="button" onClick={onCancel}>
                    × Annulla
                </button>
            ) : cancelHref ? (
                <a className="btn btn-md btn-default" href={cancelHref}>× Annulla</a>
            ) : (
                <span aria-hidden="true"/>
            )}

            {showSubmit ? (
                <button className="btn btn-md btn-primary" type="submit"
                        disabled={isSubmitting || submitDisabled}>
                    <span className="btn-icon">✓</span> {isSubmitting ? submittingLabel : submitLabel}
                </button>
            ) : (
                <button className="btn btn-md btn-primary" type="button" onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onNext();
                }}>
                    Avanti →
                </button>
            )}
        </div>
    </div>;
}
