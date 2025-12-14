import express from 'express';
import pool from '../db/index.js';
import { banUser, getUser } from '../db/queries.js';

const router = express.Router();

// Простая проверка админа (в production использовать более надёжную систему)
const isAdmin = (req, res, next) => {
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
  const userId = parseInt(req.query.userId || req.body.userId);
  
  if (!adminIds.includes(userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
};

// Список пользователей
router.get('/users', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, rating, created_at, is_banned FROM users ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Список каналов
router.get('/channels', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.id as owner_telegram_id
       FROM channels c
       JOIN users u ON c.owner_id = u.id
       ORDER BY c.created_at DESC LIMIT 100`
    );
    res.json({ channels: result.rows });
  } catch (error) {
    console.error('Admin channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Забанить пользователя
router.post('/users/ban', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    await banUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin ban error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Удалить сообщение из чата
router.post('/chat/delete', isAdmin, async (req, res) => {
  try {
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    await pool.query('UPDATE chat_posts SET is_active = FALSE WHERE id = $1', [postId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Статистика
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const channelsCount = await pool.query('SELECT COUNT(*) as count FROM channels WHERE is_active = TRUE');
    const mutualsCount = await pool.query('SELECT COUNT(*) as count FROM mutuals WHERE status = $1', ['active']);
    
    res.json({
      users: parseInt(usersCount.rows[0].count),
      channels: parseInt(channelsCount.rows[0].count),
      active_mutuals: parseInt(mutualsCount.rows[0].count)
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

