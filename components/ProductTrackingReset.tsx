'use client';
import Link from 'next/link';
export default function ProductTrackingReset() {
  return <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/product-trackings" onClick={() => {
    try {localStorage.removeItem('dmsAccounting.product-trackings.filters');} catch { /* Reset remains available without storage. */ }
  }}><span className="btn-icon" aria-hidden="true">×</span> Reset</Link>;
}
