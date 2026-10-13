"use client";

import type {ReactElement} from 'react';
import ProductTrackingAttachments from '@/components/ProductTrackingAttachments';
import type {TrackingDocument, TrackingDocumentFormState} from '@/lib/product-tracking-document';

export default function ProductTrackingDocuments({initialDocuments, initiallyAddDocument, addDocumentTrigger, ...props}: {
  initialDocuments: TrackingDocument[]; initiallyAddDocument?: boolean; addDocumentTrigger?: ReactElement<{disabled?: boolean}>;
  trackingId?: number; readOnly?: boolean; disabled?: boolean;
  onStateChange?: (state: TrackingDocumentFormState) => void;
}) {
  return <ProductTrackingAttachments {...props} kind="TRACKING" initialAttachments={initialDocuments} initiallyAddAttachment={initiallyAddDocument} addAttachmentTrigger={addDocumentTrigger}/>;
}
