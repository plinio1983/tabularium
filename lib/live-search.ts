import {stripFlashSearchParams} from './flash';

export function liveSearchParams(current: string, name: string, value: string) {
  const params = stripFlashSearchParams(new URLSearchParams(current));
  params.delete('new');
  if (value.trim()) params.set(name, value.trim());
  else params.delete(name);
  params.delete('page');
  return params;
}

export function employeeNameSearch(query: string) {
  return query.trim().split(/\s+/).filter(Boolean).map(word => ({
    OR: [
      {firstName: {contains: word, mode: 'insensitive' as const}},
      {lastName: {contains: word, mode: 'insensitive' as const}},
      {employeeCode: {contains: word, mode: 'insensitive' as const}},
      {taxCode: {contains: word, mode: 'insensitive' as const}},
    ],
  }));
}
