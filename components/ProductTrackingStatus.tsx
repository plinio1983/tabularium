import {badgeClass} from '@/lib/expense-ui';
import {trackingFlags, type TrackingSummaryRecord} from '@/lib/product-tracking';
export default function ProductTrackingStatus({record, cutoff, showMissing = true, showOldDocument = true}: {record: TrackingSummaryRecord; cutoff: Date; showMissing?: boolean; showOldDocument?: boolean}) {
  const flags = trackingFlags(record, cutoff);
  return <div className="record-detail-badge-row">
    {showMissing && flags.missingInvoice && <span className={badgeClass('tone-warning')}>Fattura mancante</span>}
    {showMissing && flags.missingTracking && <span className={badgeClass('tone-warning')}>Tracciamento mancante</span>}
    {flags.oldInvoice && <span className={badgeClass('tone-warning')}>Ultima fattura oltre 6 mesi</span>}
    {showOldDocument && flags.oldDocument && <span className={badgeClass('tone-warning')}>Tracciatura oltre 6 mesi</span>}
    {flags.oldEntry && <span className={badgeClass('tone-warning')}>Ingresso oltre 6 mesi</span>}
  </div>;
}
