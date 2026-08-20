"use client";

import {useEffect, useRef, useState} from "react";

export default function DescriptionAutocomplete({endpoint, label, placeholder, initialValue = "", onValueChange, required = false, className = ""}: {
    endpoint: string;
    label: string;
    placeholder: string;
    initialValue?: string | null;
    onValueChange?: (value: string) => void;
    required?: boolean;
    className?: string;
}) {
    const [query, setQuery] = useState(initialValue ?? "");
    const [results, setResults] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLLabelElement>(null);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            const params = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
            const response = await fetch(`${endpoint}${params}`, {signal: controller.signal}).catch(() => null);
            if (!response?.ok) return;
            const data = await response.json();
            setResults(Array.isArray(data) ? data : []);
            setActiveIndex(0);
        }, 180);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [endpoint, query]);

    function selectSuggestion(value: string) {
        setQuery(value);
        onValueChange?.(value);
        setIsOpen(false);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) setIsOpen(true);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex(index => Math.min(index + 1, results.length - 1));
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(index => Math.max(index - 1, 0));
        }
        if (event.key === "Enter" && isOpen && results[activeIndex]) {
            event.preventDefault();
            selectSuggestion(results[activeIndex]);
        }
        if (event.key === "Escape") setIsOpen(false);
    }

    return <label className={`${className} product-suggestion-picker`} ref={containerRef}>
        <label className="app-form-field-label">
            <span className="app-form-field-icon" aria-hidden="true"></span>
            <span>{label}</span>
        </label>
        <input name="description" required={required} placeholder={placeholder} value={query}
               onChange={event => {
                   setQuery(event.target.value);
                   onValueChange?.(event.target.value);
                   setIsOpen(true);
               }}
               onFocus={() => setIsOpen(true)} onKeyDown={onKeyDown} autoComplete="off"/>
        {isOpen && results.length > 0 ? <div className="suggestion-results" role="listbox">
            {results.map((value, index) => <button type="button" key={`${value}-${index}`}
                                                   className={index === activeIndex ? "active" : ""}
                                                   onMouseEnter={() => setActiveIndex(index)}
                                                   onMouseDown={event => {
                                                       event.preventDefault();
                                                       selectSuggestion(value);
                                                   }}>{value}</button>)}
        </div> : null}
    </label>;
}
