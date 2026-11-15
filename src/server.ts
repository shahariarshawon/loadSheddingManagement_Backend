import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`⚡ GridWatch API server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  console.log(`🏥 Health check: http://localhost:${env.PORT}/api/v1/health`);
});

// Graceful Shutdown
async function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    console.log('🔌 HTTP server closed.');
    await prisma.$disconnect();
    console.log('🗄️ Database connection closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
