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
import { initWebSocket } from './websocket/wsServer.js';

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
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Initialize WebSocket server
initWebSocket(httpServer, CORS_ORIGIN);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
});