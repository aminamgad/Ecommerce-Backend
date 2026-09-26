import app from './app';
import { connectDatabase } from './config/db';
import { env, EnvValidationError } from './config/env';

async function start(): Promise<void> {
  await connectDatabase();

  const server = app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${env.port} is already in use. Stop the other process or set PORT in .env to a free port.`
      );
    } else {
      console.error('Failed to start server');
    }
    process.exit(1);
  });
}

start().catch((error) => {
  if (error instanceof EnvValidationError) {
    // Message lists variable names only — never secret values.
    console.error(error.message);
  } else {
    console.error('Failed to start server');
  }
  process.exit(1);
});
