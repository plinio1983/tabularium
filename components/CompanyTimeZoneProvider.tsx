"use client";

import {createContext, useContext, type ReactNode} from "react";
import {DEFAULT_COMPANY_TIME_ZONE, normalizeTimeZone} from "@/lib/company-time";

const CompanyTimeZoneContext = createContext(DEFAULT_COMPANY_TIME_ZONE);

export function CompanyTimeZoneProvider({timeZone, children}: {timeZone?: string | null; children: ReactNode}) {
    return <CompanyTimeZoneContext.Provider value={normalizeTimeZone(timeZone)}>{children}</CompanyTimeZoneContext.Provider>;
}

export function useCompanyTimeZone() {
    return useContext(CompanyTimeZoneContext);
}
