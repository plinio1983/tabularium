/** A registered payment must have a real calendar date. */
export function requirePaymentDate(value: string | Date | null | undefined): Date {
    if (value == null || value === '') throw new Error('Inserisci la data di ogni pagamento.');
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new Error('Data pagamento non valida.');
    if (typeof value === 'string') {
        const day = value.slice(0, 10);
        const calendarDate = new Date(`${day}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== day) {
            throw new Error('Data pagamento non valida.');
        }
    }
    return parsed;
}
