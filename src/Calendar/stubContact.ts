import { Context } from '../context';

/**
 * Create a stub contact markdown file in the Drive contacts folder.
 * No-ops if the folder is unconfigured, file already exists, or DEBUG is on.
 */
export function createStubContact(
  ctx: Context,
  email: string,
  displayName: string
): void {
  if (!ctx.CONTACTS_FOLDER_ID) return;

  if (ctx.DEBUG) {
    ctx.log.info(`[DEBUG] Would create stub contact: ${displayName}.md`);
    return;
  }

  const fileName = `${displayName}.md`;
  const folder = DriveApp.getFolderById(ctx.CONTACTS_FOLDER_ID);

  const existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) {
    ctx.log.debug(`Stub contact already exists: ${fileName}`);
    return;
  }

  const domain = email.split('@')[1] ?? '';
  const account = ctx.ACCOUNTS?.get(domain);
  const companyLink = account ? `[[${account.name}]]` : '';

  const today = Utilities.formatDate(new Date(), 'CET', 'yyyy-MM-dd HH:mm');
  const content = [
    '---',
    `date_created: ${today}`,
    'tags:',
    '  - contacts',
    `title: ${displayName}`,
    '---',
    '',
    `# ${displayName}`,
    '',
    `Company:: ${companyLink}`,
    '',
    'Team::',
    '',
    'Role::',
    '',
    `Email:: ${email}`,
    '',
    'Phone::',
    '',
    'Linkedin::',
    '',
    'Manager::',
    '',
  ].join('\n');

  folder.createFile(fileName, content);
  ctx.log.info(`Created stub contact: ${fileName}`);
}
