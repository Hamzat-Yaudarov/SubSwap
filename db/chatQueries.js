import pool from './index.js';

// Chats
export const createChat = async (user1Id, user2Id, mutualId = null) => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
  const result = await pool.query(
    `INSERT INTO chats (user1_id, user2_id, mutual_id, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user1_id, user2_id, mutual_id) DO UPDATE
     SET status = 'active', expires_at = $4
     RETURNING *`,
    [user1Id, user2Id, mutualId, expiresAt]
  );
  return result.rows[0];
};

export const getChat = async (chatId) => {
  const result = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId]);
  return result.rows[0];
};

export const getUserChats = async (userId) => {
  const result = await pool.query(
    `SELECT c.*, 
            u1.id as user1_telegram_id,
            u2.id as user2_telegram_id,
            m.id as mutual_id,
            m.channel_id,
            ch.title as channel_title
     FROM chats c
     LEFT JOIN users u1 ON c.user1_id = u1.id
     LEFT JOIN users u2 ON c.user2_id = u2.id
     LEFT JOIN mutuals m ON c.mutual_id = m.id
     LEFT JOIN channels ch ON m.channel_id = ch.id
     WHERE (c.user1_id = $1 OR c.user2_id = $1)
     AND c.status = 'active'
     AND c.expires_at > NOW()
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getChatByUsers = async (user1Id, user2Id, mutualId = null) => {
  let query = `SELECT * FROM chats 
               WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))`;
  let params = [user1Id, user2Id];
  
  if (mutualId) {
    query += ' AND mutual_id = $3';
    params.push(mutualId);
  } else {
    query += ' AND mutual_id IS NULL';
  }
  
  query += ' AND status = \'active\' AND expires_at > NOW()';
  
  const result = await pool.query(query, params);
  return result.rows[0];
};

export const markChatCompleted = async (chatId, userId) => {
  const chat = await getChat(chatId);
  if (!chat) return null;
  
  if (chat.user1_id === userId) {
    await pool.query('UPDATE chats SET user1_completed = TRUE WHERE id = $1', [chatId]);
  } else if (chat.user2_id === userId) {
    await pool.query('UPDATE chats SET user2_completed = TRUE WHERE id = $1', [chatId]);
  }
  
  // Проверяем, оба ли выполнили
  const updated = await getChat(chatId);
  if (updated.user1_completed && updated.user2_completed) {
    await pool.query('UPDATE chats SET status = \'completed\' WHERE id = $1', [chatId]);
  }
  
  return updated;
};

export const expireOldChats = async () => {
  await pool.query(
    `UPDATE chats 
     SET status = 'expired' 
     WHERE expires_at <= NOW() AND status = 'active'`
  );
};

// Messages
export const addMessage = async (chatId, userId, text) => {
  const result = await pool.query(
    `INSERT INTO messages (chat_id, user_id, text)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [chatId, userId, text]
  );
  return result.rows[0];
};

export const getChatMessages = async (chatId, limit = 100) => {
  const result = await pool.query(
    `SELECT m.*, u.id as user_telegram_id
     FROM messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.chat_id = $1
     ORDER BY m.created_at ASC
     LIMIT $2`,
    [chatId, limit]
  );
  return result.rows;
};

// General Chat
export const addGeneralChatMessage = async (userId, text) => {
  const result = await pool.query(
    `INSERT INTO general_chat_messages (user_id, text)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, text]
  );
  return result.rows[0];
};

export const getGeneralChatMessages = async (limit = 100) => {
  const result = await pool.query(
    `SELECT m.*, u.id as user_telegram_id
     FROM general_chat_messages m
     JOIN users u ON m.user_id = u.id
     ORDER BY m.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.reverse(); // Возвращаем в хронологическом порядке
};

