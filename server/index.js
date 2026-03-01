import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import espnRouter from './routes/espn.js';
import teamsRouter from './routes/teams.js';
import tournamentsRouter from './routes/tournaments.js';
import picksRouter from './routes/picks.js';
import scoreboardRouter from './routes/scoreboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/espn', espnRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/picks', picksRouter);
app.use('/api/scoreboard', scoreboardRouter);
app.use('/api/season', scoreboardRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve React build in production
const clientDist = join(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Golf Pool server running on http://localhost:${PORT}`);
});
