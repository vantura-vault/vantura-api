import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import snapshotRoutes from './routes/snapshots.js';
import dashboardRoutes from './routes/dashboard.js';
import competitorRoutes from './routes/competitor.js';
import analyticsRoutes from './routes/analytics.js';
import vaultRoutes from './routes/vault.js';
import suggestionsRoutes from './routes/suggestions.js';
import dataChamberRoutes from './routes/dataChamber.js';
import blueprintRoutes from './routes/blueprint.js';
import fileRoutes from './routes/files.js';
import draftRoutes from './routes/draft.js';
import { initWebSocket } from './websocket/wsServer.js';
import { initRedis, closeRedis, cache } from './services/cache.js';
import { initJobQueues, startWorkers, closeJobQueues, getQueueStatus } from './services/jobQueue.js';
import { startSnapshotChecker, stopSnapshotChecker } from './services/snapshotChecker.js';
import { recoverStuckJobs, startJobHealthChecker, stopJobHealthChecker } from './services/jobRecovery.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/data-chamber', dataChamberRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/drafts', draftRoutes);

app.get('/', (_req, res) => {
  res.json({
    message: 'Vantura API',
    version: '1.0.0',
    endspoints:{
      health: '/health',
      auth: '/api/auth/*',
      companies: '/api/companies/*',
      snapshots: '/api/snapshots/*',
      dashboard: '/api/dashboard/*',
      competitor: '/api/competitors/*'
    }
  });
});

// Health check
app.get('/health', async (_req, res) => {
  const queueStatus = await getQueueStatus();
  res.json({
    status: 'ok',
    cache: cache.isAvailable() ? 'connected' : 'disabled',
    jobQueue: queueStatus.available ? 'connected' : 'disabled',
  });
});

// Initialize Redis cache
initRedis();

// Initialize job queues and workers (uses same Redis connection)
initJobQueues();
startWorkers();

// Start background snapshot checker (polls BrightData async snapshots)
startSnapshotChecker();

// Initialize WebSocket server
initWebSocket(httpServer, CORS_ORIGIN);

// Recover any stuck jobs from previous runs
recoverStuckJobs().then((recovered) => {
  if (recovered > 0) {
    console.log(`🔄 [Recovery] Recovered ${recovered} stuck jobs`);
  }
});

// Start job health checker (runs every 5 minutes)
startJobHealthChecker();

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  stopJobHealthChecker();
  stopSnapshotChecker();
  await closeJobQueues();
  await closeRedis();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
});