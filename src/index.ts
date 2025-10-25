import express from 'express';
import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import snapshotRoutes from './routes/snapshots';
import dashboardRoutes from './routes/dashboard';
import competitorRoutes from './routes/competitor';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/competitors', competitorRoutes);

app.get('/', (req, res) => {
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
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});