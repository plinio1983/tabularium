'use client';

import MobileFormStickyActions from '@/components/MobileFormStickyActions';

export default function EntityFormActions({onCancel, submitLabel, mobileSubmitLabel = 'Salva', submitting = false, submittingLabel = 'Salvataggio…', layout = 'form', formId, onReset}: {
  onCancel: () => void; submitLabel: string; mobileSubmitLabel?: string; submitting?: boolean; submittingLabel?: string;
  layout?: 'form' | 'drawer'; formId?: string; onReset?: () => void;
}) {
  const buttons = <>
    <button className="btn btn-md btn-default" type="button" onClick={onCancel} disabled={submitting}><span className="btn-icon">✕</span> Annulla</button>
    <button className="btn btn-md btn-primary" type="submit" form={formId} disabled={submitting}><span className="btn-icon">✓</span> {submitting ? submittingLabel : submitLabel}</button>
  </>;
  // Drawer actions stay inside the dialog's focus scope, outside its scrolling form.
  if (layout === 'drawer') return <div className="filter-drawer-actions entity-form-actions">
    {onReset ? <button className="btn btn-md btn-default reset-button" type="button" onClick={onReset} disabled={submitting}><span className="btn-icon">↺</span> Reset</button> : null}
    {buttons}
  </div>;
  return <>
    <div className="full hidden-md-down">
      <div className="full actions-row form-actions-row form-sticky-actions entity-form-actions">
        {buttons}
      </div>
    </div>
    <MobileFormStickyActions currentStep={1} submitStep={1} onBack={() => undefined} onNext={() => undefined} onCancel={onCancel} submitLabel={mobileSubmitLabel} submittingLabel={submittingLabel} isSubmitting={submitting}/>
  </>;
}
