import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasWorkspaceRole,
  workspaceManagementRoles,
  workspaceOperationalRoles
} from '../lib/auth';

test('OWNER e ADMIN possono gestire configurazioni', () => {
  assert.equal(hasWorkspaceRole('OWNER', workspaceManagementRoles), true);
  assert.equal(hasWorkspaceRole('ADMIN', workspaceManagementRoles), true);
});

test('ACCOUNTANT può operare ma non gestire configurazioni', () => {
  assert.equal(hasWorkspaceRole('ACCOUNTANT', workspaceOperationalRoles), true);
  assert.equal(hasWorkspaceRole('ACCOUNTANT', workspaceManagementRoles), false);
});

test('VIEWER è sempre in sola lettura', () => {
  assert.equal(hasWorkspaceRole('VIEWER', workspaceOperationalRoles), false);
  assert.equal(hasWorkspaceRole('VIEWER', workspaceManagementRoles), false);
});

test('un ruolo assente o sconosciuto non ottiene permessi', () => {
  assert.equal(hasWorkspaceRole(undefined, workspaceOperationalRoles), false);
  assert.equal(hasWorkspaceRole('UNKNOWN', workspaceOperationalRoles), false);
});

