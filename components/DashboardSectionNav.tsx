'use client';

import {useEffect, useRef, useState} from 'react';

const sections = [
  {id: 'sintesi', label: 'Sintesi', icon: '▦'},
  {id: 'fiscale', label: 'Fiscale', icon: '%'},
  {id: 'andamento', label: 'Andamento', icon: '↗'},
  {id: 'incassi', label: 'Incassi', icon: '€'},
  {id: 'spese', label: 'Spese', icon: '◇'},
  {id: 'mensile', label: 'Report mesi', icon: '▤'},
  {id: 'scadenze', label: 'Scadenze', icon: '◷'},
  {id: 'iva', label: 'IVA', icon: 'IVA'}
] as const;

type SectionId = typeof sections[number]['id'];

export default function DashboardSectionNav() {
  const [activeId, setActiveId] = useState<SectionId>(sections[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const staticNavRef = useRef<HTMLDivElement>(null);
  const floatingNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const targets = sections.map(section => document.getElementById(section.id)).filter(Boolean) as HTMLElement[];
    if (!targets.length) return;
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const threshold = Math.max(92, window.innerHeight * .18);
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      const active = atBottom
        ? targets[targets.length - 1]
        : targets.reduce((current, target) => target.getBoundingClientRect().top <= threshold ? target : current, targets[0]);
      setActiveId(active.id as SectionId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActive);
    };
    updateActive();
    window.addEventListener('scroll', scheduleUpdate, {passive: true});
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!floatingVisible) return;
    const nav = floatingNavRef.current;
    const link = nav?.querySelector<HTMLAnchorElement>(`a[href="#${activeId}"]`);
    if (!nav || !link) return;
    nav.scrollTo({
      left: link.offsetLeft - (nav.clientWidth - link.clientWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }, [activeId, floatingVisible]);

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
    ><span className="dashboard-section-nav-icon" aria-hidden="true">{section.icon}</span><span>{section.label}</span></a>);

  return <>
    <div ref={staticNavRef} className="dashboard-section-nav-slot">
      <nav className="dashboard-section-nav dashboard-section-nav-desktop" aria-label="Sezioni della dashboard">
        <span>Vai a</span>{renderLinks()}
      </nav>
      <details className="dashboard-section-nav dashboard-section-nav-mobile" open={mobileOpen}
               onToggle={event => setMobileOpen(event.currentTarget.open)}>
        <summary><span>Vai a</span><strong><span className="dashboard-section-nav-icon" aria-hidden="true">{sections.find(section => section.id === activeId)?.icon}</span>{sections.find(section => section.id === activeId)?.label}</strong></summary>
        <nav aria-label="Sezioni della dashboard mobile">{renderLinks()}</nav>
      </details>
    </div>
    <nav ref={floatingNavRef} className={`dashboard-section-floating-nav${floatingVisible ? ' is-visible' : ''}`}
         aria-label="Navigazione rapida della dashboard" aria-hidden={!floatingVisible}>
      {renderLinks()}
    </nav>
  </>;
}
