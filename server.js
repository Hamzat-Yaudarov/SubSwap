import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bot from './bot.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import { startScheduler } from './services/scheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Статические файлы для MiniApp
app.use(express.static(join(__dirname, 'public')));

// API routes
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Главная страница MiniApp
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Админ-панель
app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MiniApp URL: ${process.env.WEBAPP_URL}`);
  
  // Запускаем планировщик задач
  startScheduler();
});

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

