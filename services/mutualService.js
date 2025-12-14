import pool from '../db/index.js';
import {
  getActiveMutuals,
  getMutual,
  createMutualPair,
  updateMutualPairStatus,
  updateUserRating,
  getUser,
  getChannel
} from '../db/queries.js';
import { checkSubscription } from '../bot.js';

// Автоматический подбор партнёров для взаимки
export const findPartners = async (mutualId) => {
  const mutual = await getMutual(mutualId);
  if (!mutual || mutual.status !== 'active') {
    return null;
  }

  // Получаем все активные взаимки других пользователей
  const availableMutuals = await getActiveMutuals(mutual.mutual_type);
  
  // Фильтруем по размеру канала и рейтингу
  const creator = await getUser(mutual.creator_id);
  const mutualChannel = await getChannel(mutual.channel_id);
  
  const suitableMutuals = [];
  for (const m of availableMutuals) {
    if (m.creator_id === mutual.creator_id) continue;
    if (m.id === mutualId) continue;
    
    const partner = await getUser(m.creator_id);
    const partnerChannel = await getChannel(m.channel_id);
    
    // Проверяем рейтинг (должен быть >= 60)
    if (partner.rating < 60) continue;
    
    // Проверяем размер каналов (примерное соответствие)
    const sizeDiff = Math.abs(mutualChannel.members_count - partnerChannel.members_count);
    const maxDiff = Math.max(mutualChannel.members_count, partnerChannel.members_count) * 0.5;
    
    if (sizeDiff <= maxDiff) {
      suitableMutuals.push(m);
    }
  }

  return suitableMutuals.slice(0, 5); // Возвращаем до 5 подходящих
};

// Проверка выполнения взаимки
export const checkMutualCompletion = async (pairId) => {
  const result = await pool.query(
    `SELECT mp.*, m.* 
     FROM mutual_pairs mp
     JOIN mutuals m ON mp.mutual_id = m.id
     WHERE mp.id = $1`,
    [pairId]
  );
  
  const pair = result.rows[0];
  if (!pair) return false;

  // Проверяем подписки обоих пользователей
  const channel = await getChannel(pair.channel_id);
  const user1Subscribed = await checkSubscription(pair.user1_id, channel.tg_id);
  const user2Subscribed = await checkSubscription(pair.user2_id, channel.tg_id);

  // Обновляем статусы
  if (user1Subscribed && pair.user1_status === 'pending') {
    await updateMutualPairStatus(pairId, pair.user1_id, 'done');
  }
  if (user2Subscribed && pair.user2_status === 'pending') {
    await updateMutualPairStatus(pairId, pair.user2_id, 'done');
  }

  // Если оба выполнили, начисляем рейтинг
  const updatedPairResult = await pool.query(
    'SELECT * FROM mutual_pairs WHERE id = $1',
    [pairId]
  );
  const updatedPair = updatedPairResult.rows[0];
  
  if (updatedPair && updatedPair.user1_status === 'done' && 
      updatedPair.user2_status === 'done') {
    await updateUserRating(pair.user1_id, 2);
    await updateUserRating(pair.user2_id, 2);
    return true;
  }

  return false;
};

// Проверка удержания подписки (используется в scheduler)
export const checkHoldPeriod = async (pairId) => {
  const result = await pool.query(
    `SELECT mp.*, m.hold_hours, m.created_at, m.channel_id
     FROM mutual_pairs mp
     JOIN mutuals m ON mp.mutual_id = m.id
     WHERE mp.id = $1`,
    [pairId]
  );
  
  const pair = result.rows[0];
  if (!pair) return;

  const holdEnd = new Date(pair.created_at);
  holdEnd.setHours(holdEnd.getHours() + pair.hold_hours);
  const now = new Date();

  if (now < holdEnd) {
    // Период удержания ещё не прошёл
    return;
  }

  // Проверяем, подписан ли пользователь всё ещё
  const channel = await getChannel(pair.channel_id);
  if (!channel) return;

  const user1Subscribed = await checkSubscription(pair.user1_id, channel.tg_id);
  const user2Subscribed = await checkSubscription(pair.user2_id, channel.tg_id);

  // Штрафуем за отписку
  if (!user1Subscribed && pair.user1_status === 'done') {
    await updateUserRating(pair.user1_id, -10);
    await updateMutualPairStatus(pair.id, pair.user1_id, 'failed');
  }
  if (!user2Subscribed && pair.user2_status === 'done') {
    await updateUserRating(pair.user2_id, -10);
    await updateMutualPairStatus(pair.id, pair.user2_id, 'failed');
  }
};


