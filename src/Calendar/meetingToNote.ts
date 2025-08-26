import { Meeting } from "./meeting";

import { extractDomainsFromList } from "../Mail/domain";
import { titleCase } from "../helpers";

export class MeetingNote {

    meeting: Meeting
    note: string = ""
    file: GoogleAppsScript.Drive.File | null
    fileName!: string;

    constructor(meeting: Meeting) {
        this.meeting = meeting
        this.file = meeting.note()
    }

    private findCompany() {
        return extractDomainsFromList(this.meeting.ctx, this.meeting.attendees().map(e => e.email))
            .map(d => this.meeting.ctx.ACCOUNTS.get(d)?.name)
            .filter(function(x) {
                return x !== undefined;
            })
    }

    private formatAttendees(displayName:string | undefined, email: string | undefined): string {
        if (!displayName || displayName === "") {
            const emailParts = (email ?? "").split("@")[0].split(/[._-]/);
            const firstName = emailParts[0];
            const lastName = emailParts.length > 1 ? emailParts[1] : "";
            displayName = `${firstName} ${lastName}`;
        }
        return `[[${titleCase(displayName)}]] ${email}`;
    }

    private listAttendees():string[] {
        let attendees = this.meeting.event.attendees?.filter(a => !a.self)
            .map(a => this.formatAttendees(a.displayName, a.email)) || []
        if (!this.meeting.event.organizer?.self) {
            attendees.push(this.formatAttendees(this.meeting.event.organizer?.displayName, this.meeting.event.organizer?.email));
        }
        return attendees;
    }

    private createTemplate() {
        let startDate = Utilities.formatDate(new Date(this.meeting.event.start?.dateTime ?? ''), "CET", "yyyy-MM-dd HH:mm");
        let endDate = Utilities.formatDate(new Date(this.meeting.event.end?.dateTime ?? ''), "CET", "yyyy-MM-dd HH:mm");
        let accounts = this.findCompany().map(a => "[[" + a + "]]")
        let guests = this.listAttendees()
        
        let header = `---\nstart_date: "${startDate}"\nend_date: "${endDate}"\ntags:\n  - meeting\n---`
        let accountList = `account:: ${accounts.join(",")}`
        let guestsList = `Attendees:: \n- ${guests?.join("\n- ")}`
        let oppy = "oppy::"
        let title = `# ${this.meeting.event.summary}`
        let parts = [header, accountList, oppy, guestsList, title]

        return parts.join("\n\n")

    }

    create(): this {
        this.note = this.createTemplate()
        this.fileName = this.meeting.fileName(this.meeting.event.start?.dateTime ?? '')
        return this
    }

    // TODO: only update date, title, and attendies in case notes have already been added
    save() {
        if (this.file) {
            if (this.meeting.ctx.DEBUG) {
                this.meeting.ctx.log.info(`Update note ${this.fileName}`)
                return
            }
            this.file.setName(this.fileName).setContent(this.note)
            this.meeting.ctx.log.info(`Updated note ${this.fileName}`)
            return
        }
        if (this.meeting.ctx.DEBUG) {
            this.meeting.ctx.log.info(`Create note ${this.fileName} \n\n${this.note}`)
        } else {
            const dir = DriveApp.getFolderById(this.meeting.ctx.NOTES_FOLDER_ID);
            const files = dir.getFilesByName(this.fileName)
            if (!files.hasNext()) {
                dir.createFile(this.fileName, this.note)
                this.meeting.ctx.log.info(`Create note ${this.fileName}`)
            }
        }
    }

    delete() {
        if (this.file) {
            if (this.meeting.ctx.DEBUG) {
                this.meeting.ctx.log.info(`Delete note ${this.fileName}`)
            } else {
                this.file.setTrashed(true)
            }
        }
    }
}