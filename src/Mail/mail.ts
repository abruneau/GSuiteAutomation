import { Context } from '../context';
import { extractDomainsFromThread, getDomain } from './domain';

export function processMails(ctx: Context) {
  const threads = ctx.tbpLabel.getThreads();

  ctx.log.info('Threads to Be Prossesed: ' + threads.length);

  if (threads.length > 0) {
    ctx.initialized ? null : ctx.init();

    let mailTagged = 0;

    threads.forEach(thread => {
      tagThread(ctx, thread);
      mailTagged++;
    });

    ctx.log.info(mailTagged + ' mail taged');
  }
}

function tagThread(ctx: Context, thread: GoogleAppsScript.Gmail.GmailThread) {
  extractDomainsFromThread(ctx, thread)
    .map(t => getDomain(ctx, t))
    .filter(d => !d.blackListed)
    .map(d => applyLabel(ctx, thread, d.label));
  if (!ctx.DEBUG) {
    thread.removeLabel(ctx.tbpLabel);
    thread.refresh();
  }
}

function applyLabel(
  ctx: Context,
  thread: GoogleAppsScript.Gmail.GmailThread,
  labelName: string
): GoogleAppsScript.Gmail.GmailThread {
  ctx.log.info(
    `Add Label ${labelName} to thread ${thread.getFirstMessageSubject()}`
  );
  if (ctx.DEBUG) {
    return thread;
  } else {
    const accountLabel = GmailApp.getUserLabelByName(labelName)
      ? GmailApp.getUserLabelByName(labelName)
      : GmailApp.createLabel(labelName);
    return thread.addLabel(accountLabel);
  }
}
