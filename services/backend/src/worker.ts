import { Logger } from '@nestjs/common';
import { loadEnv } from './config/env';

// Reminder-worker skeleton. The scheduler described in ADR-0003
// (SELECT ... FOR UPDATE SKIP LOCKED batch claiming) lands with the
// notifications implementation plan; for now the process stays alive so
// the `notifications` compose profile has a runnable target.
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('ReminderWorker');
  logger.log(`reminder worker skeleton started (db=${env.databaseUrl.split('@').pop()})`);
  setInterval(() => {}, 1 << 30);
}

main();
