/**
 * Build a Map<email, displayName> from the authenticated user's Google Contacts.
 * Called once per MeetingNote creation to resolve attendee names.
 * Returns an empty map on any failure — callers fall back to email parsing.
 *
 * Uses UrlFetchApp instead of the People advanced service because the GAS
 * client generator does not expose the `connections` sub-resource as a nested
 * property on `People.People`.
 */
export function buildContactMap(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const token = ScriptApp.getOAuthToken();
    let pageToken: string | undefined;
    do {
      const url =
        'https://people.googleapis.com/v1/people/me/connections' +
        '?personFields=names%2CemailAddresses&pageSize=1000' +
        (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
      const response = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      const data = JSON.parse(response.getContentText());
      for (const person of data.connections ?? []) {
        const displayName = person.names?.[0]?.displayName;
        if (!displayName) continue;
        for (const addr of person.emailAddresses ?? []) {
          if (addr.value) map.set(addr.value.toLowerCase(), displayName);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (e) {
    console.error('[gcontacts] buildContactMap failed:', e);
  }
  return map;
}
