'use client';

import { forwardRef, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { applyCurrencyInputKeyWithState, formatCurrencyInput, resetCurrencyInput } from "@/lib/currency-input";

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> & {
  value: string | number;
  onValueChange: (value: string) => void;
  suppressSoftKeyboard?: boolean;
  clearable?: boolean;
  onClear?: () => void;
};

function moveCaretToEnd(input: HTMLInputElement) {
  window.requestAnimationFrame(() => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

const internalKeypadMediaQuery = "(max-width: 900px) and (pointer: coarse)";

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, suppressSoftKeyboard = false, clearable = false, onClear, onKeyDown, onFocus, onClick, onPaste, onPointerDown, ...props },
  ref,
) {
  const keyStateRef = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});
  const [isInternalKeypadDevice, setIsInternalKeypadDevice] = useState(false);
  const useInternalKeypad = suppressSoftKeyboard && isInternalKeypadDevice;

  useEffect(() => {
    const mediaQuery = window.matchMedia(internalKeypadMediaQuery);
    const update = () => setIsInternalKeypadDevice(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

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
    if (!event.defaultPrevented && useInternalKeypad && event.pointerType === "touch") {
      event.preventDefault();
    }
  }

  return <>
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={useInternalKeypad ? "none" : "decimal"}
      value={formatCurrencyInput(value)}
      onChange={event => {
        keyStateRef.current.separatorDigits = null;
        onValueChange(formatCurrencyInput(event.currentTarget.value));
        moveCaretToEnd(event.currentTarget);
      }}
      onKeyDown={handleKeyDown}
      onFocus={event => {
        if (useInternalKeypad) {
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
    />
    {clearable ? <button
      type="button"
      className="amount-clear-button"
      aria-label="Azzera importo"
      disabled={props.disabled}
      onPointerDown={event => event.preventDefault()}
      onClick={event => {
        onValueChange(resetCurrencyInput(keyStateRef.current));
        onClear?.();
        const input = event.currentTarget.previousElementSibling;
        if (input instanceof HTMLInputElement) input.focus({preventScroll: true});
      }}
    >×</button> : null}
  </>;
});
