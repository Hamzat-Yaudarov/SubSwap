import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { initializeDatabase } from './db/pool.js';
import { setupTelegramBot } from './bot/bot.js';
import { setupApiRoutes } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
setupApiRoutes(app);

// Serve MiniApp
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize and start server
async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Setup Telegram bot
    const bot = setupTelegramBot();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🤖 Telegram bot started: @${process.env.BOT_USERNAME}`);
      console.log(`📱 MiniApp available at ${process.env.WEBAPP_URL}`);
    });
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
