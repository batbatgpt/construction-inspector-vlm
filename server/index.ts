import { createApp } from './app.js';
import { getConfig } from './config.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer from 1 to 65535.');
const app = createApp({ serveClient: true });
const server = app.listen(port, '127.0.0.1', () => {
  console.info(`Construction Inspector VLM backend: http://127.0.0.1:${port}`);
  if (!getConfig().apiKey)
    console.info('Gemini key is not configured. Add GEMINI_API_KEY to .env and restart when ready.');
});
server.requestTimeout = 180_000;
server.headersTimeout = 30_000;
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Stop the other server or change PORT.`
      : 'The backend could not start. Check the local port configuration.',
  );
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
