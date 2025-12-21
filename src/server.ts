import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import blueprintRoutes from './routes/blueprint.js';
import vaultRoutes from './routes/vault.js';
import dataChamberRoutes from './routes/dataChamber.js';
import fileRoutes from './routes/files.js';
import draftRoutes from './routes/draft.js';
import { initWebSocket } from './websocket/wsServer.js';
import { startSnapshotChecker, stopSnapshotChecker } from './services/snapshotChecker.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

// CORS middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/data-chamber', dataChamberRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/drafts', draftRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Initialize WebSocket server
initWebSocket(httpServer, CORS_ORIGIN);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);

  // Start background snapshot checker
  startSnapshotChecker();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  stopSnapshotChecker();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  stopSnapshotChecker();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});