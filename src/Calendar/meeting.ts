import { Context } from "../context";
import { Email } from "../Mail/email";
import { getRelativeDate } from "../helpers";
import { MeetingNote } from "./meetingToNote";

function formatTitle(title:string): string {
    return title.replace(/[/:|#<>[\]]/g, '').replace("&", "and").trim()
}

export class Meeting {

    ctx: Context
    event: GoogleAppsScript.Calendar.Schema.Event
    title: string
    private attendyList: Email[] = [];

    constructor(ctx: Context, event: GoogleAppsScript.Calendar.Schema.Event) {
        this.ctx = ctx
        this.event = event
        this.title = formatTitle(event.summary ?? "")
    }

    fileName(dateTime:string) {
        let eventDate = Utilities.formatDate(new Date(dateTime), "CET", "yyyy-MM-dd");
        return eventDate + "_" + this.title.replace(/ /g, '_') + ".md"
    }

    blockers(cal: GoogleAppsScript.Calendar.Calendar): GoogleAppsScript.Calendar.CalendarEvent[] | null {
        const b = this.event.extendedProperties?.private?.blocker
        if (b) {
            return [cal.getEventById(b)]
        }
        let start = new Date(this.event.end?.dateTime || '')
        let end = getRelativeDate(start, 0, 0, 10)
        return cal.getEvents(start, end, { search: 'block' });
    }

    note(): GoogleAppsScript.Drive.File | null {
        const note = this.event.extendedProperties?.private?.note
        if (note) {
            return DriveApp.getFileById(note)
        }
        const dir = DriveApp.getFolderById(this.ctx.NOTES_FOLDER_ID)
        let files = dir.getFilesByName(this.fileName(this.event.originalStartTime?.dateTime || ''))
        if (files.hasNext()) {
            return files.next()
        }
        return null
    }


    attendees(): Email[] {

        if (!this.attendyList.length) {
            const emails = this.event.attendees?.map<string>(a => a.email || "") || []
            emails?.push(this.event.creator?.email || "")
            emails?.push(this.event.organizer?.email || "")

            this.attendyList = emails.filter(e => e !== "")
                .reduce((unique: string[], item) => {
                    return unique.includes(item) ? unique : [...unique, item]
                }, [])
                .map(e => new Email(this.ctx, e)) || []

        }

        return this.attendyList


    }

    isExternal(): boolean {
        let emails = this.attendees()
            .filter(
                e => e.isExternal()
            );

        return (emails.length > 0)
    }

    is1to1(): boolean {
        return this.attendees().length == 2;
    }

    createBlocker(cal: GoogleAppsScript.Calendar.Calendar) {
        const blockers = this.blockers(cal)
        if (!blockers || blockers.length == 0) {
            if (this.ctx.DEBUG) {
                this.ctx.log.info(`Create blocker for event ${this.title}`)
            } else {
                let start = new Date(this.event.end?.dateTime || '')
                let end = getRelativeDate(start, 0, 0, 10)
                let event = cal.createEvent("block", start, end).setDescription(this.title || "")
                if (this.event.extendedProperties?.private) {
                    this.event.extendedProperties.private["blocker"] = event.getId()
                }
            }
            return true
        }
        this.ctx.log.info(`Blocker for ${this.title} already exists`)
        return false
    }

    removeBlocker(cal: GoogleAppsScript.Calendar.Calendar) {
        const blockers = this.blockers(cal)
        if (blockers) {
            blockers.forEach(b => {
                if (this.title == "" && b.getDescription() != "") {
                    this.title = b.getDescription()
                }
                return b.deleteEvent();
            })
        }
    }

    createNote() {
        const note = new MeetingNote(this)
        note.create().save()
    }

    removeNote() {
        const note = new MeetingNote(this)
        note.delete()
    }

    colorize() {
        let evnt = CalendarApp.getDefaultCalendar().getEventById(this.event.id ?? '')
        this.ctx.log.debug(`Colorize ${this.title} ${evnt?.getColor()}`)
        if (evnt.getColor() === "") { // don't change color if already modified
            if (this.isExternal()) {
                evnt.setColor(CalendarApp.EventColor.PALE_RED.toString())
            } else if (this.is1to1()) {
                evnt.setColor(CalendarApp.EventColor.PALE_GREEN.toString())
            }
        }
    }
}