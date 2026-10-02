import assert from 'node:assert/strict';
import test from 'node:test';
import {requirePaymentDate} from '../lib/payment-date';

test('registered payments require a real date, including imports and copies', () => {
    for (const value of [null, undefined, '', 'invalid', '2026-02-30', '2026-13-01', new Date('invalid')]) {
        assert.throws(() => requirePaymentDate(value), /data|Data/);
    }
    assert.equal(requirePaymentDate('2026-10-02').toISOString(), '2026-10-02T00:00:00.000Z');
    assert.equal(requirePaymentDate('2026-10-02T08:30:00.000Z').toISOString(), '2026-10-02T08:30:00.000Z');
});
