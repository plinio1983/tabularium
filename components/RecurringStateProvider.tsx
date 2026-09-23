'use client';

import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';

type State = {active: boolean; archived: boolean};
type Kind = 'expense' | 'income';
const Context = createContext<{
  records: Record<string, State>;
  update: (kind: Kind, id: number, state: State) => void;
}>({records: {}, update: () => {}});

export default function RecurringStateProvider({children}: {children: ReactNode}) {
  const [records, setRecords] = useState<Record<string, State>>({});
  // A new server render is authoritative (for example, after saving the editor).
  useEffect(() => setRecords({}), [children]);
  return <Context.Provider value={{records, update: (kind, id, state) => setRecords(previous => ({...previous, [`${kind}:${id}`]: state}))}}>{children}</Context.Provider>;
}

export const useRecurringStates = () => useContext(Context);

type Props = State & {kind: Kind; id: number};
export function RecurringStateBadge({kind, id, active, archived}: Props) {
  const {records} = useRecurringStates();
  const state = records[`${kind}:${id}`] ?? {active, archived};
  return <span className={state.active ? 'recurring-mobile-status is-active' : 'recurring-mobile-status'}>{state.archived ? 'ARCHIVIATA' : state.active ? 'ON' : 'OFF'}</span>;
}

export function RecurringStateCard({kind, id, active, archived, children}: Props & {children: ReactNode}) {
  const {records} = useRecurringStates();
  const state = records[`${kind}:${id}`] ?? {active, archived};
  return <article className={`recurring-mobile-item recurring-mobile-item-${state.active ? 'active' : 'disabled'}`}>{children}</article>;
}
