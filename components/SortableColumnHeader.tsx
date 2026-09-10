'use client';

import {useRouter} from 'next/navigation';

export default function SortableColumnHeader({label, href, direction}: {label: string; href: string; direction?: 'asc' | 'desc'}) {
  const router = useRouter();
  const sort = () => router.replace(href, {scroll: false});
  return <th scope="col" className={`sortable-th${direction ? ` sort-${direction}` : ''}`} tabIndex={0}
    aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    title={`Ordina per ${label.toLowerCase()}`} onClick={sort}
    onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); sort();}}}>{label}</th>;
}
