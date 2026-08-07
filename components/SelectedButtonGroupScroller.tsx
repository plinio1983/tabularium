"use client";

import {useLayoutEffect, useRef, useState, type ReactNode} from "react";

export default function SelectedButtonGroupScroller({className, children, showControls = false, wrapperClassName = ''}: {
    className: string;
    children: ReactNode;
    showControls?: boolean;
    wrapperClassName?: string;
}) {
    const groupRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useLayoutEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        const updateControls = () => {
            const maxScrollLeft = Math.max(0, group.scrollWidth - group.clientWidth);
            setCanScrollLeft(group.scrollLeft > 1);
            setCanScrollRight(group.scrollLeft < maxScrollLeft - 1);
        };
        const revealSelected = () => {
            if (group.scrollWidth <= group.clientWidth) {
                updateControls();
                return;
            }
            const selected = group.querySelector<HTMLElement>('[aria-current="page"]');
            if (selected) {
                const groupRect = group.getBoundingClientRect();
                const selectedRect = selected.getBoundingClientRect();
                if (selectedRect.left < groupRect.left || selectedRect.right > groupRect.right) {
                    const centeredLeft = group.scrollLeft + (selectedRect.left - groupRect.left) - (group.clientWidth - selectedRect.width) / 2;
                    group.scrollTo({left: Math.max(0, centeredLeft), behavior: "auto"});
                }
            }
            updateControls();
        };

        const frame = window.requestAnimationFrame(revealSelected);
        const observer = new ResizeObserver(revealSelected);
        observer.observe(group);
        group.addEventListener('scroll', updateControls, {passive: true});
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
            group.removeEventListener('scroll', updateControls);
        };
    }, []);

    function scroll(direction: -1 | 1) {
        const group = groupRef.current;
        if (!group) return;
        group.scrollBy({left: direction * Math.max(120, group.clientWidth * .72), behavior: 'smooth'});
    }

    const group = <div ref={groupRef} className={className}>{children}</div>;
    if (!showControls) return group;

    return <div className={`button-group-scroller ${wrapperClassName}`.trim()}>
        {canScrollLeft ? <a className="button-group-scroll-control" href="#" role="button" aria-label="Scorri mesi a sinistra" onClick={event => {
            event.preventDefault();
            scroll(-1);
        }}>‹</a> : null}
        {group}
        {canScrollRight ? <a className="button-group-scroll-control" href="#" role="button" aria-label="Scorri mesi a destra" onClick={event => {
            event.preventDefault();
            scroll(1);
        }}>›</a> : null}
    </div>;
}
