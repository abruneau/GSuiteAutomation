import * as fs from 'fs';

import UrlFetchAppStubConfiguration from '../url-fetch/UrlFetchAppStubConfiguration';
import HttpResponse from '../url-fetch/HttpReponse';
import * as path from 'path';
import { Context } from '../../src/context';
import { TldDatabase } from '../../src/database/tldDatabase';
import { Settings } from '../../src/settings';
import { Email } from '../../src/Mail/email';

describe('test parse functions', () => {
  let db: TldDatabase;
  let ctx: Context;

  beforeAll(() => {
    const data = fs.readFileSync(
      path.resolve(__dirname, 'effective_tld_names.dat'),
      'utf8'
    );

    UrlFetchAppStubConfiguration.when(
      'https://publicsuffix.org/list/effective_tld_names.dat'
    ).return(new HttpResponse().setContentText(data));

    db = new TldDatabase();
    ctx = new Context(new Settings());
    ctx.tldsDB = db;
  });

  it('should extract base domain name', () => {
    const mail = new Email(ctx, 'test@partner.domain.com');
    expect(mail.rootDomain).toBe('domain.com');
  });

  it('should support multi-part TLDs like .co.za', () => {
    const mail = new Email(ctx, 'test@bcx.co.za');
    expect(mail.rootDomain).toBe('bcx.co.za');
  });

  it('should support multi-part TLDs like .com.br', () => {
    const mail = new Email(ctx, 'test@vericode.com.br');
    expect(mail.rootDomain).toBe('vericode.com.br');
  });

  it('should ignore subdomains with multi-part TLDs', () => {
    const mail = new Email(ctx, 'test@partner.bcx.co.za');
    expect(mail.rootDomain).toBe('bcx.co.za');
  });
});
