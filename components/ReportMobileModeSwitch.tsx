'use client';

import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';

export default function ReportMobileModeSwitch() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') === 'fiscal' ? 'fiscal' : 'overall';

    function modeHref(nextMode: 'overall' | 'fiscal') {
        const query = new URLSearchParams(searchParams.toString());
        query.set('mode', nextMode);
        return `${pathname}?${query}`;
    }

    return <div className="trend-mode-toggle" role="group" aria-label="Modalità report">
        {(['overall', 'fiscal'] as const).map(value => <Link
            key={value}
            className={mode === value ? 'trend-mode-button is-active' : 'trend-mode-button'}
            href={modeHref(value)}
            aria-current={mode === value ? 'page' : undefined}
        >{value === 'overall' ? 'Complessivo' : 'Fiscale'}</Link>)}
    </div>;
}
