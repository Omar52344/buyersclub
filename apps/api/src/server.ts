import 'dotenv/config';
import { buildApp } from './app';
import { config } from './config';
import { startCleanupJob } from './jobs/cleanup';

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  startCleanupJob();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
