const MAX_CENTS = 999_999_999_999;

export function currencyValueToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).trim().replace(/\s/g, "").replace("€", "");
  const decimalSeparator = normalized.lastIndexOf(",") >= 0 ? "," : ".";
  const [integerPart = "0", decimalPart = ""] = normalized.split(decimalSeparator);
  const integer = Number(integerPart.replace(/[^\d]/g, "")) || 0;
  const decimals = decimalPart.replace(/[^\d]/g, "").padEnd(2, "0").slice(0, 2);
  return Math.min(MAX_CENTS, integer * 100 + Number(decimals || 0));
}

export function formatCurrencyInput(value: string | number | null | undefined) {
  const cents = currencyValueToCents(value);
  const integer = Math.floor(cents / 100);
  const decimals = String(cents % 100).padStart(2, "0");
  return `${integer},${decimals}`;
}

export function applyCurrencyInputKey(
  value: string | number | null | undefined,
  key: string,
) {
  const cents = currencyValueToCents(value);
  if (/^\d$/.test(key)) {
    return formatCurrencyInput(Math.min(MAX_CENTS, cents * 10 + Number(key)) / 100);
  }
  if (key === "backspace") {
    return formatCurrencyInput(Math.floor(cents / 10) / 100);
  }
  if (key === "," || key === ".") {
    return formatCurrencyInput(Math.min(MAX_CENTS, cents * 100) / 100);
  }
  return formatCurrencyInput(value);
}

export type CurrencyInputKeyState = {
  separatorDigits: 0 | 1 | null;
};

export function applyCurrencyInputKeyWithState(
  value: string | number | null | undefined,
  key: string,
  state: CurrencyInputKeyState,
) {
  const cents = currencyValueToCents(value);

  if (key === "," || key === ".") {
    state.separatorDigits = 0;
    return formatCurrencyInput(Math.min(MAX_CENTS, cents * 100) / 100);
  }

  if (/^\d$/.test(key) && state.separatorDigits !== null) {
    const integerCents = Math.floor(cents / 100) * 100;
    if (state.separatorDigits === 0) {
      state.separatorDigits = 1;
      return formatCurrencyInput((integerCents + Number(key)) / 100);
    }

    state.separatorDigits = null;
    return formatCurrencyInput((integerCents + (cents % 10) * 10 + Number(key)) / 100);
  }

  state.separatorDigits = null;
  return applyCurrencyInputKey(value, key);
}

export function currencyInputToNumber(value: string | number | null | undefined) {
  return currencyValueToCents(value) / 100;
}
