import pool from '../db/pool.js';
import { checkChatMembership, getChatInfo, extractChatIdFromLink } from '../utils/telegram.js';
import { getBotInstance } from '../bot/bot.js';

export async function addChannelHandler(req, res) {
  try {
    const userId = req.userId;
    const { link, type } = req.body;

    if (!link || !['channel', 'chat'].includes(type)) {
      return res.status(400).json({ error: 'Invalid link or type' });
    }

    // Validate user is not banned
    const userResult = await pool.query('SELECT is_banned FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].is_banned) {
      return res.status(403).json({ error: 'User is banned' });
    }

    // Extract chat ID from link
    const chatIdInfo = extractChatIdFromLink(link);
    if (!chatIdInfo) {
      return res.status(400).json({ error: 'Invalid Telegram link format' });
    }

    // Get chat info from Telegram
    const chatInfo = await getChatInfo(chatIdInfo.value);
    if (!chatInfo) {
      return res.status(400).json({ error: 'Channel/chat not found or bot cannot access it' });
    }

    // Verify user is admin
    const isAdmin = await checkChatMembership(chatInfo.id, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'You must be an administrator of this channel/chat' });
    }

    // Check if channel already exists
    const existingChannel = await pool.query(
      'SELECT id FROM channels WHERE tg_id = $1',
      [chatInfo.id]
    );

    if (existingChannel.rows.length > 0) {
      return res.status(400).json({ error: 'Channel already added' });
    }

    // Add channel to database
    const result = await pool.query(
      `INSERT INTO channels (owner_id, tg_id, title, type, members_count, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING *`,
      [userId, chatInfo.id, chatInfo.title, type, chatInfo.members_count || 0]
    );

    const channel = result.rows[0];

    res.json({
      success: true,
      channel: {
        id: channel.id,
        title: channel.title,
        type: channel.type,
        members_count: channel.members_count,
        rating: channel.rating,
        created_at: channel.created_at
      }
    });
  } catch (err) {
    console.error('Add channel error:', err);
    res.status(500).json({ error: 'Failed to add channel' });
  }
}

export async function getChannelsHandler(req, res) {
  try {
    const userId = req.userId;

    const result = await pool.query(`
      SELECT id, title, type, members_count, rating, is_active, created_at
      FROM channels
      WHERE owner_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      channels: result.rows
    });
  } catch (err) {
    console.error('Get channels error:', err);
    res.status(500).json({ error: 'Failed to get channels' });
  }
}

export async function getChannelHandler(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM channels
      WHERE id = $1 AND owner_id = $2
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({
      channel: result.rows[0]
    });
  } catch (err) {
    console.error('Get channel error:', err);
    res.status(500).json({ error: 'Failed to get channel' });
  }
}

export async function deleteChannelHandler(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const channelResult = await pool.query(
      'SELECT owner_id FROM channels WHERE id = $1',
      [id]
    );

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channelResult.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own channels' });
    }

    // Soft delete
    await pool.query(
      'UPDATE channels SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Delete channel error:', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
}
