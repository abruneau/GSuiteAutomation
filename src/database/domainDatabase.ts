import { BaseData, Database } from "./database"

export interface Domain extends BaseData {
    id: string,
    name: string,
    label: string,
    blackListed: boolean
}

export class DomainDatabase implements Database<Domain> {
    private sheet: GoogleAppsScript.Spreadsheet.Sheet
    private db: Record<string, Domain> = {}

    constructor(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
        this.sheet = sheet
        this.init()
    }

    private init(): void {
        let range = this.sheet.getDataRange();
        if (range) {
            let values = range.getValues();

            for (let i = 1; i < values.length; i++) {
                this.db[values[i][0]] = { id: values[i][0], name: values[i][1], label: values[i][2], blackListed: !!values[i][3] }
            }
        }
    }

    set(values: Domain): void {
        this.db[values.id] = values
        let blackListed = values.blackListed ? "TRUE" : ""
        this.sheet.appendRow([values.id, values.name, values.label, blackListed])
    }

    get(id: string): Domain | undefined {
        return this.db[id]
    }
}




