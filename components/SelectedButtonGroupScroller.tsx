"use client";

import {useLayoutEffect, useRef, type ReactNode} from "react";

export default function SelectedButtonGroupScroller({className, children}: {className: string; children: ReactNode}) {
    const groupRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        const revealSelected = () => {
            if (group.scrollWidth <= group.clientWidth) return;
            const selected = group.querySelector<HTMLElement>('[aria-current="page"]');
            if (!selected) return;
            const groupRect = group.getBoundingClientRect();
            const selectedRect = selected.getBoundingClientRect();
            if (selectedRect.left >= groupRect.left && selectedRect.right <= groupRect.right) return;
            const centeredLeft = group.scrollLeft + (selectedRect.left - groupRect.left) - (group.clientWidth - selectedRect.width) / 2;
            group.scrollTo({left: Math.max(0, centeredLeft), behavior: "auto"});
        };

        const frame = window.requestAnimationFrame(revealSelected);
        const observer = new ResizeObserver(revealSelected);
        observer.observe(group);
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, []);

    return <div ref={groupRef} className={className}>{children}</div>;
}
