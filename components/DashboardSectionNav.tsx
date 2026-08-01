'use client';

import {useEffect, useRef, useState} from 'react';

const sections = [
  {id: 'sintesi', label: 'Sintesi'},
  {id: 'incassi', label: 'Incassi'},
  {id: 'fiscale', label: 'Fiscale'},
  {id: 'mensile', label: 'Mensile'},
  {id: 'scadenze', label: 'Scadenze'},
  {id: 'iva', label: 'IVA'}
] as const;

type SectionId = typeof sections[number]['id'];

export default function DashboardSectionNav() {
  const [activeId, setActiveId] = useState<SectionId>(sections[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const staticNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = sections.map(section => document.getElementById(section.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveId(visible.target.id as SectionId);
    }, {rootMargin: '-18% 0px -68% 0px', threshold: [0, .1]});
    targets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = staticNavRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setFloatingVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, {threshold: 0});
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const renderLinks = () => sections.map(section => <a
      key={section.id}
      href={`#${section.id}`}
      className={activeId === section.id ? 'is-active' : ''}
      aria-current={activeId === section.id ? 'location' : undefined}
      onClick={event => {
        const target = document.getElementById(section.id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
        window.history.replaceState(null, '', `#${section.id}`);
        setActiveId(section.id);
        setMobileOpen(false);
      }}
    >{section.label}</a>);

  return <>
    <div ref={staticNavRef} className="dashboard-section-nav-slot">
      <nav className="dashboard-section-nav dashboard-section-nav-desktop" aria-label="Sezioni della dashboard">
        <span>Vai a</span>{renderLinks()}
      </nav>
      <details className="dashboard-section-nav dashboard-section-nav-mobile" open={mobileOpen}
               onToggle={event => setMobileOpen(event.currentTarget.open)}>
        <summary><span>Vai a</span><strong>{sections.find(section => section.id === activeId)?.label}</strong></summary>
        <nav aria-label="Sezioni della dashboard mobile">{renderLinks()}</nav>
      </details>
    </div>
    <nav className={`dashboard-section-floating-nav${floatingVisible ? ' is-visible' : ''}`}
         aria-label="Navigazione rapida della dashboard" aria-hidden={!floatingVisible}>
      {renderLinks()}
    </nav>
  </>;
}
