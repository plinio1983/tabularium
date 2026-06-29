import { importExpensesWorkbook, importRecurringExpenseDefinitionsWorkbook } from '@/lib/expense-import';
import { getWorkspaceContext } from '@/lib/auth';
import { redirectToPath } from '@/lib/redirect';

function redirectWithParams(_request: Request, params: Record<string, string | number | boolean>) {
  const url = new URL('/expenses/import', 'http://tabularium.local');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return redirectToPath(`${url.pathname}${url.search}`);
}

export async function POST(request: Request) {
  try {
    const current = await getWorkspaceContext();
    if (!current) return redirectWithParams(request, { error: 'auth_required' });
    const formData = await request.formData();
    const file = formData.get('file');
    const clearBeforeImport = formData.get('clearBeforeImport') === 'on';
    const importType = formData.get('importType') === 'recurring_definitions' ? 'recurring_definitions' : 'single_expenses';
    if (!(file instanceof File) || file.size === 0) {
      return redirectWithParams(request, { error: 'missing_file' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = importType === 'recurring_definitions'
      ? await importRecurringExpenseDefinitionsWorkbook(buffer, { clearBeforeImport, workspaceId: current.workspace.id })
      : await importExpensesWorkbook(buffer, { clearBeforeImport, workspaceId: current.workspace.id });

    const baseResult = {
      imported: result.imported,
      skipped: result.skipped,
      deleted: result.deleted,
      suppliers: result.suppliersCreated,
      sheets: result.sheets.join(', ')
    };

    if (result.imported === 0 && result.skipped === 0) {
      return redirectWithParams(request, { error: 'empty_file', ...baseResult });
    }

    if (result.imported === 0) {
      return redirectWithParams(request, { error: 'no_rows_imported', ...baseResult });
    }

    return redirectWithParams(request, baseResult);
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message.slice(0, 180) : 'Errore sconosciuto';
    return redirectWithParams(request, { error: 'import_failed', detail });
  }
}
