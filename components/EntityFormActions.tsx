'use client';

import MobileFormStickyActions from '@/components/MobileFormStickyActions';

export default function EntityFormActions({onCancel, submitLabel, mobileSubmitLabel = 'Salva', submitting = false, submittingLabel = 'Salvataggio…'}: {
  onCancel: () => void; submitLabel: string; mobileSubmitLabel?: string; submitting?: boolean; submittingLabel?: string;
}) {
  return <>
    <div className="full hidden-md-down">
      <div className="full actions-row form-actions-row form-sticky-actions entity-form-actions">
        <button className="btn btn-md btn-default" type="button" onClick={onCancel} disabled={submitting}><span className="btn-icon">✕</span> Annulla</button>
        <button className="btn btn-md btn-primary" type="submit" disabled={submitting}><span className="btn-icon">✓</span> {submitting ? submittingLabel : submitLabel}</button>
      </div>
    </div>
    <MobileFormStickyActions currentStep={1} submitStep={1} onBack={() => undefined} onNext={() => undefined} onCancel={onCancel} submitLabel={mobileSubmitLabel} submittingLabel={submittingLabel} isSubmitting={submitting}/>
  </>;
}
