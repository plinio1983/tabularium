import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveCustomerSalesChannelId} from '../lib/customer-defaults';

const channels = [
  {id: 1, isDefault: true, isFallback: false},
  {id: 2, isDefault: false, isFallback: false},
  {id: 3, isDefault: false, isFallback: true},
];

test('customer sales channel takes precedence over the workspace default', () => {
  assert.equal(resolveCustomerSalesChannelId(channels, 2), 2);
});

test('workspace default is used when the customer has no valid preference', () => {
  assert.equal(resolveCustomerSalesChannelId(channels, null), 1);
  assert.equal(resolveCustomerSalesChannelId(channels, 999), 1);
});
