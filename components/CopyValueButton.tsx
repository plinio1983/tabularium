"use client";

import {useState} from "react";

export default function CopyValueButton({value}: {value: string}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      window.alert("Impossibile copiare il valore.");
    }
  }

  return <button
    type="button"
    className="copy-value-button"
    title={copied ? "Valore copiato" : "Copia valore"}
    aria-label={copied ? "Valore copiato" : "Copia valore"}
    onClick={copyValue}
    disabled={!value}
  >{copied ? "✓" : "⧉"}</button>;
}
