"use client";

export type IncomeCreationType = "single" | "recurring";

export default function IncomeTypeChoice({selected, onSelect, onSelectCounter, disabled = false, className = ""}: {
    selected: IncomeCreationType;
    onSelect?: (type: IncomeCreationType) => void;
    onSelectCounter?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return <div className={`entry-type-choice full ${className}`.trim()}>
        <span className="entry-type-choice-title">Tipo di incasso</span>
        <div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di incasso">
            <button type="button" className={selected === "single" ? "is-selected" : ""} role="radio" aria-checked={selected === "single"} disabled={disabled || (!onSelect && selected !== "single")} onClick={() => onSelect?.("single")}>
                <span aria-hidden="true">●</span><strong>Incasso<br/>singolo</strong><small>Entrata occasionale</small>
            </button>
            <button type="button" className={selected === "recurring" ? "is-selected" : ""} role="radio" aria-checked={selected === "recurring"} disabled={disabled || (!onSelect && selected !== "recurring")} onClick={() => onSelect?.("recurring")}>
                <span aria-hidden="true">↻</span><strong>Entrata<br/>ricorrente</strong><small>Entrata periodica</small>
            </button>
            <button type="button" disabled={disabled || !onSelectCounter} onClick={onSelectCounter}>
                <span aria-hidden="true">🧮</span><strong>Incasso da banco</strong><small>Inserimento scontrini</small>
            </button>
        </div>
    </div>;
}
