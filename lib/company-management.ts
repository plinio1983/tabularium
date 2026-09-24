import {prisma} from '@/lib/prisma';
import {companyUsageSelect, companyUsageSummary} from './company-usage';

export type CompanyOperation = 'delete' | 'toggle' | 'default';
export type CompanyChangeResult = {error: 'not_found' | 'last_active' | 'in_use' | 'conflict'} | {saved: 'deleted' | 'status' | 'default'};

export async function changeCompany(operation: CompanyOperation, id: number, workspaceId: number, userId: number): Promise<CompanyChangeResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return {error: 'not_found'};
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        // Serialize changes to defaults/availability; also prevent new child records
        // from being attached between the usage check and deletion.
        await tx.$queryRaw`SELECT id FROM "Company" WHERE "workspaceId" = ${workspaceId} ORDER BY id FOR UPDATE`;
        const company = await tx.company.findFirst({where: {id, workspaceId}, include: {_count: {select: companyUsageSelect}}});
        if (!company || (operation === 'default' && !company.isActive)) return {error: 'not_found'} as const;
        const fallback = await tx.company.findFirst({where: {workspaceId, isActive: true, id: {not: id}}, orderBy: [{isDefault: 'desc'}, {id: 'asc'}]});
        if ((operation === 'delete' || (operation === 'toggle' && company.isActive)) && !fallback) return {error: 'last_active'} as const;
        if (operation === 'delete' && companyUsageSummary(company._count)) return {error: 'in_use'} as const;

        if (operation === 'default') {
          await tx.company.updateMany({where: {workspaceId}, data: {isDefault: false}});
          await tx.company.update({where: {id}, data: {isDefault: true}});
        } else {
          const removing = operation === 'delete' || company.isActive;
          if (removing && fallback) {
            await tx.authSession.updateMany({where: {workspaceId, activeCompanyId: id}, data: {activeCompanyId: fallback.id}});
            if (company.isDefault) {
              await tx.company.updateMany({where: {workspaceId}, data: {isDefault: false}});
              await tx.company.update({where: {id: fallback.id}, data: {isDefault: true}});
            }
          }
          if (operation === 'delete') await tx.company.delete({where: {id}});
          else await tx.company.update({where: {id}, data: {isActive: !company.isActive, isDefault: company.isActive ? false : company.isDefault}});
        }
        await tx.auditLog.create({data: {
          workspaceId, userId, entityType: 'Company', entityId: String(id),
          action: operation === 'delete' ? 'DELETE' : 'UPDATE',
          metadata: {operation, companyName: company.name, companyCode: company.code,
            previousIsActive: company.isActive, previousIsDefault: company.isDefault,
            fallbackCompanyId: operation !== 'default' && (operation === 'delete' || company.isActive) ? fallback?.id ?? null : null}
        }});
        return {saved: operation === 'delete' ? 'deleted' : operation === 'default' ? 'default' : 'status'} as const;
      }, {isolationLevel: 'Serializable'});
    } catch (error) {
      const code = (error as {code?: string})?.code;
      if (code === 'P2034' && attempt < 2) continue;
      if (code === 'P2003') return {error: 'in_use'};
      if (code === 'P2034') return {error: 'conflict'};
      throw error;
    }
  }
  return {error: 'conflict'};
}
