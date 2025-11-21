import express from 'express';
import authRoutes from './routes/auth.js';
import blueprintRoutes from './routes/blueprint.js';
import competitorLinkedInRoutes from './routes/competitorLinkedIn.js';

const app = express();
const PORT  = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/competitors/linkedin', competitorLinkedInRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok'});
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:${PORT}');
});