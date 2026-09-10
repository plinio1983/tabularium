import MovementLedgerPage from '@/components/MovementLedgerPage';
import type {LedgerParams} from '@/lib/movement-ledger';
export const dynamic = 'force-dynamic';
export default function PaymentsPage({searchParams}: {searchParams?: Promise<LedgerParams>}) {
  return <MovementLedgerPage kind="payments" searchParams={searchParams}/>;
}
