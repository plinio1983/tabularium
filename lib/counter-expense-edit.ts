import {createHash} from 'node:crypto';
import {z} from 'zod';

const money = z.number().finite().positive().max(999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Usa al massimo due decimali');
export const counterExpenseEditSchema = z.object({
  id: z.number().int().positive(), snapshot: z.string().min(1),
  amount: money, categoryId: z.number().int().positive(), description: z.string().trim().max(2000),
  isDeductible: z.boolean(), vatRate: z.number().refine(value => [0, 4, 10, 22].includes(value)),
  paymentDate: z.string().datetime(),
  payments: z.array(z.object({
    id: z.number().int().positive().optional(), amount: money, paymentDate: z.string().datetime(),
    paymentMethodId: z.number().int().positive(), bankId: z.number().int().positive().nullable()
  })).min(1)
}).superRefine((input, ctx) => {
  if (Math.round(input.amount * 100) !== input.payments.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)) {
    ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Il totale dei pagamenti deve corrispondere all’importo della spesa.'});
  }
  const ids = input.payments.flatMap(row => row.id ? [row.id] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Pagamenti duplicati.'});
});

export function counterExpenseSnapshot(expense: {updatedAt: Date; payments: unknown[]}) {
  return createHash('sha256').update(JSON.stringify({updatedAt: expense.updatedAt, payments: expense.payments})).digest('hex');
}
