'use client';

import {useEffect, useState} from 'react';
import {flashParamNames} from '@/lib/flash';
import SupplierCreateModal from '@/components/SupplierCreateModal';

type CategoryOption = { id: number; name: string; icon?: string | null };

export default function NewSupplierPanel({initialOpen = false, categories = []}: { initialOpen?: boolean; categories?: CategoryOption[] }) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [action, setAction] = useState('/api/suppliers');

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('new');
        flashParamNames.forEach(key => url.searchParams.delete(key));
        const returnTo = `${url.pathname}${url.search}`;
        setAction(`/api/suppliers?returnTo=${encodeURIComponent(returnTo)}`);
    }, []);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest('[data-supplier-new]')) return;

            event.preventDefault();
            setIsOpen(true);
        };

        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    return <>
        <button className="btn btn-sm btn-primary btn-stretch" type="button" data-supplier-new>
            <span className="btn-icon">＋</span>Nuovo fornitore
        </button>
        <SupplierCreateModal
            open={isOpen}
            onClose={() => setIsOpen(false)}
            categories={categories}
            action={action}
        />
    </>;
}
