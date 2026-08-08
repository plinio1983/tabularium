import test from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../lib/prisma';
import {generateRecurringExpenses} from '../lib/recurring-expenses-job';

test('non rigenera un periodo eliminato di una spesa ricorrente', async () => {
  const recurringExpenseDelegate = prisma.recurringExpense as any;
  const exclusionDelegate = prisma.recurringExpenseExclusion as any;
  const expenseDelegate = prisma.expense as any;
  const originals = {
    recurringFindMany: recurringExpenseDelegate.findMany,
    exclusionFindMany: exclusionDelegate.findMany,
    expenseFindFirst: expenseDelegate.findFirst,
    expenseCreate: expenseDelegate.create
  };
  let createCalls = 0;

  recurringExpenseDelegate.findMany = async () => [{
    id: 42,
    workspaceId: 1,
    companyId: 1,
    company: {timeZone: 'Europe/Rome'},
    startDate: new Date('2026-01-15T00:00:00.000Z'),
    endDate: null,
    cadence: 'MONTHLY',
    dueDay: 15,
    dueMonth: null,
    billingPeriodMode: 'SAME_MONTH',
    billingMonth: null,
    supplierId: 7,
    supplier: {businessName: 'Fornitore'},
    categoryId: null,
    description: 'Canone',
    amount: 100,
    vatRate: 22,
    isDeclared: true,
    hasElectronicInvoice: true,
    isAutomaticPayment: false,
    notes: null
  }];
  exclusionDelegate.findMany = async () => [{periodKey: '2026-01'}];
  expenseDelegate.findFirst = async () => null;
  expenseDelegate.create = async () => {
    createCalls += 1;
    return {};
  };

  try {
    const result = await generateRecurringExpenses(new Date('2026-01-15T12:00:00.000Z'));
    assert.equal(result.created, 0);
    assert.equal(result.skipped, 1);
    assert.equal(createCalls, 0);
  } finally {
    recurringExpenseDelegate.findMany = originals.recurringFindMany;
    exclusionDelegate.findMany = originals.exclusionFindMany;
    expenseDelegate.findFirst = originals.expenseFindFirst;
    expenseDelegate.create = originals.expenseCreate;
  }
});
