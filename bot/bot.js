import TelegramBot from 'node-telegram-bot-api';
import pool from '../db/pool.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

let botInstance = null;

export function setupTelegramBot() {
  if (botInstance) return botInstance;

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  botInstance = bot;

  // /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      // Create user if not exists
      await pool.query(
        'INSERT INTO users (id, rating, created_at) VALUES ($1, 100, NOW()) ON CONFLICT (id) DO NOTHING',
        [userId]
      );

      // Send welcome message
      const welcomeText = `🤖 Добро пожаловать в Wormz Bot!

Это сервис безопасных взаимных подписок и реакций внутри MiniApp.

Все действия проходят в специальном приложении — без необходимости писать в личные сообщения или чаты.

Нажмите кнопку ниже, чтобы открыть MiniApp и начать зарабатывать рост вашему каналу!`;

      const options = {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Открыть MiniApp',
              web_app: { url: WEBAPP_URL }
            }
          ]]
        }
      };

      await bot.sendMessage(chatId, welcomeText, options);
    } catch (err) {
      console.error('Error in /start handler:', err);
      bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Handle any other messages
  bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
      const chatId = msg.chat.id;
      bot.sendMessage(
        chatId,
        '📱 Используйте MiniApp для взаимодействия. Нажмите /start для открытия.'
      );
    }
  });

  return bot;
}

export async function sendNotification(userId, message) {
  try {
    if (!botInstance) return;
    await botInstance.sendMessage(userId, message);
  } catch (err) {
    console.error('Failed to send notification:', err.message);
  }
}

export function getBotInstance() {
  return botInstance;
}
