import 'dotenv/config';
import { app } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`API running at http://${HOST}:${PORT}`);
});

//container shutdown
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Closing HTTP server...`);
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    console.log('HTTP server successfully terminated.');
    process.exit(0);
  });

  // Force close after 10 seconds if connections exist
  setTimeout(() => {
    console.error('Forced shutdown.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));