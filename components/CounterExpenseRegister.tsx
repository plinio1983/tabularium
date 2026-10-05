"use client";

import Link from 'next/link';
import CounterExpenseForm from './CounterExpenseForm';

type Props = {
  initialDate: string;
  categories: Array<{id: number; code: string; name: string; icon: string | null}>;
  methods: Array<{id: number; name: string; icon: string | null; systemRole: string | null; isExpenseDefault?: boolean; cashRegisterDefaultBankId?: number | null}>;
  banks: Array<{id: number; name: string; icon: string | null; isPrimary: boolean; isFallback?: boolean}>;
};

export default function CounterExpenseRegister({initialDate, categories, methods, banks}: Props) {
  return <div className="card">
    <div className="modal-title"><h2>Spesa da banco</h2><Link data-page-transition="backward" className="btn btn-neutral btn-icon-only modal-close-button" href="/expenses" aria-label="Torna alle spese"><span className="btn-icon">×</span></Link></div>
    <CounterExpenseForm initialDate={initialDate} categories={categories} banks={banks} paymentMethods={methods}/>
  </div>;
}
