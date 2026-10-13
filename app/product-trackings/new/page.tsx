import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {detailBackHref} from '@/lib/detail-navigation';
import ProductTrackingEditor from '@/components/ProductTrackingEditor';
export default async function Page({searchParams}: {searchParams: Promise<{returnTo?: string}>}) {
  await requireWorkspaceRole(workspaceOperationalRoles, '/product-trackings/new');
  const candidate = detailBackHref((await searchParams).returnTo, '/product-trackings/new', '/product-trackings');
  const returnTo = candidate.split('?')[0] === '/product-trackings' ? candidate : '/product-trackings';
  return <><h1>Nuova tracciatura</h1><ProductTrackingEditor initiallyOpen returnTo={returnTo}/></>;
}
