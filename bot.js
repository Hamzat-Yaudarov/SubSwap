import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { createUser, getUser } from './db/queries.js';
import { getMutualPairsForUser, updateMutualPairStatus } from './db/queries.js';
import { updateUserRating } from './db/queries.js';

dotenv.config();

const token = process.env.BOT_TOKEN;
const webappUrl = process.env.WEBAPP_URL;

if (!token) {
  throw new Error('BOT_TOKEN is not set');
}

const bot = new TelegramBot(token, { polling: true });

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Создаём или получаем пользователя
  await createUser(userId);

  const welcomeText = `Добро пожаловать! 👋

Это сервис безопасных взаимных подписок и реакций.

Все действия проходят внутри MiniApp, без общения в личных сообщениях Telegram.

Нажмите кнопку ниже, чтобы открыть MiniApp:`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📱 Открыть MiniApp',
            web_app: { url: webappUrl }
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, welcomeText, options);
});

// Обработка callback от кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'open_miniapp') {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📱 Открыть MiniApp',
              web_app: { url: webappUrl }
            }
          ]
        ]
      }
    };
    bot.sendMessage(chatId, 'Нажмите кнопку ниже, чтобы открыть MiniApp:', options);
  }

  bot.answerCallbackQuery(query.id);
});

// Обработка web_app данных
bot.on('message', async (msg) => {
  if (msg.web_app?.data) {
    try {
      const data = JSON.parse(msg.web_app.data);
      const chatId = msg.chat.id;
      
      // Обработка данных из MiniApp
      if (data.type === 'check_subscription') {
        // Проверка подписки будет обрабатываться через API
        bot.sendMessage(chatId, 'Проверка выполняется...');
      }
    } catch (error) {
      console.error('Error processing web_app data:', error);
    }
  }
});

// Функция для отправки уведомления о найденной взаимке
export const notifyMutualFound = async (userId, mutualData) => {
  try {
    const text = `🎉 Найдена взаимка!

Канал: ${mutualData.channel_title}
Тип: ${mutualData.mutual_type === 'subscribe' ? 'Подписка' : 'Реакция'}

Откройте MiniApp, чтобы выполнить задание.`;

    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📱 Открыть MiniApp',
              web_app: { url: webappUrl }
            }
          ]
        ]
      }
    };

    await bot.sendMessage(userId, text, options);
  } catch (error) {
    console.error('Error sending mutual notification:', error);
  }
};

// Функция для отправки уведомления о выполненной взаимке
export const notifyMutualCompleted = async (userId, mutualData) => {
  try {
    const text = `✅ Взаимка выполнена!

Канал: ${mutualData.channel_title}
Ваш рейтинг увеличен.`;

    await bot.sendMessage(userId, text);
  } catch (error) {
    console.error('Error sending completion notification:', error);
  }
};

// Функция для отправки уведомления о нарушении
export const notifyViolation = async (userId, reason) => {
  try {
    const text = `⚠️ Обнаружено нарушение!

Причина: ${reason}
Ваш рейтинг снижен.`;

    await bot.sendMessage(userId, text);
  } catch (error) {
    console.error('Error sending violation notification:', error);
  }
};

// Функция для проверки подписки пользователя на канал
export const checkSubscription = async (userId, channelId) => {
  try {
    const chatMember = await bot.getChatMember(channelId, userId);
    return chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator';
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
};

// Функция для проверки, является ли бот админом канала
export const checkBotAdmin = async (channelId) => {
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(channelId, botInfo.id);
    return chatMember.status === 'administrator' || chatMember.status === 'creator';
  } catch (error) {
    console.error('Error checking bot admin status:', error);
    return false;
  }
};

// Функция для проверки, является ли пользователь админом канала
export const checkUserAdmin = async (channelId, userId) => {
  try {
    const chatMember = await bot.getChatMember(channelId, userId);
    return chatMember.status === 'administrator' || chatMember.status === 'creator';
  } catch (error) {
    console.error('Error checking user admin status:', error);
    return false;
  }
};

// Функция для получения информации о канале
export const getChannelInfo = async (channelId) => {
  try {
    const chat = await bot.getChat(channelId);
    return {
      id: chat.id,
      title: chat.title,
      username: chat.username,
      type: chat.type,
      membersCount: chat.members_count || 0
    };
  } catch (error) {
    console.error('Error getting channel info:', error);
    return null;
  }
};

export default bot;

