import {z} from 'zod';

const id = z.coerce.number().int().positive();
const cadence = z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']);
const billingMode = z.enum(['SAME_MONTH', 'NEXT_MONTH', 'CUSTOM_MONTH']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

type BulkEditData = {
  salesChannelId?: number;
  cadence?: string;
  startDate?: Date;
  billingPeriodMode?: string;
  billingMonth?: number | null;
  isAutomaticCredit?: boolean;
  paymentMethodId?: number | null;
  bankId?: number | null;
  creditDay?: number;
};

// Only explicitly enabled fields contribute to the update; hidden/stale values are ignored.
export function parseRecurringIncomeBulkEdit(form: FormData): BulkEditData {
  const group = z.enum(['salesChannelId', 'schedule', 'credit']).parse(form.get('field'));
  const enabled = (name: string) => ['on', 'true', '1'].includes(String(form.get(name)));
  const data: BulkEditData = {};
  if (group === 'salesChannelId') data.salesChannelId = id.parse(form.get('salesChannelId'));
  if (group === 'schedule') {
    if (enabled('updateCadence')) data.cadence = cadence.parse(form.get('cadence'));
    if (enabled('updateStartDate')) data.startDate = new Date(date.parse(form.get('startDate')));
    if (enabled('updateBilling')) {
      data.billingPeriodMode = billingMode.parse(form.get('billingPeriodMode'));
      data.billingMonth = data.billingPeriodMode === 'CUSTOM_MONTH'
        ? z.coerce.number().int().min(1).max(12).parse(form.get('billingMonth')) : null;
    }
  }
  if (group === 'credit') {
    if (enabled('updateCredit')) {
      data.isAutomaticCredit = z.enum(['true', 'false']).parse(form.get('isAutomaticCredit')) === 'true';
      data.paymentMethodId = data.isAutomaticCredit ? id.parse(form.get('paymentMethodId')) : null;
      data.bankId = data.isAutomaticCredit ? id.parse(form.get('bankId')) : null;
    }
    if (enabled('updateCreditDay')) data.creditDay = z.coerce.number().int().min(1).max(30).parse(form.get('creditDay'));
  }
  if (!Object.keys(data).length) throw new Error('Seleziona almeno un campo da modificare');
  return data;
}
