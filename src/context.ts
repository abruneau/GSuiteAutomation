import { Settings } from "./settings";
import { Log } from "./logger";
import { DomainDatabase } from "./database/domainDatabase";
import { TldDatabase } from "./database/tldDatabase";

export class Context {

    DOMAIN_SHEET!: GoogleAppsScript.Spreadsheet.Sheet | null;
    CONFIG_SHEET!: GoogleAppsScript.Spreadsheet.Sheet | null;
    LABEL_PREFIX!: string
    BLACK_LIST_DOMAIN!: string[];
    NOTES_FOLDER_ID!: string;
    FEATURE_FOLDER_ID!: string;
    DEBUG!: boolean;
    tbpLabel!: GoogleAppsScript.Gmail.GmailLabel;
    ACCOUNTS!: DomainDatabase;
    tldsDB!: TldDatabase;
    initialized = false
    log: Log;

    constructor(settings: Settings) {
        let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        this.DOMAIN_SHEET = spreadsheet.getSheetByName("domains")
        this.tbpLabel = GmailApp.getUserLabelByName(settings.get('TBP_LABEL') || '');
        this.LABEL_PREFIX = settings.get('LABEL_PREFIX') || '';
        this.BLACK_LIST_DOMAIN = settings.get('BLACK_LIST_DOMAIN')?.split(',') || [];
        this.NOTES_FOLDER_ID = settings.get('NOTES_FOLDER_ID') || '';
        this.DEBUG = settings.getBoolean('DEBUG') || false;
        this.log = new Log(settings);
    }

    init() {

        if (this.DOMAIN_SHEET) {
            this.ACCOUNTS = new DomainDatabase(this.DOMAIN_SHEET)
            this.initialized = true
        }
        this.tldsDB = new TldDatabase()

    }
}