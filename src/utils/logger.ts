const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

let debugEnabled = false;

export function setDebug(enabled: boolean) {
  debugEnabled = enabled;
}

export const logger = {
  info(message: string) {
    console.log(message);
  },
  success(message: string) {
    console.log(`${GREEN}✓${RESET} ${message}`);
  },
  error(message: string) {
    console.error(`${RED}✗${RESET} ${message}`);
  },
  warn(message: string) {
    console.warn(`${YELLOW}!${RESET} ${message}`);
  },
  debug(message: string) {
    if (debugEnabled) {
      console.log(`${GRAY}[debug] ${message}${RESET}`);
    }
  },
};
