'use client';

import {useState} from 'react';
import {MonthField} from '@/components/FormControls';

export default function MonthComparisonPeriodField({initialValue}: {initialValue: string}) {
  const [value, setValue] = useState(initialValue);
  return <MonthField
    className="month-comparison-period-field"
    label="Mese da confrontare"
    name="compareMonth"
    value={value}
    onChange={setValue}
    required
  />;
}
