import MovementLedgerPage from '@/components/MovementLedgerPage';
import type {LedgerParams} from '@/lib/movement-ledger';
export const dynamic = 'force-dynamic';
export default function CreditsPage({searchParams}: {searchParams?: Promise<LedgerParams>}) {
  return <MovementLedgerPage kind="credits" searchParams={searchParams}/>;
}
