'use client';

import {useSyncExternalStore, type ReactNode} from 'react';

const mobileQuery = '(max-width: 760px)';
function subscribe(onChange: () => void) {
    const media = window.matchMedia(mobileQuery);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
}
function isMobile() { return window.matchMedia(mobileQuery).matches; }
function serverSnapshot() { return false; }

export default function RecordDetailDocument({actions, children, className}: {
    actions: ReactNode;
    children: ReactNode;
    className: string;
}) {
    const mobile = useSyncExternalStore(subscribe, isMobile, serverSnapshot);
    return <>
        {mobile ? actions : null}
        <article className={className}>
            {mobile ? null : actions}
            {children}
        </article>
    </>;
}
