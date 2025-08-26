import * as fs from 'fs';

import UrlFetchAppStubConfiguration from '../url-fetch/UrlFetchAppStubConfiguration';
import HttpResponse from '../url-fetch/HttpReponse';
import * as path from 'path';
import { Context } from '../../src/context';
import { TldDatabase } from '../../src/database/tldDatabase';
import { Settings } from '../../src/settings';
import { Email } from '../../src/Mail/email';

describe('test parse functions', () => {

    fs.readFile(path.resolve(__dirname, "effective_tld_names.dat"), (err, data) => {
        if (err) {
            console.error(err);
            return;
        }

        UrlFetchAppStubConfiguration.when('https://publicsuffix.org/list/effective_tld_names.dat')
            .return(new HttpResponse().setContentText(data.toString()))
    })

    let db: TldDatabase
    let ctx: Context

    beforeAll(() => {
        db = new TldDatabase()
        ctx = new Context(new Settings())
        ctx.tldsDB = db
    })

    it('should extract base domain name', () => {
        let mail = new Email(ctx, 'test@partner.domain.com')
        expect(mail.rootDomain).toBe('domain.com')
    })
}) 