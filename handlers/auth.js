import pool from '../db/pool.js';

export async function authHandler(req, res) {
  try {
    const userId = req.userId;

    // Ensure user exists
    await pool.query(
      'INSERT INTO users (id, rating, created_at) VALUES ($1, 100, NOW()) ON CONFLICT (id) DO NOTHING',
      [userId]
    );

    // Get user data
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        rating: user.rating,
        created_at: user.created_at,
        is_banned: user.is_banned
      }
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function getProfileHandler(req, res) {
  try {
    const userId = req.userId;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.rating,
        u.created_at,
        u.is_banned,
        COUNT(DISTINCT c.id) as channels_count,
        COUNT(DISTINCT CASE WHEN m.status = 'completed' THEN m.id END) as completed_mutuals,
        COUNT(DISTINCT CASE WHEN m.status = 'active' THEN m.id END) as active_mutuals
      FROM users u
      LEFT JOIN channels c ON c.owner_id = u.id AND c.is_active = true
      LEFT JOIN mutuals m ON m.creator_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Get recent mutuals
    const mutualsResult = await pool.query(`
      SELECT m.id, c.title, m.mutual_type, m.status, m.created_at
      FROM mutuals m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.creator_id = $1
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [userId]);

    res.json({
      user: {
        id: user.id,
        rating: user.rating,
        created_at: user.created_at,
        is_banned: user.is_banned,
        channels_count: parseInt(user.channels_count),
        completed_mutuals: parseInt(user.completed_mutuals),
        active_mutuals: parseInt(user.active_mutuals)
      },
      recent_mutuals: mutualsResult.rows
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

export async function updateProfileHandler(req, res) {
  try {
    const userId = req.userId;
    const { rating, is_banned } = req.body;

    // Only allow updating own profile, and only rating can be updated by user
    const updates = [];
    const values = [userId];
    let paramIndex = 2;

    if (typeof rating !== 'undefined') {
      updates.push(`rating = $${paramIndex++}`);
      values.splice(1, 0, rating);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}
