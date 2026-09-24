'use server';

import {redirect} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {changeCompany, type CompanyOperation} from '@/lib/company-management';
import {isValidTimeZone} from '@/lib/company-time';

function text(formData: FormData, key: string) {
    return String(formData.get(key) ?? '').trim();
}

function companyCode(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'SOCIETA';
}

export async function saveCompanyAction(formData: FormData) {
    const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/company-settings');
    const id = Number(formData.get('id')) || null;
    const name = text(formData, 'name');
    if (!name) redirect('/settings/company-settings?error=invalid');
    const timeZone = text(formData, 'timeZone');
    if (!isValidTimeZone(timeZone)) redirect('/settings/company-settings?error=invalid_timezone');
    const baseCode = companyCode(text(formData, 'code') || name);
    const duplicate = await prisma.company.findFirst({
        where: {workspaceId: current.workspace.id, code: baseCode, ...(id ? {id: {not: id}} : {})}
    });
    if (duplicate) redirect('/settings/company-settings?error=duplicate');
    const data = {
        name,
        code: baseCode,
        legalName: text(formData, 'legalName') || null,
        vatNumber: text(formData, 'vatNumber') || null,
        taxCode: text(formData, 'taxCode') || null,
        pec: text(formData, 'pec') || null,
        sdiCode: text(formData, 'sdiCode') || null,
        address: text(formData, 'address') || null,
        timeZone
    };
    if (id) {
        const existing = await prisma.company.findFirst({where: {id, workspaceId: current.workspace.id}});
        if (!existing) redirect('/settings/company-settings?error=not_found');
        await prisma.company.update({where: {id}, data});
    } else {
        await prisma.company.create({data: {...data, workspaceId: current.workspace.id}});
    }
    redirect('/settings/company-settings?saved=1');
}

async function companyOperation(formData: FormData, operation: CompanyOperation) {
    const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/company-settings');
    const result = await changeCompany(operation, Number(formData.get('id')), current.workspace.id, current.user.id);
    const query = 'error' in result ? `error=${result.error}` : `saved=${result.saved}`;
    redirect(`/settings/company-settings?${query}`);
}

export async function setDefaultCompanyAction(formData: FormData) {
    await companyOperation(formData, 'default');
}

export async function toggleCompanyAction(formData: FormData) {
    await companyOperation(formData, 'toggle');
}

export async function deleteCompanyAction(formData: FormData) {
    await companyOperation(formData, 'delete');
}
