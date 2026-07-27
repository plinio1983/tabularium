'use client';

import { forwardRef, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { applyCurrencyInputKey, formatCurrencyInput } from "@/lib/currency-input";

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: string | number;
  onValueChange: (value: string) => void;
};

function moveCaretToEnd(input: HTMLInputElement) {
  window.requestAnimationFrame(() => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, onKeyDown, onFocus, onClick, onPaste, ...props },
  ref,
) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (["ArrowLeft", "ArrowRight", "Home", "End", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      moveCaretToEnd(event.currentTarget);
      return;
    }
    const key = event.key === "Backspace" || event.key === "Delete" ? "backspace" : event.key;
    if (!/^\d$/.test(key) && key !== "backspace" && key !== "," && key !== ".") return;
    event.preventDefault();
    onValueChange(applyCurrencyInputKey(value, key));
    moveCaretToEnd(event.currentTarget);
  }

  return <input
    {...props}
    ref={ref}
    type="text"
    inputMode="decimal"
    value={formatCurrencyInput(value)}
    onChange={event => {
      onValueChange(formatCurrencyInput(event.currentTarget.value));
      moveCaretToEnd(event.currentTarget);
    }}
    onKeyDown={handleKeyDown}
    onFocus={event => {
      onFocus?.(event);
      moveCaretToEnd(event.currentTarget);
    }}
    onClick={event => {
      onClick?.(event);
      moveCaretToEnd(event.currentTarget);
    }}
    onPaste={event => {
      onPaste?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      onValueChange(formatCurrencyInput(event.clipboardData.getData("text")));
      moveCaretToEnd(event.currentTarget);
    }}
  />;
});
