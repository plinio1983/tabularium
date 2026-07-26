import { importExpensesWorkbook, importRecurringExpenseDefinitionsWorkbook } from '@/lib/expense-import';
import { importCustomersWorkbook, importIncomesWorkbook, importSuppliersWorkbook } from '@/lib/data-import';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { redirectToPath } from '@/lib/redirect';
import { writeAuditLog } from '@/lib/audit';

function redirectWithParams(_request: Request, params: Record<string, string | number | boolean>) {
  const url = new URL('/expenses/import', 'http://tabularium.local');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return redirectToPath(`${url.pathname}${url.search}`);
}

export async function POST(request: Request) {
  try {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return redirectWithParams(request, { error: access.status === 401 ? 'auth_required' : 'forbidden' });
    const current = access.current;
    const formData = await request.formData();
    const file = formData.get('file');
    const clearBeforeImport = formData.get('clearBeforeImport') === 'on';
    const rawImportType = String(formData.get('importType') ?? '');
    const importType = ['single_expenses', 'recurring_definitions', 'incomes', 'customers', 'suppliers'].includes(rawImportType)
      ? rawImportType
      : 'single_expenses';
    if (!(file instanceof File) || file.size === 0) {
      return redirectWithParams(request, { error: 'missing_file' });
    }
    const extension = file.name.toLowerCase().match(/\.(xlsx|xls|ods)$/)?.[1];
    if (!extension) return redirectWithParams(request, { error: 'invalid_file_type' });
    if (file.size > 20 * 1024 * 1024) return redirectWithParams(request, { error: 'file_too_large' });

    const buffer = Buffer.from(await file.arrayBuffer());
    const options = { clearBeforeImport, workspaceId: current.workspace.id };
    const result = importType === 'recurring_definitions'
      ? await importRecurringExpenseDefinitionsWorkbook(buffer, options)
      : importType === 'incomes'
        ? await importIncomesWorkbook(buffer, options)
        : importType === 'customers'
          ? await importCustomersWorkbook(buffer, options)
          : importType === 'suppliers'
            ? await importSuppliersWorkbook(buffer, options)
            : await importExpensesWorkbook(buffer, options);

    const baseResult = {
      type: importType,
      imported: result.imported,
      skipped: result.skipped,
      deleted: result.deleted,
      updated: 'updated' in result ? result.updated : 0,
      duplicates: 'duplicates' in result ? result.duplicates : 0,
      related: 'relatedCreated' in result ? result.relatedCreated : result.suppliersCreated,
      sheets: result.sheets.join(', '),
      detail: 'errors' in result ? result.errors.join(' | ').slice(0, 800) : ''
    };
    await writeAuditLog({
      workspaceId: current.workspace.id,
      userId: current.user.id,
      action: 'IMPORT',
      entityType: importType,
      metadata: {
        imported: result.imported,
        skipped: result.skipped,
        deleted: result.deleted,
        clearBeforeImport
      },
      request
    });

    const accepted = result.imported
      + ('updated' in result ? result.updated : 0)
      + ('duplicates' in result ? result.duplicates : 0);

    if (accepted === 0 && result.skipped === 0) {
      return redirectWithParams(request, { error: 'empty_file', ...baseResult });
    }

    if (accepted === 0) {
      return redirectWithParams(request, { error: 'no_rows_imported', ...baseResult });
    }

    return redirectWithParams(request, baseResult);
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message.slice(0, 180) : 'Errore sconosciuto';
    return redirectWithParams(request, { error: 'import_failed', detail });
  }
}
