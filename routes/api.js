import express from 'express';
import pool from '../db/pool.js';
import { validateWebAppData } from '../utils/telegram.js';
import { 
  authHandler, 
  getProfileHandler, 
  updateProfileHandler 
} from '../handlers/auth.js';
import {
  addChannelHandler,
  getChannelsHandler,
  getChannelHandler,
  deleteChannelHandler
} from '../handlers/channels.js';
import {
  createMutualHandler,
  getMutualsHandler,
  getMutualHandler,
  joinMutualHandler,
  checkMutualHandler,
  listAvailableMutualsHandler
} from '../handlers/mutuals.js';
import {
  createChatPostHandler,
  getChatPostsHandler,
  respondToChatHandler,
  deletePostHandler
} from '../handlers/chat.js';

const router = express.Router();

// Middleware to extract and validate user from WebApp
const validateUser = async (req, res, next) => {
  try {
    const initData = req.headers['x-init-data'] || req.query.initData;
    
    if (!initData) {
      return res.status(401).json({ error: 'No init data provided' });
    }

    // Parse init data
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user'));
    
    req.userId = user.id;
    req.user = user;
    
    // Ensure user exists in database
    await pool.query(
      'INSERT INTO users (id, rating, created_at) VALUES ($1, 100, NOW()) ON CONFLICT (id) DO NOTHING',
      [user.id]
    );

    next();
  } catch (err) {
    console.error('User validation error:', err);
    res.status(401).json({ error: 'Invalid init data' });
  }
};

// Apply user validation middleware to all API routes
router.use(validateUser);

// Auth routes
router.post('/auth', authHandler);
router.get('/profile', getProfileHandler);
router.patch('/profile', updateProfileHandler);

// Channel routes
router.post('/channels/add', addChannelHandler);
router.get('/channels', getChannelsHandler);
router.get('/channels/:id', getChannelHandler);
router.delete('/channels/:id', deleteChannelHandler);

// Mutual routes
router.post('/mutuals/create', createMutualHandler);
router.get('/mutuals', getMutualsHandler);
router.get('/mutuals/available', listAvailableMutualsHandler);
router.get('/mutuals/:id', getMutualHandler);
router.post('/mutuals/:id/join', joinMutualHandler);
router.post('/mutuals/:id/check', checkMutualHandler);

// Chat routes
router.post('/chat/post', createChatPostHandler);
router.get('/chat/posts', getChatPostsHandler);
router.post('/chat/:postId/respond', respondToChatHandler);
router.delete('/chat/:postId', deletePostHandler);

export function setupApiRoutes(app) {
  app.use('/api', router);
}
