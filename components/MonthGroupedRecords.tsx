import {Fragment, type ReactNode} from 'react';
import {compareListDates, hasMultipleMonths, listMonthKey, listMonthLabel, type DateSort} from '@/lib/list-month-groups';

export default function MonthGroupedRecords({records, sort, enabled}: {
  records: Array<{key: string | number; value: number | null; content: ReactNode}>;
  sort: DateSort | null;
  enabled: boolean;
}) {
  const ordered = sort ? [...records].sort((a, b) => compareListDates(a.value, b.value, sort.direction)) : records;
  const keys = ordered.map(record => sort ? listMonthKey(record.value, sort.kind, sort.timeZone) : '');
  const grouped = enabled && Boolean(sort) && hasMultipleMonths(keys);
  return <>{ordered.map((record, index) => <Fragment key={record.key}>
    {grouped && (index === 0 || keys[index] !== keys[index - 1]) ? <h2 className="list-month-heading">{listMonthLabel(keys[index])}</h2> : null}
    {record.content}
  </Fragment>)}</>;
}
