import { Context } from '../context';

export class Email {
  email: string;
  fullDomain: string;
  rootDomain!: string;
  ctx: Context;

  constructor(ctx: Context, email: string) {
    this.ctx = ctx;
    this.email = email;
    this.fullDomain = this.email.split('@')[1];
    this.parse_host();
  }

  parse_host(): void {
    const parts = this.fullDomain.split('.');
    let stack = '',
      tld_level = -1;

    for (let i = parts.length - 1, part; i >= 0; i--) {
      part = parts[i];
      stack = stack ? part + '.' + stack : part;
      const stack_level = this.ctx.tldsDB.get(stack);
      if (stack_level) {
        tld_level = stack_level.level;
      }
    }

    if (tld_level === -1) tld_level = 1;

    // if (parts.length <= tld_level || tld_level == -1)
    //     throw new Error("Invalid TLD " + JSON.stringify({ parts, tld_level, allowUnknownTLD }));

    this.rootDomain = parts.slice(-tld_level - 1).join('.');
    // this.tld = parts.slice(-tld_level).join('.'),
    // this.sub = parts.slice(0, (-tld_level - 1)).join('.')
  }

  toString(): string {
    return this.email;
  }

  isExternal(): boolean {
    return !this.ctx.BLACK_LIST_DOMAIN.includes(this.fullDomain);
  }
}
