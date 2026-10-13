"use client";

import type {ReactElement} from 'react';
import ProductTrackingAttachments from '@/components/ProductTrackingAttachments';
import type {TrackingInvoice, TrackingInvoiceFormState} from '@/lib/product-tracking-invoice';

export default function ProductTrackingInvoices({initialInvoices, initiallyAddInvoice, addInvoiceTrigger, ...props}: {
  initialInvoices: TrackingInvoice[]; initiallyAddInvoice?: boolean; addInvoiceTrigger?: ReactElement<{disabled?: boolean}>;
  trackingId?: number; readOnly?: boolean; disabled?: boolean;
  onStateChange?: (state: TrackingInvoiceFormState) => void;
}) {
  return <ProductTrackingAttachments {...props} kind="INVOICE" initialAttachments={initialInvoices} initiallyAddAttachment={initiallyAddInvoice} addAttachmentTrigger={addInvoiceTrigger}/>;
}
