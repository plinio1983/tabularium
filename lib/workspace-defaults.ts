import { prisma } from '@/lib/prisma';

export const defaultCategories = [
  ['SBANC', 'Servizi Bancari', '🏦'],
  ['ASSIC', 'Assicurazioni', '🛡️'],
  ['AFFUT', 'Affitti/Utenze', '🏠'],
  ['WEB', 'Servizi Web', '🌐'],
  ['SPED', 'Spedizioni/Corrieri', '🚚'],
  ['TAX', 'Tasse/Imposte', '🧾'],
  ['ALSRV', 'Altri Servizi', '🧰'],
  ['MERCE', 'Merce/Forniture', '📦'],
  ['SUPP', 'Articoli di Supporto', '🧩'],
  ['PERS', 'Prestazioni/Dipendenti', '👥'],
  ['RATE', 'Rateizzazione', '📆']
] as const;

export const categoryIconOptions = [
  '🏦',
  '🛡️',
  '🏠',
  '🌐',
  '🚚',
  '🧾',
  '🧰',
  '📦',
  '🧩',
  '👥',
  '📆',
  '💳',
  '🛒',
  '⚙️',
  '📄',
  '💼',
  '🔧',
  '📊',
  '💡',
  '⭐'
] as const;

export const defaultIncomeCategories = [
  ['B2C', 'B2C', '👤'],
  ['B2B', 'B2B', '🏢'],
  ['OTHER', 'Altro', '  •  ']
] as const;

export const defaultIncomeSalesChannels = [
  ['SHOP', 'Shop', '🏬'],
  ['ONLINE_SHOP', 'Online Shop', '🛒'],
  ['OTHER', 'Altro Canale', '🔀']
] as const;

export const incomeEntityIconOptions = [
  ...categoryIconOptions,
  '👤',
  '🏢',
  '  •  ',
  '🏬',
  '🔀',
  '💶',
  '🛍️',
  '🤝',
  '📱'
] as const;

export const fallbackBankName = 'Cassa';
export const cashCreditChannelName = fallbackBankName;
export const fallbackPaymentMethodName = 'Altro metodo';

export const paymentCreditIconOptions = [
  '🏦', '🏛️', '💳', '💶', '💵', '🪙', '₿', '◈', '🌍', '📱', '🧾', '🔁', '↔️', '💸'
] as const;

export const defaultBanks = [
  ['MyTu', '🏦'],
  ['Unicredit', '🏛️'],
  ['Wise', '🌍'],
  [fallbackBankName, '💶']
] as const;

export const defaultPaymentMethods = [
  ['Bonifico', 'BOTH', '🏦'],
  ['Carta di Debito/Credit', 'BOTH', '💳'],
  ['Criptovaluta', 'INCOME', '₿'],
  ['Stripe', 'INCOME', '◈'],
  ['Cash', 'BOTH', '💶'],
  ['Addebito', 'EXPENSE', '🔁'],
  ['RID Bancario', 'EXPENSE', '🏦'],
  ['Modello F24', 'EXPENSE', '🧾'],
  ['PayPal', 'EXPENSE', '💳'],
  ['Mooney', 'EXPENSE', '💸'],
  [fallbackPaymentMethodName, 'BOTH', null]
] as const;

export const vatSettlementSupplierName = 'Erario – Saldo IVA';
export const vatSettlementCategoryCode = 'TAX';
export const cashRegisterCustomerName = 'Banco';
export const counterExpenseSupplierName = 'Merchant';

export function orderExpenseCategories<T extends { id: number; code: string; name: string }>(categories: T[]) {
  const defaultCodes = defaultCategories.map(([code]) => code);
  const defaultItems = defaultCodes
    .map(code => categories.find(category => category.code === code))
    .filter(Boolean) as T[];
  const defaultIds = new Set(defaultItems.map(category => category.id));
  const customItems = categories
    .filter(category => !defaultIds.has(category.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return [...defaultItems, ...customItems];
}

export function orderBanks<T extends { id: number; name: string; isFallback?: boolean | null }>(banks: T[]) {
  const defaultItems = defaultBanks
    .map(([name]) => banks.find(bank => bank.name === name))
    .filter(Boolean) as T[];
  const defaultIds = new Set(defaultItems.map(bank => bank.id));
  const fallbackItems = banks.filter(bank => bank.isFallback && !defaultIds.has(bank.id));
  const fallbackIds = new Set(fallbackItems.map(bank => bank.id));
  const customItems = banks
    .filter(bank => !defaultIds.has(bank.id) && !fallbackIds.has(bank.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return [...defaultItems.filter(bank => !bank.isFallback), ...customItems, ...defaultItems.filter(bank => bank.isFallback), ...fallbackItems];
}

export function orderPaymentMethods<T extends { id: number; name: string; kind: string; isFallback?: boolean | null }>(methods: T[], kind?: 'INCOME' | 'EXPENSE') {
  const filtered = kind ? methods.filter(method => method.kind === kind || method.kind === 'BOTH') : methods;
  const defaultNames = defaultPaymentMethods.map(([name]) => name);
  const defaultItems = defaultNames
    .map(name => filtered.find(method => method.name === name))
    .filter(Boolean) as T[];
  const defaultIds = new Set(defaultItems.map(method => method.id));
  const fallbackItems = filtered.filter(method => method.isFallback && !defaultIds.has(method.id));
  const fallbackIds = new Set(fallbackItems.map(method => method.id));
  const customItems = filtered
    .filter(method => !defaultIds.has(method.id) && !fallbackIds.has(method.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return [...defaultItems.filter(method => !method.isFallback), ...customItems, ...defaultItems.filter(method => method.isFallback), ...fallbackItems];
}

export async function ensureWorkspaceDefaults(workspaceId: number) {
  const existingCompany = await prisma.company.findFirst({
    where: {workspaceId, isActive: true},
    orderBy: [{isDefault: 'desc'}, {id: 'asc'}]
  });
  if (!existingCompany) {
    const workspace = await prisma.workspace.findUnique({where: {id: workspaceId}, select: {name: true}});
    await prisma.company.create({
      data: {
        workspaceId,
        code: 'MAIN',
        name: workspace?.name || 'Società principale',
        isDefault: true
      }
    });
  }

  await prisma.customer.upsert({
    where: { workspaceId_systemRole: { workspaceId, systemRole: 'CASH_REGISTER' } },
    update: { businessName: cashRegisterCustomerName },
    create: { workspaceId, businessName: cashRegisterCustomerName, systemRole: 'CASH_REGISTER' }
  });

  const existingCategories = await prisma.expenseCategory.count({ where: { workspaceId } });
  if (existingCategories === 0) {
    for (const [code, name, icon] of defaultCategories) {
      await prisma.expenseCategory.create({ data: { workspaceId, code, name, icon } });
    }
  }

  for (const [code, name, icon] of defaultIncomeCategories) {
    await prisma.incomeCategory.upsert({
      where: { workspaceId_code: { workspaceId, code } },
      update: {},
      create: { workspaceId, code, name, icon }
    });
  }

  const existingIncomeSalesChannels = await prisma.incomeSalesChannel.count({where: {workspaceId}});
  if (existingIncomeSalesChannels === 0) {
    for (const [index, [code, name, icon]] of defaultIncomeSalesChannels.entries()) {
      await prisma.incomeSalesChannel.create({
        data: {workspaceId, code, name, icon, sortOrder: (index + 1) * 10}
      });
    }
  }

  const legacyCashChannels = await prisma.bank.findMany({
    where: {workspaceId, name: {in: ['Altro', 'Altro canale', 'Altro Canale', 'Altra Banca']}},
    orderBy: {id: 'asc'}
  });
  const existingCashChannel = await prisma.bank.findFirst({where: {workspaceId, name: cashCreditChannelName}});
  const originalOtherChannel = legacyCashChannels.find(channel => channel.name !== 'Altra Banca');
  let currentCashChannel = originalOtherChannel ?? existingCashChannel ?? legacyCashChannels[0] ?? null;
  if (currentCashChannel) {
    const canonicalCashChannel = currentCashChannel;
    const duplicateChannels = [existingCashChannel, ...legacyCashChannels]
      .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel && channel.id !== canonicalCashChannel.id))
      .filter((channel, index, channels) => channels.findIndex(item => item.id === channel.id) === index);
    for (const legacyChannel of duplicateChannels) {
      await prisma.$transaction([
        prisma.expensePayment.updateMany({where: {bankId: legacyChannel.id}, data: {bankId: canonicalCashChannel.id}}),
        prisma.recurringExpense.updateMany({where: {bankId: legacyChannel.id}, data: {bankId: canonicalCashChannel.id}}),
        prisma.income.updateMany({where: {creditBankId: legacyChannel.id}, data: {creditBankId: canonicalCashChannel.id}}),
        prisma.paymentMethod.updateMany({
          where: {cashRegisterDefaultBankId: legacyChannel.id},
          data: {cashRegisterDefaultBankId: canonicalCashChannel.id}
        }),
        prisma.bank.delete({where: {id: legacyChannel.id}})
      ]);
    }
    if (currentCashChannel.name !== cashCreditChannelName || !currentCashChannel.isFallback || !currentCashChannel.icon) {
      currentCashChannel = await prisma.bank.update({
        where: {id: currentCashChannel.id},
        data: {name: cashCreditChannelName, isFallback: true, icon: currentCashChannel.icon ?? '💶'}
      });
    }
  }
  await prisma.bank.updateMany({
    where: {workspaceId, isFallback: true, name: {not: cashCreditChannelName}},
    data: {isFallback: false}
  });
  if (currentCashChannel) {
    await prisma.company.updateMany({
      where: {workspaceId, primaryBankId: currentCashChannel.id},
      data: {primaryBankId: null}
    });
  }

  for (const [name, icon] of defaultBanks) {
    const existing = await prisma.bank.findFirst({ where: { workspaceId, name } });
    if (!existing) await prisma.bank.create({ data: { workspaceId, name, icon, isFallback: name === fallbackBankName } });
    else if ((name === fallbackBankName && !existing.isFallback) || (!existing.icon && icon)) await prisma.bank.update({ where: { id: existing.id }, data: { ...(name === fallbackBankName ? { isFallback: true } : {}), ...(!existing.icon && icon ? { icon } : {}) } });
  }

  const existingPaymentMethodCount = await prisma.paymentMethod.count({where: {workspaceId}});
  for (const [name, kind, icon] of defaultPaymentMethods) {
    // Nei workspace già configurati non aggiungiamo l'intero catalogo standard:
    // evitiamo doppioni semantici come "Carta" / "Carta di Debito/Credit".
    if (existingPaymentMethodCount > 0 && name !== 'Cash') continue;
    const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId, name } });
    const systemRole = name === 'Cash' ? 'CASH' as const : null;
    if (!existing) await prisma.paymentMethod.create({ data: { workspaceId, name, kind, icon, isFallback: name === fallbackPaymentMethodName, systemRole } });
    else if ((name === fallbackPaymentMethodName && !existing.isFallback) || (systemRole && existing.systemRole !== systemRole) || (!existing.icon && icon)) {
      await prisma.paymentMethod.update({ where: { id: existing.id }, data: { ...(name === fallbackPaymentMethodName ? { isFallback: true } : {}), ...(systemRole ? { systemRole } : {}), ...(!existing.icon && icon ? { icon } : {}) } });
    }
  }


  const vatSupplier = await prisma.supplier.findFirst({ where: { workspaceId, systemRole: 'VAT_SETTLEMENT' } });
  if (!vatSupplier) {
    await prisma.supplier.create({
      data: { workspaceId, businessName: vatSettlementSupplierName, alias: 'Erario', systemRole: 'VAT_SETTLEMENT', internalNotes: 'Fornitore di sistema per i versamenti del saldo IVA.' }
    });
  }

  await prisma.supplier.upsert({
    where: {workspaceId_systemRole: {workspaceId, systemRole: 'COUNTER_MERCHANT'}},
    update: {businessName: counterExpenseSupplierName},
    create: {
      workspaceId,
      businessName: counterExpenseSupplierName,
      systemRole: 'COUNTER_MERCHANT',
      internalNotes: 'Fornitore di sistema per le spese da banco.'
    }
  });

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { vatSettlementCategoryId: true } });
  if (!workspace?.vatSettlementCategoryId) {
    const category = await prisma.expenseCategory.findFirst({ where: { workspaceId, code: vatSettlementCategoryCode } });
    if (category) await prisma.workspace.update({ where: { id: workspaceId }, data: { vatSettlementCategoryId: category.id } });
  }

  const registerWorkspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      cashRegisterIncomeCategoryId: true,
      cashRegisterSalesChannelId: true,
      cashRegisterPrimaryPaymentMethodId: true
    }
  });
  const [registerCategory, registerChannel, cashMethod, cardMethod, cashCreditChannel, firstBank] = await Promise.all([
    prisma.incomeCategory.findFirst({ where: { workspaceId, code: 'B2C' } }),
    prisma.incomeSalesChannel.findFirst({ where: { workspaceId }, orderBy: [{sortOrder: 'asc'}, {id: 'asc'}] }),
    prisma.paymentMethod.findFirst({ where: { workspaceId, systemRole: 'CASH' } }),
    prisma.paymentMethod.findFirst({
      where: { workspaceId, OR: [{name: 'Carta di Debito/Credit'}, {name: {startsWith: 'Carta', mode: 'insensitive'}}] },
      orderBy: {id: 'asc'}
    }),
    prisma.bank.findFirst({ where: { workspaceId, name: cashCreditChannelName } }),
    prisma.bank.findFirst({ where: { workspaceId, isFallback: false }, orderBy: { id: 'asc' } })
  ]);
  const enabledRegisterMethods = await prisma.paymentMethod.count({where: {workspaceId, cashRegisterEnabled: true}});
  const initializeRegisterMethods = enabledRegisterMethods === 0 && !registerWorkspace?.cashRegisterPrimaryPaymentMethodId;
  if (cashMethod && cashCreditChannel && cashMethod.cashRegisterDefaultBankId !== cashCreditChannel.id) {
    await prisma.paymentMethod.update({
      where: {id: cashMethod.id},
      data: {cashRegisterDefaultBankId: cashCreditChannel.id}
    });
  }
  if (initializeRegisterMethods && cashMethod) {
    await prisma.paymentMethod.update({
      where: { id: cashMethod.id },
      data: { cashRegisterEnabled: true, cashRegisterDefaultBankId: cashCreditChannel?.id ?? firstBank?.id }
    });
  }
  if (initializeRegisterMethods && cardMethod) {
    await prisma.paymentMethod.update({
      where: { id: cardMethod.id },
      data: { cashRegisterEnabled: true, cashRegisterDefaultBankId: firstBank?.id ?? cashCreditChannel?.id }
    });
  }
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(!registerWorkspace?.cashRegisterIncomeCategoryId && registerCategory ? { cashRegisterIncomeCategoryId: registerCategory.id } : {}),
      ...(!registerWorkspace?.cashRegisterSalesChannelId && registerChannel ? { cashRegisterSalesChannelId: registerChannel.id } : {}),
      ...(!registerWorkspace?.cashRegisterPrimaryPaymentMethodId && cardMethod ? { cashRegisterPrimaryPaymentMethodId: cardMethod.id } : {})
    }
  });
}
