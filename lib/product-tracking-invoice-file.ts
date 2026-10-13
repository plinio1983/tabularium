import {saveExpenseAttachmentFiles} from '@/lib/attachments';
import {TrackingValidationError} from '@/lib/product-tracking';

export async function saveTrackingInvoiceFile(entries: FormDataEntryValue[], required: boolean) {
  if (!entries.length && !required) return null;
  if (entries.length !== 1 || !(entries[0] instanceof File) || !entries[0].size) {
    throw new TrackingValidationError('Seleziona un solo documento non vuoto.');
  }
  const [saved] = await saveExpenseAttachmentFiles(entries);
  const {type: _type, ...metadata} = saved;
  return metadata;
}
