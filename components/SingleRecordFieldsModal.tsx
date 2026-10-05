'use client';

import {preparePageReturn} from '@/lib/page-transition';
import {useRouter} from 'next/navigation';
import {useEffect, useState, type ComponentProps} from 'react';
import BulkEditFieldsModal, {type SingleEditRecord} from './BulkEditFieldsModal';

export function useMobileRecordEditor() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
export function supportsRecordFields(record: SingleEditRecord) {
  return (record.expenseType ?? record.incomeType ?? 'STANDARD') === 'STANDARD';
}
type Options = Pick<ComponentProps<typeof BulkEditFieldsModal>, 'suppliers' | 'customers' | 'salesChannels'> & {categories?: Array<{id: number; name: string; icon?: string | null}>};
export default function SingleRecordFieldsModal({kind, record, returnTo, onClose, categories = [], ...options}: Options & {
  kind: 'expenses' | 'incomes'; record: SingleEditRecord; returnTo: string; onClose: () => void;
}) {
  return <BulkEditFieldsModal key={record.id} formId={`single-${kind}-${record.id}`} subject={kind === 'expenses' ? 'spese' : 'incassi'}
    action={`/api/${kind}/bulk?returnTo=${encodeURIComponent(returnTo)}`} singleRecord={record} onClose={onClose}
    categories={categories.map(category => ({value: String(category.id), label: category.name, icon: category.icon}))}
    supplierEligibleIds={[record.id]} editableIds={[record.id]} {...options}
    suppliers={record.supplierId && record.merchant && !options.suppliers?.some(supplier => supplier.id === record.supplierId)
      ? [...(options.suppliers ?? []), {id: record.supplierId, businessName: record.merchant}] : options.suppliers}/>;
}

export function ResponsiveRecordEdit({children, ...props}: Omit<ComponentProps<typeof SingleRecordFieldsModal>, 'onClose'> & {children: import('react').ReactNode}) {
  const mobile = useMobileRecordEditor();
  const router = useRouter();
  return mobile && supportsRecordFields(props.record) ? <SingleRecordFieldsModal {...props} onClose={() => {preparePageReturn(props.returnTo); router.replace(props.returnTo);}}/> : children;
}
