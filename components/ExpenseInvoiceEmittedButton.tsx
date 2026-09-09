'use client';

import {useState} from 'react';

export default function ExpenseInvoiceEmittedButton({action}: {action: string}) {
  const [submitting, setSubmitting] = useState(false);

  return <form className="expense-invoice-quick-action" action={action} method="post" onSubmit={event => {
    if (submitting) {
      event.preventDefault();
      return;
    }
    setSubmitting(true);
  }}>
    <input type="hidden" name="_action" value="invoice_emitted"/>
    <button className="btn btn-sm btn-default" type="submit" disabled={submitting}>
      {submitting ? 'Salvataggio…' : '✓ Segna fattura emessa'}
    </button>
  </form>;
}
