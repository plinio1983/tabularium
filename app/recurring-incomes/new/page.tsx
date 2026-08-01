import { redirect } from 'next/navigation';

export default function LegacyNewRecurringIncomePage() {
  redirect('/incomes/new?type=recurring&returnTo=%2Frecurring-incomes');
}
