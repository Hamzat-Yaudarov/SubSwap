import pool from '../db/pool.js';
import { sendNotification } from '../bot/bot.js';

export async function createChatPostHandler(req, res) {
  try {
    const userId = req.userId;
    const { channel_id, post_type, conditions } = req.body;

    // Check user rating (min 80 to post in chat)
    const userResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].rating < 80) {
      return res.status(403).json({ error: 'Your rating must be at least 80 to create chat posts' });
    }

    // Verify channel ownership
    const channelResult = await pool.query(
      'SELECT id, is_active FROM channels WHERE id = $1 AND owner_id = $2',
      [channel_id, userId]
    );

    if (channelResult.rows.length === 0 || !channelResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Channel not found or inactive' });
    }

    // Check daily post limit (3 per day)
    const postCountResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM chat_posts
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]);

    if (parseInt(postCountResult.rows[0].count) >= 3) {
      return res.status(429).json({ error: 'Daily post limit reached (3 posts per day)' });
    }

    // Check if last post was within last hour (re-post cooldown)
    const lastPostResult = await pool.query(`
      SELECT created_at
      FROM chat_posts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (lastPostResult.rows.length > 0) {
      const lastPostTime = new Date(lastPostResult.rows[0].created_at).getTime();
      const timeSinceLastPost = (Date.now() - lastPostTime) / 1000 / 60; // minutes
      
      if (timeSinceLastPost < 60) {
        return res.status(429).json({ 
          error: `Re-post cooldown. Wait ${Math.ceil(60 - timeSinceLastPost)} minutes` 
        });
      }
    }

    // Validate post type
    if (!['channel', 'chat', 'reaction'].includes(post_type)) {
      return res.status(400).json({ error: 'Invalid post type' });
    }

    // Create post
    const result = await pool.query(`
      INSERT INTO chat_posts (user_id, channel_id, post_type, conditions, created_at, expires_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')
      RETURNING *
    `, [userId, channel_id, post_type, conditions]);

    const post = result.rows[0];

    res.json({
      success: true,
      post: {
        id: post.id,
        channel_id: post.channel_id,
        post_type: post.post_type,
        conditions: post.conditions,
        created_at: post.created_at,
        expires_at: post.expires_at
      }
    });
  } catch (err) {
    console.error('Create chat post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
}

export async function getChatPostsHandler(req, res) {
  try {
    const { post_type } = req.query;

    let query = `
      SELECT 
        p.id,
        p.user_id,
        p.channel_id,
        p.post_type,
        p.conditions,
        p.created_at,
        p.expires_at,
        c.title as channel_title,
        c.members_count,
        u.rating as creator_rating
      FROM chat_posts p
      JOIN channels c ON c.id = p.channel_id
      JOIN users u ON u.id = p.user_id
      WHERE p.expires_at > NOW()
        AND c.is_active = true
        AND u.is_banned = false
    `;

    const params = [];

    if (post_type && ['channel', 'chat', 'reaction'].includes(post_type)) {
      query += ` AND p.post_type = $${params.length + 1}`;
      params.push(post_type);
    }

    query += ` ORDER BY p.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    // Calculate time ago for each post
    const posts = result.rows.map(post => ({
      ...post,
      time_ago: getTimeAgo(post.created_at)
    }));

    res.json({
      posts
    });
  } catch (err) {
    console.error('Get chat posts error:', err);
    res.status(500).json({ error: 'Failed to get posts' });
  }
}

export async function respondToChatHandler(req, res) {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    // Get post info
    const postResult = await pool.query(
      `SELECT p.*, c.tg_id as channel_tg_id, u.id as creator_id
       FROM chat_posts p
       JOIN channels c ON c.id = p.channel_id
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND p.expires_at > NOW()`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or expired' });
    }

    const post = postResult.rows[0];

    // Check if already responded
    const existingMutual = await pool.query(
      `SELECT id FROM mutuals m
       JOIN actions a ON a.mutual_id = m.id
       WHERE m.creator_id = $1 
         AND a.user_id = $2 
         AND m.channel_id = $3`,
      [post.creator_id, userId, post.channel_id]
    );

    if (existingMutual.rows.length > 0) {
      return res.status(400).json({ error: 'Already responded to this user for this channel' });
    }

    // Create a mutual from the response
    const mutualResult = await pool.query(`
      INSERT INTO mutuals (creator_id, channel_id, mutual_type, required_count, hold_hours, status, created_at)
      VALUES ($1, $2, $3, 1, 24, 'active', NOW())
      RETURNING *
    `, [post.creator_id, post.channel_id, post.post_type === 'reaction' ? 'reaction' : 'subscribe']);

    const mutual = mutualResult.rows[0];

    // Create action for responder
    await pool.query(
      `INSERT INTO actions (mutual_id, user_id, status, created_at)
       VALUES ($1, $2, 'pending', NOW())`,
      [mutual.id, userId]
    );

    // Hide post (mark expired)
    await pool.query(
      `UPDATE chat_posts SET expires_at = NOW() WHERE id = $1`,
      [postId]
    );

    // Send notifications
    await sendNotification(post.creator_id, `🎯 ${userId} откликнулся на вашу взаимку!`);
    await sendNotification(userId, `✅ Откликнулись на взаимку!`);

    res.json({
      success: true,
      mutual_id: mutual.id
    });
  } catch (err) {
    console.error('Respond to chat error:', err);
    res.status(500).json({ error: 'Failed to respond' });
  }
}

export async function deletePostHandler(req, res) {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    // Verify ownership
    const postResult = await pool.query(
      'SELECT user_id FROM chat_posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Delete post
    await pool.query('DELETE FROM chat_posts WHERE id = $1', [postId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return `${seconds}с назад`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}м назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч назад`;
  return `${Math.floor(seconds / 86400)}д назад`;
}
