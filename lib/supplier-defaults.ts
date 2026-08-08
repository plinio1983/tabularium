export const supplierDefaultVatRates = [0, 4, 10, 22] as const;

export function isSupplierDefaultVatRate(value: number) {
  return supplierDefaultVatRates.includes(value as typeof supplierDefaultVatRates[number]);
}

export function resolveSupplierDefaultVatRate({
  currentVatRate,
  supplierDefaultVatRate,
  vatRateTouched,
  isFiscal,
  supportsVat = true,
}: {
  currentVatRate: string;
  supplierDefaultVatRate: unknown;
  vatRateTouched: boolean;
  isFiscal: boolean;
  supportsVat?: boolean;
}) {
  if (vatRateTouched || !isFiscal || !supportsVat || supplierDefaultVatRate == null) return currentVatRate;
  const value = Number(supplierDefaultVatRate);
  return isSupplierDefaultVatRate(value) ? String(value) : currentVatRate;
}
