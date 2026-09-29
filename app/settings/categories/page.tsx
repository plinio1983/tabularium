import InfoHint from '@/components/InfoHint';
import Link from 'next/link';
import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import DetailBackButton from '@/components/DetailBackButton';

export default async function CategoriesSettingsPage() {
  await requireWorkspaceRole(workspaceManagementRoles, '/settings/categories');

  return <div className="grid admin-page settings-admin-page categories-settings-page">
    <div className="toolbar-card">
      <div><div className="info-title-row"><h2>Categorie</h2><InfoHint compactOnly title="Categorie">Scegli l’area di categorie da configurare.</InfoHint></div><p className="muted info-hint-desktop-text">Scegli l’area di categorie da configurare.</p></div>
      <DetailBackButton href="/settings" />
    </div>
    <div className="settings-category-hub">
      <Link className="card settings-category-link" href="/settings/categories/expenses">
        <span className="settings-category-link-icon" aria-hidden="true">🧾</span>
        <span><strong>Categorie di spesa</strong><small>Gestisci categorie, acronimi e icone delle spese.</small></span>
      </Link>
      <Link className="card settings-category-link" href="/settings/categories/incomes">
        <span className="settings-category-link-icon" aria-hidden="true">💶</span>
        <span><strong>Canali di vendita</strong><small>Gestisci i canali di vendita utilizzati dagli incassi.</small></span>
      </Link>
    </div>
  </div>;
}
