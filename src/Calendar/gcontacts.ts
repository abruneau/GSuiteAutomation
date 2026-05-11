/**
 * Build a Map<email, displayName> from the authenticated user's Google Contacts.
 * Called once per MeetingNote creation to resolve attendee names.
 * Returns an empty map on any failure — callers fall back to email parsing.
 */
export function buildContactMap(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const response = (People as any).People.connections.list('people/me', {
      personFields: 'names,emailAddresses',
      pageSize: 1000,
    });
    const connections = response.connections ?? [];
    for (const person of connections) {
      const displayName = person.names?.[0]?.displayName;
      if (!displayName) continue;
      for (const addr of person.emailAddresses ?? []) {
        if (addr.value) map.set(addr.value.toLowerCase(), displayName);
      }
    }
  } catch (e) {
    console.error('[gcontacts] buildContactMap failed:', e);
  }
  return map;
}
