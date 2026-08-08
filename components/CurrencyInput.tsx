'use client';

import { forwardRef, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent, useRef } from "react";
import { applyCurrencyInputKeyWithState, formatCurrencyInput } from "@/lib/currency-input";

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: string | number;
  onValueChange: (value: string) => void;
  suppressSoftKeyboard?: boolean;
};

function moveCaretToEnd(input: HTMLInputElement) {
  window.requestAnimationFrame(() => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

function isMobileTouchInput() {
  return window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, suppressSoftKeyboard = false, onKeyDown, onFocus, onClick, onPaste, onPointerDown, ...props },
  ref,
) {
  const keyStateRef = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});

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
    onValueChange(applyCurrencyInputKeyWithState(value, key, keyStateRef.current));
    moveCaretToEnd(event.currentTarget);
  }

  function handlePointerDown(event: PointerEvent<HTMLInputElement>) {
    onPointerDown?.(event);
    if (!event.defaultPrevented && suppressSoftKeyboard && event.pointerType === "touch" && isMobileTouchInput()) {
      event.preventDefault();
    }
  }

  return <input
    {...props}
    ref={ref}
    type="text"
    inputMode={suppressSoftKeyboard ? "none" : "decimal"}
    value={formatCurrencyInput(value)}
    onChange={event => {
      keyStateRef.current.separatorDigits = null;
      onValueChange(formatCurrencyInput(event.currentTarget.value));
      moveCaretToEnd(event.currentTarget);
    }}
    onKeyDown={handleKeyDown}
    onFocus={event => {
      if (suppressSoftKeyboard && isMobileTouchInput()) {
        event.currentTarget.blur();
        return;
      }
      onFocus?.(event);
      moveCaretToEnd(event.currentTarget);
    }}
    onPointerDown={handlePointerDown}
    onClick={event => {
      onClick?.(event);
      moveCaretToEnd(event.currentTarget);
    }}
    onPaste={event => {
      onPaste?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      keyStateRef.current.separatorDigits = null;
      onValueChange(formatCurrencyInput(event.clipboardData.getData("text")));
      moveCaretToEnd(event.currentTarget);
    }}
  />;
});
