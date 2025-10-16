import { Settings } from './settings';

interface CallerInfo {
  name: string;
  filename: string;
  line: string;
  column: string;
}

export class Log {
  settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  private formatLogMessage(
    level: string,
    callerInfo: CallerInfo,
    message: string
  ): string {
    return `${level} ${callerInfo.filename}:${callerInfo.line}:${callerInfo.column} ${callerInfo.name}() ${message}`;
  }

  info(message: string) {
    const callerInfo = this.getFileName();
    if (callerInfo) {
      console.log(this.formatLogMessage('INFO', callerInfo, message));
    } else {
      console.log(`INFO ${message}`);
    }
  }

  debug(message: string) {
    if (this.settings.getBoolean('LOG_DEBUG')) {
      const callerInfo = this.getFileName();
      if (callerInfo) {
        console.log(this.formatLogMessage('DEBUG', callerInfo, message));
      } else {
        console.log(`DEBUG ${message}`);
      }
    }
  }

  error(message: string) {
    const callerInfo = this.getFileName();
    if (callerInfo) {
      console.error(this.formatLogMessage('ERROR', callerInfo, message));
    } else {
      console.error(`ERROR ${message}`);
    }
  }

  warn(message: string) {
    const callerInfo = this.getFileName();
    if (callerInfo) {
      console.warn(this.formatLogMessage('WARN', callerInfo, message));
    } else {
      console.warn(`WARN ${message}`);
    }
  }

  private getFileName(): CallerInfo | null {
    const STACK_FUNC_NAME = new RegExp(
      /at\s+((\S+)\s)?\(?(\S+):(\d+):(\d+)\)?/
    );
    const err = new Error();
    Error.captureStackTrace(err);

    const stacks = err.stack?.split('\n').slice(3, 4) || [];
    if (stacks.length === 0) return null;

    const callerInfo = STACK_FUNC_NAME.exec(stacks[0]);
    if (!callerInfo) return null;

    return {
      name: callerInfo[2] || '(anonymous)',
      filename: callerInfo[3],
      line: callerInfo[4],
      column: callerInfo[5],
    };
  }
}
