import {z} from 'zod';

// Money inputs display Italian decimals; empty optional amounts remain absent.
export const OptionalPayrollMoneyFromForm = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.replace(',', '.');
}, z.coerce.number({invalid_type_error: 'Inserisci un importo valido.'})
  .finite('Inserisci un importo finito.')
  .nonnegative('L’importo non può essere negativo.')
  .optional().nullable());
