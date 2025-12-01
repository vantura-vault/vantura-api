import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import blueprintRoutes from './routes/blueprint.js';
import competitorLinkedInRoutes from './routes/competitorLinkedIn.js';
import vaultRoutes from './routes/vault.js';
import { initWebSocket } from './websocket/wsServer.js';

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
app.use('/api/competitors/linkedin', competitorLinkedInRoutes);
app.use('/api/vault', vaultRoutes);

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
});