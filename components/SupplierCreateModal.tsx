"use client";

import {type FormEvent, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import SupplierFormFields from "@/components/SupplierFormFields";
import EntityFormActions from "@/components/EntityFormActions";

type CategoryOption = {id: number; name: string; icon?: string | null};

export type CreatedSupplier = {
    id: number;
    businessName: string;
    alias?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    iban?: string | null;
    pec?: string | null;
    taxCodeSdi?: string | null;
    swift?: string | null;
    internalNotes?: string | null;
    systemRole?: string | null;
    defaultExpenseCategoryId?: number | null;
    defaultVatRate?: string | number | null;
};

type Props = {
    open: boolean;
    onClose: () => void;
    categories?: CategoryOption[];
    action?: string;
    initialBusinessName?: string;
    onCreated?: (supplier: CreatedSupplier) => void;
    context?: "page" | "nested";
};

export default function SupplierCreateModal({
    open,
    onClose,
    categories = [],
    action = "/api/suppliers",
    initialBusinessName = "",
    onCreated,
    context = "page",
}: Props) {
    const [mounted, setMounted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSaving) onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isSaving, onClose, open]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (!onCreated) return;
        event.preventDefault();
        setIsSaving(true);
        setError("");

        const formData = new FormData(event.currentTarget);
        const response = await fetch(action, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(Object.fromEntries(formData.entries())),
        }).catch(() => null);

        if (!response?.ok) {
            const payload = await response?.json().catch(() => null);
            setError(payload?.error ?? "Impossibile salvare il fornitore.");
            setIsSaving(false);
            return;
        }

        const supplier = await response.json() as CreatedSupplier;
        onCreated(supplier);
        setIsSaving(false);
        onClose();
    }

    if (!mounted || !open) return null;

    return createPortal(
        <div
            className={`modal-backdrop app-form-modal supplier-create-modal supplier-create-modal--${context}`}
            role="dialog"
            aria-modal="true"
            aria-label="Aggiungi nuovo fornitore"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) onClose();
            }}
        >
            <div className="modal-card modal-card-wide entity-form-modal-card" onMouseDown={(event) => event.stopPropagation()}>
                <div className="modal-title">
                    <div>
                        <h3>Nuovo fornitore</h3>
                        <p className="muted">Inserisci i dati del fornitore.</p>
                    </div>
                    <button className="btn btn-icon-only btn-default modal-close-button" type="button" disabled={isSaving} onClick={onClose}>×</button>
                </div>
                <form
                    className="card form app-record-form entity-form entity-styled-form inline-create-form"
                    action={action}
                    method="post"
                    onSubmit={handleSubmit}
                >
                    <SupplierFormFields
                        categories={categories}
                        supplier={{businessName: initialBusinessName}}
                    />

                    {error ? <p className="full form-error" role="alert">{error}</p> : null}
                    <EntityFormActions onCancel={onClose} submitLabel={onCreated ? "Salva e seleziona" : "Salva fornitore"} submitting={isSaving}/>
                </form>
            </div>
        </div>,
        document.body,
    );
}
