'use client';

import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';

type Company = {id: number; name: string};

export default function ActiveCompanySwitcher({returnTo = '/'}: {returnTo?: string}) {
    const pathname = usePathname() || '/';
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/companies', {headers: {'Accept': 'application/json'}})
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (!data) return;
                setCompanies(Array.isArray(data.companies) ? data.companies : []);
                setActiveCompanyId(Number(data.activeCompanyId) || null);
            })
            .catch(() => undefined);
    }, [pathname]);

    const active = companies.find(company => company.id === activeCompanyId);
    if (!active) return null;
    return <div className="active-company-switcher">
        {companies.length > 1 ? <form action="/api/companies/switch" method="post">
            <input type="hidden" name="returnTo" value={returnTo}/>
            <label>
                {/*<span className="active-company-label">Società</span>*/}
                <select name="companyId" value={activeCompanyId ?? ''} aria-label="Società attiva"
                        onChange={event => {
                            window.localStorage.removeItem('dmsAccounting.expenses.filters');
                            window.localStorage.removeItem('dmsAccounting.incomes.filters');
                            event.currentTarget.form?.requestSubmit();
                        }}>
                    {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
            </label>
        </form> : <span className="active-company-name" title="Società attiva">{active.name}</span>}
        {/*<span className="active-company-current" aria-label={`Società attiva: ${active.name}`}>{active.name}</span>*/}
    </div>;
}
