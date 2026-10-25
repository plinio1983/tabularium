import {notFound} from 'next/navigation';
import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {calendarDateInput} from '@/lib/company-time';
import {detailBackHref} from '@/lib/detail-navigation';
import {normalizeTrackingStep} from '@/lib/product-tracking-wizard';
import ProductTrackingEditor from '@/components/ProductTrackingEditor';
export default async function Page({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
 const current = await requireWorkspaceRole(workspaceOperationalRoles, '/product-trackings'); const id = Number((await params).id);
 if (!Number.isInteger(id) || id <= 0) notFound();
 const record = await prisma.productTracking.findFirst({where: {id, workspaceId: current.workspace.id, companyId: current.company.id}, include: {supplier: {select: {id: true, businessName: true, alias: true}}, attachments: true}});
 if (!record) notFound();
 const query = await searchParams;
 const value = (key: string) => Array.isArray(query[key]) ? query[key][0] : query[key];
 const candidate = detailBackHref(value('returnTo'), `/product-trackings/${id}/edit`, '/product-trackings');
 const targetPath = candidate.split('?')[0];
 const returnTo = targetPath === '/product-trackings' || targetPath === `/product-trackings/${id}` ? candidate : '/product-trackings';
 const openNewInvoice = value('addInvoice') === '1';
 const initialMobileStep = openNewInvoice ? 3 : normalizeTrackingStep(value('step'));
 return <><h1>Modifica tracciatura</h1><ProductTrackingEditor initiallyOpen returnTo={returnTo} initialMobileStep={initialMobileStep} openNewInvoice={openNewInvoice} record={{...record, entryDate: calendarDateInput(record.entryDate), attachments: record.attachments.map(a => ({...a, invoiceDate: calendarDateInput(a.invoiceDate), documentDate: calendarDateInput(a.documentDate)}))}}/></>;
}
