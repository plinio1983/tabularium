"use client";

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
    const showBack = currentStep > 1;
    const showSubmit = currentStep >= submitStep;

    return <div className="expense-wizard-actions mobile-form-sticky-actions full">
        {error ? <p className="inline-warning full">{error}</p> : null}
        <div className="expense-wizard-actions-row mobile-form-sticky-actions-row">
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
