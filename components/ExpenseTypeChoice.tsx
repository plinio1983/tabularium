"use client";

export type ExpenseCreationType = "counter" | "single" | "recurring" | "vat" | "tax" | "payroll";

type Props = {
    selected?: ExpenseCreationType;
    onSelect?: (type: ExpenseCreationType) => void;
    onSelectCounter?: () => void;
    availableTypes?: ExpenseCreationType[];
    showCounter?: boolean;
    disabled?: boolean;
    disabledTypes?: ExpenseCreationType[];
    className?: string;
    title?: string;
};

const options: Array<{type: ExpenseCreationType; icon: string; label: string; description: string}> = [
    {type: "single", icon: "●", label: "Singola", description: "Spesa occasionale"},
    {type: "vat", icon: "IVA", label: "Saldo IVA", description: "Versamento IVA"},
    {type: "tax", icon: "F24", label: "Imposte", description: "Imposte e contributi non IVA"},
    {type: "payroll", icon: "BP", label: "Busta paga", description: "Retribuzione dipendente"},
];

export default function ExpenseTypeChoice({
    selected,
    availableTypes,
    showCounter = true,
    onSelect,
    onSelectCounter,
    disabled = false,
    disabledTypes = [],
    className = "",
    title = "Tipo di spesa",
}: Props) {
    return <div className={`entry-type-choice full ${className}`.trim()}>
        <span className="entry-type-choice-title">{title}</span>
        <div className="entry-type-choice-grid" role="radiogroup" aria-label="Tipo di spesa">
            {options.slice(0, 1).filter(option => !availableTypes || availableTypes.includes(option.type)).map(option => <TypeButton key={option.type} option={option} selected={selected} disabled={disabled || disabledTypes.includes(option.type) || (!onSelect && selected !== option.type)} onSelect={onSelect}/>) }
            {showCounter ? <button type="button" role="radio" aria-checked={selected === "counter"} className={selected === "counter" ? "is-selected" : ""} disabled={disabled || !onSelectCounter} onClick={onSelectCounter}>
                <span className="btn-icon" aria-hidden="true">🛍️</span><strong>Da banco</strong><small>Acquisto già pagato</small>
            </button> : null}
            {options.slice(1).filter(option => !availableTypes || availableTypes.includes(option.type)).map(option => <TypeButton key={option.type} option={option} selected={selected} disabled={disabled || disabledTypes.includes(option.type) || (!onSelect && selected !== option.type)} onSelect={onSelect}/>) }
        </div>
    </div>;
}

function TypeButton({option, selected, disabled, onSelect}: {
    option: {type: ExpenseCreationType; icon: string; label: string; description: string};
    selected?: ExpenseCreationType;
    disabled: boolean;
    onSelect?: (type: ExpenseCreationType) => void;
}) {
    const isSelected = selected === option.type;
    return <button type="button" role="radio" aria-checked={isSelected} className={isSelected ? "is-selected" : ""} disabled={disabled} onClick={() => onSelect?.(option.type)}>
        <span className="btn-icon" aria-hidden="true">{option.icon}</span><strong>{option.label}</strong><small>{option.description}</small>
    </button>;
}
