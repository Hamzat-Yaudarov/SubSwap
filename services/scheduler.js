import pool from '../db/index.js';
import { checkSubscription, notifyViolation } from '../bot.js';
import { updateUserRating, updateMutualPairStatus } from '../db/queries.js';
import { getChannel } from '../db/queries.js';
import { expireOldChats } from '../db/chatQueries.js';

// Периодическая проверка удержания подписок
export const checkHoldPeriods = async () => {
  try {
    // Получаем все активные пары взаимок
    const result = await pool.query(
      `SELECT mp.*, m.hold_hours, m.created_at, m.channel_id
       FROM mutual_pairs mp
       JOIN mutuals m ON mp.mutual_id = m.id
       WHERE mp.user1_status = 'done' OR mp.user2_status = 'done'`
    );

    const pairs = result.rows;
    const now = new Date();

    for (const pair of pairs) {
      const holdEnd = new Date(pair.created_at);
      holdEnd.setHours(holdEnd.getHours() + pair.hold_hours);

      // Проверяем только если период удержания прошёл
      if (now >= holdEnd) {
        const channel = await getChannel(pair.channel_id);
        if (!channel) continue;

        // Проверяем подписки
        const user1Subscribed = await checkSubscription(pair.user1_id, channel.tg_id);
        const user2Subscribed = await checkSubscription(pair.user2_id, channel.tg_id);

        // Штрафуем за отписку
        if (pair.user1_status === 'done' && !user1Subscribed) {
          await updateUserRating(pair.user1_id, -10);
          await updateMutualPairStatus(pair.id, pair.user1_id, 'failed');
          await notifyViolation(pair.user1_id, 'Отписка раньше срока удержания');
        }

        if (pair.user2_status === 'done' && !user2Subscribed) {
          await updateUserRating(pair.user2_id, -10);
          await updateMutualPairStatus(pair.id, pair.user2_id, 'failed');
          await notifyViolation(pair.user2_id, 'Отписка раньше срока удержания');
        }
      }
    }
  } catch (error) {
    console.error('Error checking hold periods:', error);
  }
};

// Проверка активности каналов
export const checkChannelsActivity = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM channels WHERE is_active = TRUE'
    );

    const channels = result.rows;
    const bot = (await import('../bot.js')).default;

    for (const channel of channels) {
      try {
        // Проверяем, является ли бот админом
        const chatMember = await bot.getChatMember(channel.tg_id, (await bot.getMe()).id);
        const isBotAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator';

        if (!isBotAdmin) {
          // Деактивируем канал, если бот не админ
          await pool.query(
            'UPDATE channels SET is_active = FALSE WHERE id = $1',
            [channel.id]
          );
        }
      } catch (error) {
        // Если канал недоступен, деактивируем
        await pool.query(
          'UPDATE channels SET is_active = FALSE WHERE id = $1',
          [channel.id]
        );
      }
    }
  } catch (error) {
    console.error('Error checking channels activity:', error);
  }
};

// Запуск периодических проверок
export const startScheduler = () => {
  // Проверка удержания каждые 6 часов
  setInterval(checkHoldPeriods, 6 * 60 * 60 * 1000);
  
  // Проверка активности каналов каждые 12 часов
  setInterval(checkChannelsActivity, 12 * 60 * 60 * 1000);
  
  // Удаление старых чатов каждые час
  setInterval(expireOldChats, 60 * 60 * 1000);

  console.log('Scheduler started');
};

