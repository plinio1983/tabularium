import {badgeClass, yesNoStyles} from '@/lib/expense-ui';
import {trackingFlags, type TrackingSummaryRecord} from '@/lib/product-tracking';
export default function ProductTrackingStatus({record, cutoff, showMissing = true}: {record: TrackingSummaryRecord; cutoff: Date; showMissing?: boolean}) {
  const flags = trackingFlags(record, cutoff);
  return <div className="record-detail-badge-row">
    {showMissing && flags.missingInvoice && <span className={badgeClass('tone-warning')}>Fattura mancante</span>}
    {showMissing && flags.missingTracking && <span className={badgeClass('tone-warning')}>Tracciamento mancante</span>}
    {!flags.missingInvoice && !flags.missingTracking && <span className={badgeClass(yesNoStyles.yes.className)}>Completa</span>}
    {flags.oldInvoice && <span className={badgeClass('tone-warning')}>Ultima fattura oltre 6 mesi</span>}
    {flags.oldEntry && <span className={badgeClass('tone-warning')}>Ingresso oltre 6 mesi</span>}
  </div>;
}
