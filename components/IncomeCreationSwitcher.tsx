'use client';

import { useState } from 'react';
import IncomeForm from '@/components/IncomeForm';
import RecurringIncomeForm from '@/components/RecurringIncomeForm';

type Option = { id: number; name: string; icon?: string | null; isFallback?: boolean | null; isPrimary?: boolean; kind?: string; isIncomeDefault?: boolean };
type Entity = { id: number; code: string; name: string; icon?: string | null; isDefault?: boolean; isFallback?: boolean };
type Customer = { id: number; businessName: string; alias?: string | null; systemRole?: string | null };
type Props = {
  banks: Option[]; paymentMethods: Option[]; salesChannels: Entity[]; customers: Customer[];
  incomeAction: string; recurringAction: string; initialIncome?: Parameters<typeof IncomeForm>[0]['initialIncome'];
  initialType?: 'single' | 'recurring'; onCancel?: () => void; cancelHref?: string; title?: string; submitLabel?: string;
  onTypeChange?: (type: 'single' | 'recurring') => void;
};

export default function IncomeCreationSwitcher(props: Props) {
  const [type, setType] = useState<'single' | 'recurring'>(props.initialType ?? 'single');
  if (type === 'recurring') return <RecurringIncomeForm action={props.recurringAction} cancelHref={props.cancelHref ?? '/incomes'} onCancel={props.onCancel} channels={props.salesChannels} customers={props.customers} methods={props.paymentMethods} banks={props.banks} onSwitchToSingle={() => {setType('single');props.onTypeChange?.('single');}} />;
  return <IncomeForm initialIncome={props.initialIncome} action={props.incomeAction} title={props.title} submitLabel={props.submitLabel} onCancel={props.onCancel} cancelHref={props.cancelHref} banks={props.banks} paymentMethods={props.paymentMethods} salesChannels={props.salesChannels} customers={props.customers} onSwitchToRecurring={() => {setType('recurring');props.onTypeChange?.('recurring');}} />;
}
