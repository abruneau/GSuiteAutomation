import { Context } from "../context";
import { getRelativeDate } from "../helpers";
import { Meeting } from "./meeting";

export class CalendarSyncConfig {
    colorize!: boolean;
    blocker!: boolean;
    meetingToNote!: boolean;
}

export class CalendarSync {
    ctx: Context;
    cal: GoogleAppsScript.Calendar.Calendar;
    properties: GoogleAppsScript.Properties.Properties;
    syncToken: string | null;
    config: CalendarSyncConfig;

    constructor(ctx: Context, config: CalendarSyncConfig) {
        this.ctx = ctx;
        this.cal = CalendarApp.getDefaultCalendar();
        this.properties = PropertiesService.getUserProperties();
        this.syncToken = this.properties.getProperty('syncToken');
        this.config = config;
    }

    sync(fullSync = false) {
        let options: { [k: string]: any } = {
            maxResults: 10, 
            eventTypes: 'default',
        };

        if (this.syncToken && !fullSync) {
            options.syncToken = this.syncToken;
        } else {
            if (fullSync) {
                this.properties.deleteProperty('syncToken');
                this.properties.deleteProperty('pageToken');
            }
            if (this.properties.getProperty('pageToken')) {
                this.ctx.log.debug('Resuming sync');
                options.pageToken = this.properties.getProperty('pageToken');
            } else {
                // Sync events from today
                this.ctx.log.debug('Performing full sync');
            }
            options.singleEvents = false;
            options.timeMin = new Date().toISOString();
            options.timeMax = getRelativeDate(new Date(), 5, 0, 0).toISOString();
            options.showDeleted = false;
        }

        // Retrieve events one page at a time.
        let events: GoogleAppsScript.Calendar.Schema.Events | undefined;
        let pageToken;
        let blockers = 0;
        let notes = 0;
        let pageCount = 0;
        do {
            try {
                events = Calendar?.Events?.list(this.cal.getId(), options);
            } catch (e) {
                // Check to see if the sync token was invalidated by the server;
                // if so, perform a full sync instead.
                if (e instanceof Error && e.message === 'Sync token is no longer valid, a full sync is required.') {
                    this.ctx.log.debug(e.message);
                    this.properties.deleteProperty('syncToken');
                    this.sync(true);
                    return;
                } else {
                    if (e instanceof Error) {
                        throw new Error(e.message);
                    } else {
                        throw new Error(String(e));
                    }
                }
            }

            // deduplicate events by id before processing
            let meetings = events?.items
                ?.filter((obj1, i, arr) => arr.findIndex((obj2) => obj2.id === obj1.id) === i)
                .map((i) => new Meeting(this.ctx, i));

            if (meetings?.length) {
                this.ctx.log.info(`${meetings.length} events to process`);
                if (!this.ctx.initialized) {
                    this.ctx.init();
                }
            } else {
                this.ctx.log.info('No events found.');
            }

            meetings?.forEach((meeting) => {
                if (meeting.title === 'block') {
                    return;
                }
                this.ctx.log.debug(`Processing meeting ${meeting.title}: ${meeting.event.status}`);
                if (this.config.colorize && meeting.event.status !== 'cancelled') {
                    meeting.colorize();
                }
                if (meeting.isExternal()) {
                    if (meeting.event.status === 'cancelled') {
                        const event = Calendar?.Events?.get(this.cal.getId(), meeting.event.id ?? '')
                        if (event) {
                            const m = new Meeting(this.ctx, event)
                            if (this.config.blocker) {
                                m.removeBlocker(this.cal);
                            }
                            if (this.config.meetingToNote) {
                                m.removeNote();
                            }
                        }
                        this.ctx.log.debug(`Meeting ${meeting.title} was cancelled`);
                    } else if (meeting.event.start?.date) {
                        // All-day event.
                        let start = new Date(meeting.event.start.date);
                        this.ctx.log.info(`${meeting.title} (${start.toLocaleDateString()})`);
                    } else {
                        if (this.config.blocker) {
                            if (meeting.createBlocker(this.cal)) {
                                blockers++;
                            }
                        }

                        if (this.config.meetingToNote) {
                            meeting.createNote();
                            notes++;
                        }
                    }
                }
            });

            pageToken = events?.nextPageToken;
            pageCount++;
            if (!this.ctx.DEBUG) {
                this.properties.setProperty('syncToken', events?.nextSyncToken || '');
                this.properties.setProperty('pageToken', events?.nextPageToken || '');
                this.ctx.log.debug('Sync token updated: ' + events?.nextSyncToken);
            }
        } while (pageToken && pageCount < 5);

        this.ctx.log.info(blockers + ' blockers created');
        this.ctx.log.info(notes + ' notes created');
    }
}