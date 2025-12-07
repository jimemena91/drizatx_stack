export async function sendTicketToPrinter(params: {
  ticket: { number: string; id: number };
  service: { name: string; id: number };
  client?: { name?: string | null };
  printWebhookUrl: string;
  printWebhookToken: string;
}) {
  const { ticket, service, client, printWebhookUrl, printWebhookToken } = params;

  try {
    const res = await fetch(printWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${printWebhookToken}`,
      },
      body: JSON.stringify({
        ticketNumber: ticket.number,
        serviceName: service.name,
        ticketId: ticket.id,
        serviceId: service.id,
        clientName: client?.name ?? undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}
