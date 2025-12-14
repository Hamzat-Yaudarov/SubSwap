import pool from '../db/pool.js';
import { checkChatMembership } from '../utils/telegram.js';
import { sendNotification } from '../bot/bot.js';

export async function createMutualHandler(req, res) {
  try {
    const userId = req.userId;
    const { channel_id, mutual_type, required_count = 1, hold_hours = 24 } = req.body;

    // Validate user is not banned
    const userResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].rating < 60) {
      return res.status(403).json({ error: 'Your rating is too low to create mutuals' });
    }

    // Verify channel ownership
    const channelResult = await pool.query(
      'SELECT id, is_active FROM channels WHERE id = $1 AND owner_id = $2',
      [channel_id, userId]
    );

    if (channelResult.rows.length === 0 || !channelResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Channel not found or inactive' });
    }

    // Validate mutual type
    if (!['subscribe', 'reaction'].includes(mutual_type)) {
      return res.status(400).json({ error: 'Invalid mutual type' });
    }

    // Create mutual
    const result = await pool.query(`
      INSERT INTO mutuals (creator_id, channel_id, mutual_type, required_count, hold_hours, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'active', NOW())
      RETURNING *
    `, [userId, channel_id, mutual_type, required_count, hold_hours]);

    const mutual = result.rows[0];

    res.json({
      success: true,
      mutual: {
        id: mutual.id,
        channel_id: mutual.channel_id,
        mutual_type: mutual.mutual_type,
        required_count: mutual.required_count,
        hold_hours: mutual.hold_hours,
        status: mutual.status,
        created_at: mutual.created_at
      }
    });
  } catch (err) {
    console.error('Create mutual error:', err);
    res.status(500).json({ error: 'Failed to create mutual' });
  }
}

export async function getMutualsHandler(req, res) {
  try {
    const userId = req.userId;

    const result = await pool.query(`
      SELECT 
        m.id,
        m.channel_id,
        m.mutual_type,
        m.required_count,
        m.hold_hours,
        m.status,
        m.created_at,
        c.title,
        c.members_count,
        u.rating as creator_rating
      FROM mutuals m
      JOIN channels c ON c.id = m.channel_id
      JOIN users u ON u.id = m.creator_id
      WHERE m.creator_id = $1
      ORDER BY m.created_at DESC
    `, [userId]);

    res.json({
      mutuals: result.rows
    });
  } catch (err) {
    console.error('Get mutuals error:', err);
    res.status(500).json({ error: 'Failed to get mutuals' });
  }
}

export async function getMutualHandler(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        m.*,
        c.title,
        c.type as channel_type,
        c.members_count,
        u.rating as creator_rating
      FROM mutuals m
      JOIN channels c ON c.id = m.channel_id
      JOIN users u ON u.id = m.creator_id
      WHERE m.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mutual not found' });
    }

    res.json({
      mutual: result.rows[0]
    });
  } catch (err) {
    console.error('Get mutual error:', err);
    res.status(500).json({ error: 'Failed to get mutual' });
  }
}

export async function listAvailableMutualsHandler(req, res) {
  try {
    const userId = req.userId;
    const { mutual_type } = req.query;

    // Check user rating
    const userResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].rating < 60) {
      return res.status(403).json({ error: 'Your rating is too low to participate' });
    }

    let query = `
      SELECT 
        m.id,
        m.channel_id,
        m.mutual_type,
        m.required_count,
        m.hold_hours,
        m.status,
        m.created_at,
        c.title,
        c.type as channel_type,
        c.members_count,
        u.rating as creator_rating
      FROM mutuals m
      JOIN channels c ON c.id = m.channel_id
      JOIN users u ON u.id = m.creator_id
      WHERE m.status = 'active'
        AND m.creator_id != $1
        AND c.is_active = true
        AND u.is_banned = false
    `;

    const params = [userId];

    if (mutual_type && ['subscribe', 'reaction'].includes(mutual_type)) {
      query += ` AND m.mutual_type = $${params.length + 1}`;
      params.push(mutual_type);
    }

    query += ` ORDER BY m.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({
      mutuals: result.rows
    });
  } catch (err) {
    console.error('List available mutuals error:', err);
    res.status(500).json({ error: 'Failed to list mutuals' });
  }
}

export async function joinMutualHandler(req, res) {
  try {
    const userId = req.userId;
    const { id: mutualId } = req.params;

    // Check user rating
    const userResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].rating < 60) {
      return res.status(403).json({ error: 'Your rating is too low' });
    }

    // Get mutual info
    const mutualResult = await pool.query(
      `SELECT m.*, c.tg_id as channel_tg_id 
       FROM mutuals m 
       JOIN channels c ON c.id = m.channel_id 
       WHERE m.id = $1 AND m.status = 'active'`,
      [mutualId]
    );

    if (mutualResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mutual not found or inactive' });
    }

    const mutual = mutualResult.rows[0];

    // Check if already participating
    const existingAction = await pool.query(
      'SELECT id FROM actions WHERE mutual_id = $1 AND user_id = $2',
      [mutualId, userId]
    );

    if (existingAction.rows.length > 0) {
      return res.status(400).json({ error: 'Already participating in this mutual' });
    }

    // Create action (task for user)
    const actionResult = await pool.query(`
      INSERT INTO actions (mutual_id, user_id, status, created_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING *
    `, [mutualId, userId]);

    const action = actionResult.rows[0];

    // Send notification to creator
    await sendNotification(
      mutual.creator_id,
      `🎯 Найдена взаимка! Пользователь начал выполнять ваше задание.`
    );

    res.json({
      success: true,
      action: {
        id: action.id,
        mutual_id: action.mutual_id,
        status: action.status,
        created_at: action.created_at
      }
    });
  } catch (err) {
    console.error('Join mutual error:', err);
    res.status(500).json({ error: 'Failed to join mutual' });
  }
}

export async function checkMutualHandler(req, res) {
  try {
    const userId = req.userId;
    const { id: mutualId } = req.params;

    // Get action info
    const actionResult = await pool.query(
      `SELECT a.*, m.*, c.tg_id as channel_tg_id
       FROM actions a
       JOIN mutuals m ON m.id = a.mutual_id
       JOIN channels c ON c.id = m.channel_id
       WHERE a.mutual_id = $1 AND a.user_id = $2`,
      [mutualId, userId]
    );

    if (actionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const action = actionResult.rows[0];
    const channelTgId = action.channel_tg_id;

    let isValid = false;

    // Check subscription or reaction based on mutual type
    if (action.mutual_type === 'subscribe') {
      isValid = await checkChatMembership(channelTgId, userId);
    } else if (action.mutual_type === 'reaction') {
      // For reactions, we would need post_id and emoji
      // This is simplified - in production, store and verify specific reactions
      isValid = true; // Assume true for now
    }

    if (!isValid) {
      // Mark as failed
      await pool.query(
        'UPDATE actions SET status = $1, checked_at = NOW() WHERE id = $2',
        ['failed', action.id]
      );

      return res.status(400).json({ error: 'Action not verified' });
    }

    // Mark as done
    await pool.query(
      'UPDATE actions SET status = $1, checked_at = NOW() WHERE id = $2',
      ['done', action.id]
    );

    // Update user rating
    const userUpdateResult = await pool.query(
      'UPDATE users SET rating = rating + 2 WHERE id = $1 RETURNING rating',
      [userId]
    );

    // Send notifications
    await sendNotification(userId, `✅ Взаимка выполнена! Рейтинг +2`);
    await sendNotification(action.creator_id, `✅ Пользователь выполнил вашу взаимку!`);

    res.json({
      success: true,
      message: 'Action verified',
      new_rating: userUpdateResult.rows[0].rating
    });
  } catch (err) {
    console.error('Check mutual error:', err);
    res.status(500).json({ error: 'Failed to check mutual' });
  }
}
