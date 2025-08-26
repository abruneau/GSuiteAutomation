import { BaseData, Database } from "./database"
const REMOTE_TLD_URL = "https://publicsuffix.org/list/effective_tld_names.dat";

export interface Tld extends BaseData {
    id: string
    level: number
}

export class TldDatabase implements Database<Tld> {

    private db: Record<string, Tld> = {}

    constructor() {
        let response = UrlFetchApp.fetch(REMOTE_TLD_URL);
        let contents = response.getContentText()

        let section;

        const sections = /^\/\/\s*===BEGIN (ICANN|PRIVATE) DOMAINS===\s*$/;
        const comment = /^\/\/.*?/;
        const splitter = /(\!|\*\.)?(.+)/;
        const lines = contents.split(/[\r\n]+/);

        for (let line of lines) {
            line = line.trim();

            if (sections.test(line)) {
                continue;
            }
            if (comment.test(line))
                continue;
            if (!splitter.test(line))
                continue;
            if (!section)
                continue;

            let newline = splitter.exec(line);
            if (newline) {
                let tld = newline[2],
                    level = tld.split(".").length,
                    modifier = newline[1];
                if (modifier == "*.") level++;
                if (modifier == "!") level--;

                this.db[tld] = { id: tld, level: level };

            }
        }
    }

    set(values: Tld): void {
        this.db[values.id] = values
    }
    get(id: string): Tld | undefined {
        return this.db[id]
    }

}
