import type {Prisma} from '@/generated/prisma/client';
import {resolveReceiptPeriod} from './receipt-period';
import {addCalendarDays, dateInputInTimeZone, zonedMidnightUtc} from './company-time';

/** Shared by the displayed list and its complete CSV export. */
export function receiptSearchWhere(workspaceId: number, companyId: number, timeZone: string, params: Record<string, string | string[] | undefined>, now = new Date()): Prisma.IncomeWhereInput {
  const value = (key: string) => {const item = params[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? '';};
  const period = resolveReceiptPeriod(params, dateInputInTimeZone(timeZone, now));
  const search = value('search').trim();
  const methodId = Number(value('paymentMethodId')) || null;
  const channelId = Number(value('salesChannelId')) || null;
  const fiscal = value('fiscal');
  return {
    workspaceId, companyId, incomeType: 'CASH_REGISTER',
    ...(search ? {description: {contains: search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive'}} : {}),
    creditDate: {gte: zonedMidnightUtc(period.from, timeZone), lt: zonedMidnightUtc(addCalendarDays(period.to, 1), timeZone)},
    ...(methodId ? {paymentMethodId: methodId} : {}),
    ...(channelId ? {salesChannelId: channelId} : {}),
    ...(fiscal === 'yes' ? {isFiscal: true} : fiscal === 'no' ? {OR: [{isFiscal: false}, {receiptLines: {some: {isFiscal: false}}}]} : fiscal === 'mixed' ? {receiptLines: {some: {isFiscal: false}}, isFiscal: true} : {}),
  };
}
