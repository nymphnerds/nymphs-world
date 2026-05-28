import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import config from './config.js';
import authMiddleware from './middleware/authMiddleware.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import imageRoutes from './routes/images.js';
import llmRoutes from './routes/llm.js';
import imageGenRoutes from './routes/imageGeneration.js';
import projectRoutes from './routes/projects.js';
import settingsRoutes from './routes/settings.js';
import timelineRoutes from './routes/timeline.js';
import scenesRoutes from './routes/scenes.js';
import dialogueRoutes from './routes/dialogue.js';
import conversationRoutes from './routes/conversations.js';
import graphRoutes from './routes/graph.js';
import reminderRoutes from './routes/reminders.js';
import adminRoutes from './routes/admin-maintenance.js';
import maintenanceRoutes from './routes/maintenance.js';
import requireAdmin from './middleware/requireAdmin.js';
import { usersRoot } from './services/authService.js';
import { projectsRoot } from './services/projectService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({ origin: '*' }));  // Allow all origins (private system)
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure data directories exist
const dirs = [usersRoot, projectsRoot];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Image proxy routes (public /proxy, auth per-route for /sign and /sign-batch)
app.use('/api/images', imageRoutes);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/server_info', (req, res) => {
  res.json({
    id: process.env.NYMPHS_WORLD_MODULE_ID || 'nymphs-world',
    name: process.env.NYMPHS_WORLD_MODULE_NAME || 'Nymphs World',
    base: 'worbi',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Protected routes (auth required)
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/files', authMiddleware, timelineRoutes);
app.use('/api/files', authMiddleware, scenesRoutes);
app.use('/api/dialogue', authMiddleware, dialogueRoutes);
app.use('/api/conversations', authMiddleware, conversationRoutes);
app.use('/api/llm', authMiddleware, llmRoutes);
app.use('/api/llm', authMiddleware, imageGenRoutes);
app.use('/api/llm/graph', authMiddleware, graphRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reminders', authMiddleware, reminderRoutes);

// Self-service maintenance routes (auth only, no admin required)
app.use('/api/maintenance', authMiddleware, maintenanceRoutes);

// Admin routes (auth + admin required)
app.use('/api/admin', authMiddleware, requireAdmin, adminRoutes);

// --- Production: Serve pre-built frontend static files ---
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  // Catch-all: serve index.html for any non-API route (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`Serving frontend from: ${distDir}`);
} else {
  console.warn('Frontend dist/ not found — API-only mode.');
}

// Start server only when not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.port;
  const HOST = config.host;
  app.listen(PORT, HOST, () => {
    console.log(`Nymphs World server running on http://${HOST}:${PORT}`);
    console.log(`Users root: ${usersRoot}`);
  });
}

export default app;
