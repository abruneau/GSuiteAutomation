import { Context } from './context';
import { Settings } from './settings';
import { processMails } from './Mail/mail';
import { CalendarSync } from './Calendar/calendar';
const settings = new Settings();

function onOpen(): void {
  settings.init();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let domain_sheet = spreadsheet.getSheetByName("domains")
  if (!domain_sheet) {
    domain_sheet = spreadsheet.insertSheet("domains");
    domain_sheet.appendRow(['domain', 'name', 'label', 'blacklisted']);
  }

}

function main(): void {
    let ctx = new Context(settings)
    ctx.init()
    if (settings.getBoolean('TAG_EMAILS')) {
      processMails(ctx)
    }

    if (settings.getBoolean('BLOCKER') || settings.getBoolean('MEETING_TO_NOTE')) {
      const cal = new CalendarSync(ctx, {
        colorize: settings.getBoolean('COLORIZE') || false,
        blocker: settings.getBoolean('BLOCKER') || false,
        meetingToNote: settings.getBoolean('MEETING_TO_NOTE') || false
      })
      if (settings.getBoolean('FULL_SYNC')) {
        cal.sync(true)
      } else {
        cal.sync()
      }
  }
}