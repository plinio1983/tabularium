type SalesChannel = {id: number; isDefault?: boolean | null; isFallback?: boolean | null};

export function resolveCustomerSalesChannelId(
  channels: SalesChannel[],
  customerDefaultSalesChannelId?: number | null,
) {
  if (customerDefaultSalesChannelId && channels.some(channel => channel.id === customerDefaultSalesChannelId)) {
    return customerDefaultSalesChannelId;
  }
  return channels.find(channel => channel.isDefault)?.id
    ?? channels.find(channel => !channel.isFallback)?.id
    ?? channels.find(channel => channel.isFallback)?.id
    ?? null;
}
