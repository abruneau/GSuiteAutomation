import { BaseData, Database } from './database';
const REMOTE_TLD_URL = 'https://publicsuffix.org/list/effective_tld_names.dat';

export interface Tld extends BaseData {
  id: string;
  level: number;
}

export class TldDatabase implements Database<Tld> {
  private db: Record<string, Tld> = {};

  constructor() {
    const response = UrlFetchApp.fetch(REMOTE_TLD_URL);
    const contents = response.getContentText();

    let section = false;

    const sections = /^\/\/\s*===BEGIN (ICANN|PRIVATE) DOMAINS===\s*$/;
    const comment = /^\/\/.*?/;
    const splitter = /(!|\*\.)?(.+)/;
    const lines = contents.split(/[\r\n]+/);

    for (let line of lines) {
      line = line.trim();

      if (sections.test(line)) {
        section = true;
        continue;
      }
      if (comment.test(line)) continue;
      if (!splitter.test(line)) continue;
      if (!section) continue;

      const newline = splitter.exec(line);
      if (newline) {
        const tld = newline[2];
        let level = tld.split('.').length;
        const modifier = newline[1];
        if (modifier === '*.') level++;
        if (modifier === '!') level--;

        this.db[tld] = { id: tld, level: level };
      }
    }
  }

  set(values: Tld): void {
    this.db[values.id] = values;
  }
  get(id: string): Tld | undefined {
    return this.db[id];
  }
}
