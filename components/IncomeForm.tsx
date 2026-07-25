"use client";

import {useEffect, useMemo, useState} from "react";
import CustomerAutocomplete from '@/components/CustomerAutocomplete';

type InitialIncome = {
    id?: number;
    customerId?: number | null;
    salesChannelId?: number;
    incomeCategoryId?: number;
    description?: string | null;
    amount?: string | number | { toString(): string } | null;
    paymentMethodId?: number | null;
    creditBankId?: number | null;
    creditDate?: string | Date | null;
    isCredited?: boolean;
    billingMonth?: number | null;
    billingYear?: number | null;
    isFiscal?: boolean;
    invoiceStatus?: string | null;
    vatRate?: string | number | { toString(): string } | null;
    notes?: string | null;
};

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null };
type PaymentMethodOption = Option & { kind?: string };
type IncomeEntityOption = { id: number; code: string; name: string; icon?: string | null };
type CustomerOption = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };

type Props = {
    initialIncome?: InitialIncome;
    action?: string;
    title?: string;
    submitLabel?: string;
    onCancel?: () => void;
    cancelHref?: string;
    banks: Option[];
    paymentMethods: PaymentMethodOption[];
    incomeCategories: IncomeEntityOption[];
    salesChannels: IncomeEntityOption[];
    customers: CustomerOption[];
};

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().toISOString().slice(0, 7);
const vatRates = ["0", "4", "10", "22"];

function toDateInput(value?: string | Date | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toMonthInput(income?: InitialIncome) {
    if (income?.billingMonth && income?.billingYear) {
        return `${income.billingYear}-${String(income.billingMonth).padStart(2, "0")}`;
    }
    return currentMonth;
}

function normalizeMoney(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value).replace(",", ".");
}

function formatEuro(value: number) {
    return new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR"}).format(value || 0);
}

function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="money-input">
            <span>€</span>
            <input type="number" step="0.01" min="0" {...props} />
        </div>
    );
}

function findOptionId(options: Option[], id?: number | null) {
    if (id && options.some(option => option.id === id)) return String(id);
    return "";
}

function isCashMethod(method?: Option) {
    return method?.name.trim().toLowerCase() === "cash";
}

export default function IncomeForm({
                                       initialIncome,
                                       action = "/api/incomes",
                                       title = "Nuovo incasso",
                                       submitLabel = "Salva incasso",
                                       onCancel,
                                       cancelHref,
                                       banks,
                                       paymentMethods,
                                       incomeCategories,
                                       salesChannels,
                                       customers,
                                   }: Props) {
    const fallbackBank = banks.find(bank => bank.isFallback) ?? banks.find(bank => bank.name.toLowerCase().includes("altra")) ?? banks[0];
    const defaultPaymentMethod = paymentMethods.find(method => method.name === "Bonifico") ?? paymentMethods[0];
    const initialPaymentMethodId = findOptionId(paymentMethods, initialIncome?.paymentMethodId) || (defaultPaymentMethod ? String(defaultPaymentMethod.id) : "");
    const initialCreditBankId = findOptionId(banks, initialIncome?.creditBankId) || (fallbackBank ? String(fallbackBank.id) : "");
    const initialSalesChannelId = initialIncome?.salesChannelId ? String(initialIncome.salesChannelId) : String(salesChannels[0]?.id ?? "");
    const initialIncomeCategoryId = initialIncome?.incomeCategoryId ? String(initialIncome.incomeCategoryId) : String(incomeCategories[0]?.id ?? "");
    const [amount, setAmount] = useState(normalizeMoney(initialIncome?.amount));
    const [paymentMethodId, setPaymentMethodId] = useState(initialPaymentMethodId);
    const [creditBankId, setCreditBankId] = useState(initialCreditBankId);
    const [isCredited, setIsCredited] = useState(initialIncome?.isCredited ?? true);
    const [isFiscal, setIsFiscal] = useState(initialIncome?.isFiscal ?? true);
    const [vatRate, setVatRate] = useState(normalizeMoney(initialIncome?.vatRate) || "22");
    const amountValue = Number(amount || 0);
    const activeVatRate = isFiscal ? Number(vatRate || 0) : 0;
    const netAmount = useMemo(() => activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue, [amountValue, activeVatRate]);

    const selectedPaymentMethod = paymentMethods.find(method => String(method.id) === paymentMethodId);
    const cashPaymentSelected = isCashMethod(selectedPaymentMethod);

    useEffect(() => {
        if (cashPaymentSelected && fallbackBank && creditBankId !== String(fallbackBank.id)) {
            setCreditBankId(String(fallbackBank.id));
        }
    }, [cashPaymentSelected, fallbackBank, creditBankId]);

    function toggleFiscal(nextValue: boolean) {
        setIsFiscal(nextValue);
        if (!nextValue) setVatRate("0");
        else if (vatRate === "0") setVatRate("22");
    }

    return (
        <form className="card form income-form expense-form" action={action} method="post">
            {/*<h2 className="full">{title}</h2>*/}

            <details className="form-section full income-form-section" open>
                <summary>
                    <span>Documento</span>
                    <small>Dati principali dell'incasso</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">
                    <label>
                        Canale di vendita
                        <select name="salesChannelId" defaultValue={initialSalesChannelId} required>
                            {salesChannels.map(option =>
                                <option key={option.id} value={option.id}>{option.icon ? `${option.icon} ` : ''}{option.name}</option>)}
                        </select>
                    </label>

                    <label>
                        Categoria vendita
                        <select name="incomeCategoryId" defaultValue={initialIncomeCategoryId} required>
                            {incomeCategories.map(option =>
                                <option key={option.id} value={option.id}>{option.icon ? `${option.icon} ` : ''}{option.name}</option>)}
                        </select>
                    </label>

                    <CustomerAutocomplete customers={customers} initialCustomerId={initialIncome?.customerId}/>

                    <label className="full">
                        Descrizione
                        <input name="description" defaultValue={initialIncome?.description ?? ""} placeholder="Descrizione dell'incasso"/>
                    </label>

                    <div className="amount-vat-row full income-amount-vat-row">
                        <label className="income-amount-field">
                            Importo IVA inclusa
                            <div className="income-amount-row">
                                <MoneyInput name="amount" required value={amount} onChange={(event) => setAmount(event.currentTarget.value)}/>
                            </div>
                        </label>

                        <label>
                            IVA
                            <select name="vatRate" value={isFiscal ? vatRate : "0"} onChange={(event) => setVatRate(event.target.value)} disabled={!isFiscal}>
                                {vatRates.map(value => <option key={value} value={value}>{value}%</option>)}
                            </select>
                            {!isFiscal && <input type="hidden" name="vatRate" value="0"/>}
                        </label>

                        <label>
                            <span>IVA esclusa</span>
                            <span className="net-amount-inline"><strong>{formatEuro(netAmount)}</strong></span>
                        </label>

                    </div>
                </div>
            </details>

            <details className="form-section full income-form-section" open>
                <summary>
                    <span>Pagamento</span>
                    <small>Metodo, accredito e conto di destinazione</small>
                </summary>
                <div className="form-section-grid income-form-section-grid">

                    <div className="income-form-section-credit">
                        <label>Accreditato</label>
                        <input type="hidden" name="isCredited" value="false"/>
                        <label className="switch">
                            <input
                                type="checkbox"
                                name="isCredited"
                                value="true"
                                checked={isCredited}
                                onChange={(event) => setIsCredited(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span>{isCredited ? "Si" : "No"}</span>
                        </label>
                    </div>

                    <label>
                        Data accredito
                        <input type="date" name="creditDate" required defaultValue={toDateInput(initialIncome?.creditDate) || today}/>
                    </label>

                    <label>
                        Metodo di accredito
                        <select name="paymentMethodId" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.currentTarget.value)} required>
                            {paymentMethods.map(method =>
                                <option key={method.id} value={method.id}>{method.icon ?? '  •  '} {method.name}</option>)}
                        </select>
                    </label>

                    <label>
                        Canale accr.
                        <select name="creditBankId" value={cashPaymentSelected && fallbackBank ? String(fallbackBank.id) : creditBankId} onChange={(event) => setCreditBankId(event.currentTarget.value)} disabled={cashPaymentSelected} required>
                            {banks.map(bank => (
                                <option key={bank.id} value={bank.id}>{bank.icon ?? '  •  '} {bank.name}</option>
                            ))}
                        </select>
                        {cashPaymentSelected && fallbackBank ?
                            <input type="hidden" name="creditBankId" value={fallbackBank.id}/> : null}
                    </label>
                </div>
            </details>

            <details className="form-section full income-form-section" open>
                <summary>
                    <span>Fiscale</span>
                    <small>Fiscalità, fattura e aliquota IVA</small>
                </summary>
                <div className="form-section-grid income-form-section-grid income-form-section-fiscal">
                    {/*<div className="toggle-field-wrap">*/}
                    <div className="toggle-field switch-toggle-field fiscal-toggle">
                        <label>Fiscale</label>
                        <input type="hidden" name="isFiscal" value="false"/>
                        <label className="switch">
                            <input
                                type="checkbox"
                                name="isFiscal"
                                value="true"
                                checked={isFiscal}
                                onChange={(event) => toggleFiscal(event.currentTarget.checked)}
                            />
                            <span className="slider"/>
                            <span>{isFiscal ? "Si" : "No"}</span>
                        </label>
                    </div>
                    {/*</div>*/}

                    <label>
                        Stato fattura
                        <select name="invoiceStatus" defaultValue={initialIncome?.invoiceStatus ?? "NON_INVIATA"} disabled={!isFiscal}>
                            <option value="NON_INVIATA">Non inviata</option>
                            <option value="EMESSA">Emessa</option>
                        </select>
                        {!isFiscal && <input type="hidden" name="invoiceStatus" value=""/>}
                    </label>

                    <label>
                        Periodo Contabile
                        <input type="month" name="billingPeriod" required defaultValue={toMonthInput(initialIncome)}/>
                    </label>

                </div>
            </details>

            <details className="form-section full income-form-section">
                <summary>
                    <span>Note</span>
                    <small>Note interne opzionali</small>
                </summary>
                <div className="form-section-stack income-form-section-stack">
                    <label className="full">
                        Note
                        <textarea name="notes" rows={3} defaultValue={initialIncome?.notes ?? ""} placeholder="Note interne opzionali"/>
                    </label>
                </div>
            </details>

            <div className="actions-row full form-actions-row form-sticky-actions">
                <button className="btn btn-md btn-primary" type="submit">
                    <span className="btn-icon">✓</span> {submitLabel}</button>
                {onCancel ? (
                    <button className="btn btn-md btn-default" type="button" onClick={onCancel}>
                        <span className="btn-icon">×</span> Annulla</button>
                ) : (
                    <a className="btn btn-md btn-default" href={cancelHref ?? "/incomes"}><span className="btn-icon">×</span> Annulla</a>
                )}
            </div>
        </form>
    );
}
