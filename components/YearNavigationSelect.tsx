'use client';

import {useRouter} from 'next/navigation';

type YearOption = {
  year: number;
  href: string;
};

export default function YearNavigationSelect({options, year}: {options: YearOption[]; year: number}) {
  const router = useRouter();

  return <label className="year-navigation-select">
    <select
      aria-label="Seleziona anno"
      value={year}
      onChange={event => {
        const option = options.find(item => item.year === Number(event.currentTarget.value));
        if (!option) return;
        event.currentTarget.dispatchEvent(new Event('tabularium:navigation-start', {bubbles: true}));
        router.push(option.href);
      }}
    >
      {options.map(option => <option key={option.year} value={option.year}>{option.year}</option>)}
    </select>
  </label>;
}
