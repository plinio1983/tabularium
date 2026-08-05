"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";

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
    nextDisabled?: boolean;
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
                                                    nextDisabled = false,
                                                    submitDisabled = false,
                                                    error,
                                                }: Props) {
    const anchorRef = useRef<HTMLSpanElement>(null);
    const [mounted, setMounted] = useState(false);
    const showBack = currentStep > 1;
    const showSubmit = currentStep >= submitStep;

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const form = anchorRef.current?.closest("form");
        if (!form || showSubmit) return;

        const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input:not([type='hidden']):not([type='file'])"));
        const previousHints = inputs.map(input => input.getAttribute("enterkeyhint"));
        inputs.forEach(input => input.setAttribute("enterkeyhint", "next"));

        function handleEnter(event: KeyboardEvent) {
            if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.repeat) return;
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

    const actions = <div className="mobile-form-sticky-actions">
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
                <button className="btn btn-md btn-primary" type="button"
                        disabled={isSubmitting || submitDisabled}
                        onClick={() => anchorRef.current?.closest("form")?.requestSubmit()}>
                    <span className="btn-icon">✓</span> {isSubmitting ? submittingLabel : submitLabel}
                </button>
            ) : (
                <button className="btn btn-md btn-primary" type="button" disabled={nextDisabled} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onNext();
                }}>
                    Avanti →
                </button>
            )}
        </div>
    </div>;

    return <>
        <span ref={anchorRef} className="mobile-form-sticky-actions-anchor" aria-hidden="true"/>
        {mounted ? createPortal(actions, document.body) : null}
    </>;
}
