import { Context } from '../context';
import { Domain } from '../database/domainDatabase';
import { Email } from './email';

export function extractDomainsFromThread(
  ctx: Context,
  thread: GoogleAppsScript.Gmail.GmailThread
) {
  const messages = GmailApp.getMessagesForThread(thread);
  let emails = '';

  // get array of email addresses
  messages.forEach(message => {
    emails +=
      ',' +
      message.getFrom() +
      ',' +
      message.getTo() +
      ',' +
      message.getCc() +
      ',' +
      message.getBcc();
  });

  const emailArray =
    emails.match(/([a-zA-Z0-9._\-+]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi) || [];

  return extractDomainsFromList(ctx, emailArray);
}

export function extractDomainsFromList(
  ctx: Context,
  emails: string[],
  externalOnly = true
): string[] {
  let list = emails.map(e => new Email(ctx, e));

  if (externalOnly) {
    list = list.filter(e => e.isExternal());
  }

  return list
    .map(e => e.rootDomain)
    .reduce((unique: string[], item) => {
      return unique.includes(item) ? unique : [...unique, item];
    }, []);
}

export function getDomain(ctx: Context, domain: string): Domain {
  let d = ctx.ACCOUNTS.get(domain);
  if (!d) {
    d = {
      id: domain,
      name: '',
      label: '',
      blackListed: false,
    };

    const data = clearbitRequest(domain);
    if (data && data[0]) {
      d.name = data[0].name;
      d.label = ctx.LABEL_PREFIX + d.name;
    } else {
      d.label = 'NoLabelFound';
      d.name = 'NoLabelFound';
    }

    ctx.ACCOUNTS.set(d);
  }
  return d;
}

function clearbitRequest(domain: string) {
  const response = UrlFetchApp.fetch(
    'https://autocomplete.clearbit.com/v1/companies/suggest?query=' + domain
  );
  return JSON.parse(response.getContentText());
}
