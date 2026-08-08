import {z} from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null);
const optionalDate = z.preprocess(
  value => value === '' || value == null ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
);

export const employeeInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  taxCode: optionalText(32),
  employeeCode: optionalText(40),
  email: z.string().trim().max(160).optional().transform(value => value || null).refine(value => !value || z.string().email().safeParse(value).success, 'Email non valida'),
  phone: optionalText(40),
  iban: optionalText(64),
  hiredAt: optionalDate,
  terminatedAt: optionalDate,
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  internalNotes: optionalText(2000)
}).superRefine((value, context) => {
  if (value.hiredAt && value.terminatedAt && value.terminatedAt < value.hiredAt) {
    context.addIssue({code: 'custom', path: ['terminatedAt'], message: 'La cessazione non può precedere l’assunzione'});
  }
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export function employeePersistenceData(input: EmployeeInput) {
  return {
    ...input,
    hiredAt: input.hiredAt ? new Date(`${input.hiredAt}T00:00:00.000Z`) : null,
    terminatedAt: input.terminatedAt ? new Date(`${input.terminatedAt}T00:00:00.000Z`) : null
  };
}

export function employeeDisplayName(employee: {firstName: string; lastName: string}) {
  return `${employee.lastName} ${employee.firstName}`.trim();
}
