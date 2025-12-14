import pool from './index.js';

// Users
export const getUser = async (userId) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
};

export const createUser = async (userId) => {
  const result = await pool.query(
    'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING *',
    [userId]
  );
  return result.rows[0];
};

export const updateUserRating = async (userId, delta) => {
  await pool.query(
    'UPDATE users SET rating = GREATEST(0, rating + $1) WHERE id = $2',
    [delta, userId]
  );
};

export const banUser = async (userId) => {
  await pool.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [userId]);
};

// Channels
export const getChannelsByOwner = async (ownerId) => {
  const result = await pool.query(
    'SELECT * FROM channels WHERE owner_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
    [ownerId]
  );
  return result.rows;
};

export const getChannel = async (channelId) => {
  const result = await pool.query('SELECT * FROM channels WHERE id = $1', [channelId]);
  return result.rows[0];
};

export const getChannelByTgId = async (tgId) => {
  const result = await pool.query('SELECT * FROM channels WHERE tg_id = $1', [tgId]);
  return result.rows[0];
};

export const addChannel = async (channelData) => {
  const { ownerId, tgId, username, title, type, membersCount } = channelData;
  // Проверяем, существует ли канал
  const existing = await getChannelByTgId(tgId);
  if (existing) {
    // Обновляем, если канал уже существует
    await pool.query(
      `UPDATE channels 
       SET owner_id = $1, username = $2, title = $3, type = $4, members_count = $5, is_active = TRUE
       WHERE tg_id = $6`,
      [ownerId, username || null, title, type, membersCount || 0, tgId]
    );
    return await getChannelByTgId(tgId);
  }
  const result = await pool.query(
    `INSERT INTO channels (owner_id, tg_id, username, title, type, members_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ownerId, tgId, username || null, title, type, membersCount || 0]
  );
  return result.rows[0];
};

export const updateChannelMembers = async (channelId, membersCount) => {
  await pool.query('UPDATE channels SET members_count = $1 WHERE id = $2', [membersCount, channelId]);
};

export const deactivateChannel = async (channelId) => {
  await pool.query('UPDATE channels SET is_active = FALSE WHERE id = $1', [channelId]);
};

// Mutuals
export const createMutual = async (mutualData) => {
  const { creatorId, channelId, mutualType, requiredCount, holdHours } = mutualData;
  const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000);
  const result = await pool.query(
    `INSERT INTO mutuals (creator_id, channel_id, mutual_type, required_count, hold_hours, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [creatorId, channelId, mutualType, requiredCount, holdHours, expiresAt]
  );
  return result.rows[0];
};

export const getActiveMutuals = async (mutualType = null) => {
  let query = 'SELECT * FROM mutuals WHERE status = $1 AND expires_at > NOW()';
  let params = ['active'];
  
  if (mutualType) {
    query += ' AND mutual_type = $2';
    params.push(mutualType);
  }
  
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
};

export const getMutual = async (mutualId) => {
  const result = await pool.query('SELECT * FROM mutuals WHERE id = $1', [mutualId]);
  return result.rows[0];
};

export const completeMutual = async (mutualId) => {
  await pool.query('UPDATE mutuals SET status = $1 WHERE id = $2', ['completed', mutualId]);
};

// Actions
export const createAction = async (mutualId, userId) => {
  const result = await pool.query(
    `INSERT INTO actions (mutual_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (mutual_id, user_id) DO NOTHING
     RETURNING *`,
    [mutualId, userId]
  );
  return result.rows[0];
};

export const updateActionStatus = async (mutualId, userId, status) => {
  await pool.query(
    'UPDATE actions SET status = $1, checked_at = NOW() WHERE mutual_id = $2 AND user_id = $3',
    [status, mutualId, userId]
  );
};

export const getUserActions = async (userId) => {
  const result = await pool.query(
    `SELECT a.*, m.*, c.title as channel_title
     FROM actions a
     JOIN mutuals m ON a.mutual_id = m.id
     JOIN channels c ON m.channel_id = c.id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Chat Posts
export const createChatPost = async (postData) => {
  const { userId, channelId, postType, conditions } = postData;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
  const result = await pool.query(
    `INSERT INTO chat_posts (user_id, channel_id, post_type, conditions, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, channelId, postType, conditions, expiresAt]
  );
  return result.rows[0];
};

export const getActiveChatPosts = async (postType = null) => {
  let query = 'SELECT * FROM chat_posts WHERE is_active = TRUE AND expires_at > NOW()';
  let params = [];
  
  if (postType) {
    query += ' AND post_type = $1';
    params.push(postType);
  }
  
  query += ' ORDER BY created_at DESC LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
};

export const deactivateChatPost = async (postId) => {
  await pool.query('UPDATE chat_posts SET is_active = FALSE WHERE id = $1', [postId]);
};

export const getUserChatPostsCount = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM chat_posts
     WHERE user_id = $1
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  return parseInt(result.rows[0].count);
};

// Mutual Pairs
export const createMutualPair = async (mutualId, user1Id, user2Id) => {
  const result = await pool.query(
    `INSERT INTO mutual_pairs (mutual_id, user1_id, user2_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [mutualId, user1Id, user2Id]
  );
  return result.rows[0];
};

export const updateMutualPairStatus = async (pairId, userId, status) => {
  const result = await pool.query(
    `SELECT user1_id, user2_id FROM mutual_pairs WHERE id = $1`,
    [pairId]
  );
  const pair = result.rows[0];
  
  if (pair.user1_id === userId) {
    await pool.query('UPDATE mutual_pairs SET user1_status = $1 WHERE id = $2', [status, pairId]);
  } else if (pair.user2_id === userId) {
    await pool.query('UPDATE mutual_pairs SET user2_status = $1 WHERE id = $2', [status, pairId]);
  }
};

export const getMutualPairsForUser = async (userId) => {
  const result = await pool.query(
    `SELECT mp.*, m.*, c.title as channel_title
     FROM mutual_pairs mp
     JOIN mutuals m ON mp.mutual_id = m.id
     JOIN channels c ON m.channel_id = c.id
     WHERE (mp.user1_id = $1 OR mp.user2_id = $1)
     AND m.status = 'active'
     ORDER BY mp.created_at DESC`,
    [userId]
  );
  return result.rows;
};

