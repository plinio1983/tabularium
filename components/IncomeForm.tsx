"use client";

import { useEffect, useMemo, useState } from "react";

type InitialIncome = {
  id?: number;
  salesChannel?: string | null;
  saleCategory?: string | null;
  description?: string | null;
  amount?: string | number | { toString(): string } | null;
  paymentMethod?: string | null;
  creditChannel?: string | null;
  creditDate?: string | Date | null;
  isCredited?: boolean;
  billingMonth?: number | null;
  billingYear?: number | null;
  isFiscal?: boolean;
  invoiceStatus?: string | null;
  vatRate?: string | number | { toString(): string } | null;
  notes?: string | null;
};

type Props = {
  initialIncome?: InitialIncome;
  action?: string;
  title?: string;
  submitLabel?: string;
  onCancel?: () => void;
  cancelHref?: string;
};

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().toISOString().slice(0, 7);
const salesChannels = ["Shop", "Online Shop", "Altro Canale"];
const saleCategories = ["B2C", "B2B", "Altro"];
const paymentMethods = ["Bonifico", "Carta di Debito/Credit", "Criptovaluta", "Stripe", "Cash"];
const creditChannels = ["Cash", "Unicredit", "MyTu", "Wise"];
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
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="money-input">
      <span>€</span>
      <input type="number" step="0.01" min="0" {...props} />
    </div>
  );
}

function getInitialCreditChannel(paymentMethod: string, creditChannel?: string | null) {
  if (paymentMethod === "Cash") return "Cash";
  if (!creditChannel || creditChannel === "Cash") return "Unicredit";
  return creditChannel;
}

export default function IncomeForm({
  initialIncome,
  action = "/api/incomes",
  title = "Nuovo incasso",
  submitLabel = "Salva incasso",
  onCancel,
  cancelHref,
}: Props) {
  const initialPaymentMethod = initialIncome?.paymentMethod ?? "Bonifico";
  const [amount, setAmount] = useState(normalizeMoney(initialIncome?.amount));
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [creditChannel, setCreditChannel] = useState(getInitialCreditChannel(initialPaymentMethod, initialIncome?.creditChannel));
  const [isCredited, setIsCredited] = useState(initialIncome?.isCredited ?? true);
  const [isFiscal, setIsFiscal] = useState(initialIncome?.isFiscal ?? true);
  const [vatRate, setVatRate] = useState(normalizeMoney(initialIncome?.vatRate) || "22");
  const amountValue = Number(amount || 0);
  const activeVatRate = isFiscal ? Number(vatRate || 0) : 0;
  const netAmount = useMemo(() => activeVatRate > 0 ? amountValue / (1 + activeVatRate / 100) : amountValue, [amountValue, activeVatRate]);

  useEffect(() => {
    if (paymentMethod === "Cash") {
      if (creditChannel !== "Cash") setCreditChannel("Cash");
      return;
    }
    if (creditChannel === "Cash") setCreditChannel("Unicredit");
  }, [paymentMethod, creditChannel]);

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
            <select name="salesChannel" defaultValue={initialIncome?.salesChannel ?? "Shop"} required>
              {salesChannels.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label>
            Categoria vendita
            <select name="saleCategory" defaultValue={initialIncome?.saleCategory ?? "B2C"} required>
              {saleCategories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="full">
            Descrizione
            <input name="description" defaultValue={initialIncome?.description ?? ""} placeholder="Descrizione dell'incasso" />
          </label>

          <div className="amount-vat-row full income-amount-vat-row">
            <label className="income-amount-field">
              Importo IVA inclusa
              <div className="income-amount-row">
                <MoneyInput name="amount" required value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
              </div>
            </label>

            <label>
              IVA
              <select name="vatRate" value={isFiscal ? vatRate : "0"} onChange={(event) => setVatRate(event.target.value)} disabled={!isFiscal}>
                {vatRates.map(value => <option key={value} value={value}>{value}%</option>)}
              </select>
              {!isFiscal && <input type="hidden" name="vatRate" value="0" />}
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
          <label>
            Data accredito
            <input type="date" name="creditDate" required defaultValue={toDateInput(initialIncome?.creditDate) || today} />
          </label>

          <label>
            <div className="toggle-field switch-toggle-field">
              <span>Accreditato</span>
              <input type="hidden" name="isCredited" value="false" />
              <label className="switch">
                <input
                  type="checkbox"
                  name="isCredited"
                  value="true"
                  checked={isCredited}
                  onChange={(event) => setIsCredited(event.currentTarget.checked)}
                />
                <span className="slider" />
                <span>{isCredited ? "Si" : "No"}</span>
              </label>
            </div>
          </label>

          <label>
            Metodo di pagamento
            <select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.currentTarget.value)} required>
              {paymentMethods.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label>
            Canale di accredito
            <select name="creditChannel" value={paymentMethod === "Cash" ? "Cash" : creditChannel} onChange={(event) => setCreditChannel(event.currentTarget.value)} disabled={paymentMethod === "Cash"} required>
              {creditChannels.map(value => (
                <option key={value} value={value} disabled={paymentMethod !== "Cash" && value === "Cash"}>{value}</option>
              ))}
            </select>
            {paymentMethod === "Cash" && <input type="hidden" name="creditChannel" value="Cash" />}
          </label>
        </div>
      </details>

      <details className="form-section full income-form-section" open>
        <summary>
          <span>Fiscale</span>
          <small>Fiscalità, fattura e aliquota IVA</small>
        </summary>
        <div className="form-section-grid income-form-section-grid">
          <div className="toggle-field-wrap full">
            <div className="toggle-field switch-toggle-field">
              <span>Fiscale</span>
              <input type="hidden" name="isFiscal" value="false" />
              <label className="switch">
                <input
                  type="checkbox"
                  name="isFiscal"
                  value="true"
                  checked={isFiscal}
                  onChange={(event) => toggleFiscal(event.currentTarget.checked)}
                />
                <span className="slider" />
                <span>{isFiscal ? "Si" : "No"}</span>
              </label>
            </div>
          </div>

          <label>
            Stato fattura
            <select name="invoiceStatus" defaultValue={initialIncome?.invoiceStatus ?? "NON_INVIATA"} disabled={!isFiscal}>
              <option value="NON_INVIATA">Non inviata</option>
              <option value="EMESSA">Emessa</option>
            </select>
            {!isFiscal && <input type="hidden" name="invoiceStatus" value="" />}
          </label>

          <label>
            Periodo Contabile
            <input type="month" name="billingPeriod" required defaultValue={toMonthInput(initialIncome)} />
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
            <textarea name="notes" rows={3} defaultValue={initialIncome?.notes ?? ""} placeholder="Note interne opzionali" />
          </label>
        </div>
      </details>

      <div className="actions-row full form-actions-row form-sticky-actions">
        <button className="button-standard" type="submit"><span className="btn-icon">✓</span> {submitLabel}</button>
        {onCancel ? (
          <button className="secondary-button button-standard" type="button" onClick={onCancel}><span className="btn-icon">×</span> Annulla</button>
        ) : (
          <a className="secondary-button button-standard" href={cancelHref ?? "/incomes"}><span className="btn-icon">×</span> Annulla</a>
        )}
      </div>
    </form>
  );
}
