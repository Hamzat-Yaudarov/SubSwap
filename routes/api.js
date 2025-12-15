import express from 'express';
import pool from '../db/index.js';
import {
  getUser,
  createUser,
  getChannelsByOwner,
  addChannel,
  getChannel,
  createMutual,
  getActiveMutuals,
  getMutual,
  createAction,
  updateActionStatus,
  getUserActions,
  createChatPost,
  getActiveChatPosts,
  deactivateChatPost,
  getUserChatPostsCount,
  createMutualPair,
  getMutualPairsForUser,
  updateMutualPairStatus,
  updateUserRating
} from '../db/queries.js';
import bot, {
  checkSubscription,
  checkBotAdmin,
  checkUserAdmin,
  getChannelInfo,
  notifyMutualFound
} from '../bot.js';

const router = express.Router();

// Middleware для проверки Telegram WebApp данных
const verifyTelegramWebApp = (req, res, next) => {
  // В production нужно проверять initData от Telegram
  // Для MVP упрощаем и проверяем только наличие userId
  const initData = req.headers['x-telegram-init-data'] || req.body.initData;
  
  // Парсим initData (упрощённая версия)
  // В production используйте crypto для проверки подписи
  try {
    if (initData) {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr));
        req.userId = user.id;
        req.user = user;
      }
    }
    
    // Если userId не установлен из initData, пробуем получить из query/body
    if (!req.userId) {
      req.userId = req.query.userId || req.body.userId;
    }
    
    // Для некоторых endpoints userId не обязателен (например, список взаимок)
    // Но лучше иметь его для логирования
    if (!req.userId) {
      console.warn('No userId found in request', { 
        hasInitData: !!initData,
        query: req.query,
        body: req.body 
      });
    }
  } catch (error) {
    console.error('Error parsing initData:', error);
    // Не блокируем запрос, просто логируем ошибку
  }
  
  next();
};

// Auth
router.post('/auth', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    console.log('Auth request:', { userId, hasInitData: !!req.headers['x-telegram-init-data'] });
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let user = await getUser(userId);
    if (!user) {
      user = await createUser(userId);
    }

    res.json({ user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Profile
router.get('/profile', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const user = await getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Получаем статистику
    const actions = await getUserActions(userId);
    const completedCount = actions.filter(a => a.status === 'done').length;
    const activeMutuals = await getMutualPairsForUser(userId);

    res.json({
      user: {
        id: user.id,
        rating: user.rating,
        created_at: user.created_at,
        is_banned: user.is_banned
      },
      stats: {
        completed_mutuals: completedCount,
        active_mutuals: activeMutuals.length
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Channels
router.get('/channels', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const channels = await getChannelsByOwner(userId);
    res.json({ channels });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/channels/add', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { link, type } = req.body;

    if (!link || !type) {
      return res.status(400).json({ error: 'Link and type are required' });
    }

    // Парсим ссылку на канал
    let channelId;
    let username = null;
    
    if (link.includes('t.me/')) {
      const match = link.match(/t\.me\/(.+)/);
      if (match) {
        username = match[1].replace('@', '').split('/')[0]; // Берем только первую часть (до /)
        try {
          const chat = await bot.getChat(`@${username}`);
          channelId = chat.id;
        } catch (error) {
          console.error('Error getting chat by username:', error);
          return res.status(400).json({ error: 'Канал не найден или недоступен. Убедитесь, что бот добавлен в канал/чат.' });
        }
      }
    } else if (link.startsWith('@')) {
      // Если ссылка начинается с @
      username = link.replace('@', '').split('/')[0];
      try {
        const chat = await bot.getChat(`@${username}`);
        channelId = chat.id;
      } catch (error) {
        console.error('Error getting chat by username:', error);
        return res.status(400).json({ error: 'Канал не найден или недоступен. Убедитесь, что бот добавлен в канал/чат.' });
      }
    } else {
      // Пытаемся распарсить как числовой ID
      const parsed = parseInt(link);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'Неверная ссылка на канал. Используйте формат: https://t.me/channelname или @channelname' });
      }
      channelId = parsed;
    }

    if (!channelId) {
      return res.status(400).json({ error: 'Неверная ссылка на канал' });
    }

    // Проверяем, что бот является админом
    const isBotAdmin = await checkBotAdmin(channelId);
    if (!isBotAdmin) {
      return res.status(400).json({ error: 'Бот должен быть администратором канала' });
    }

    // Проверяем, что пользователь является админом
    const isUserAdmin = await checkUserAdmin(channelId, userId);
    if (!isUserAdmin) {
      return res.status(400).json({ error: 'Вы должны быть администратором канала' });
    }

    // Получаем информацию о канале
    const channelInfo = await getChannelInfo(channelId);
    if (!channelInfo) {
      return res.status(400).json({ error: 'Не удалось получить информацию о канале' });
    }

    // Добавляем канал
    const channel = await addChannel({
      ownerId: userId,
      tgId: channelId,
      username: channelInfo.username,
      title: channelInfo.title,
      type: type,
      membersCount: channelInfo.membersCount
    });

    res.json({ channel });
  } catch (error) {
    console.error('Add channel error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Mutuals
router.post('/mutuals/create', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    let { channelId, mutualType, requiredCount, holdHours } = req.body;

    if (!channelId || !mutualType) {
      return res.status(400).json({ error: 'Channel ID and mutual type are required' });
    }

    // Преобразуем типы подписок в правильный формат для БД
    if (mutualType === 'channel' || mutualType === 'chat') {
      mutualType = 'subscribe';
    }

    const user = await getUser(userId);
    if (user.rating < 80) {
      return res.status(400).json({ error: 'Рейтинг слишком низкий для создания взаимки' });
    }

    const mutual = await createMutual({
      creatorId: userId,
      channelId: parseInt(channelId),
      mutualType,
      requiredCount: requiredCount || 1,
      holdHours: holdHours || 24
    });

    res.json({ mutual });
  } catch (error) {
    console.error('Create mutual error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mutuals/list', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const { type } = req.query;
    const mutuals = await getActiveMutuals(type || null);
    
    // Фильтруем свои запросы
    const filteredMutuals = mutuals.filter(m => m.creator_id !== userId);
    
    // Добавляем информацию о каналах
    const mutualsWithChannels = await Promise.all(
      filteredMutuals.map(async (mutual) => {
        try {
          const channel = await getChannel(mutual.channel_id);
          const creator = await getUser(mutual.creator_id);
          return {
            ...mutual,
            channel: channel || { title: 'Неизвестный канал', tg_id: mutual.channel_id },
            creator_rating: creator?.rating || 100
          };
        } catch (err) {
          console.error('Error processing mutual:', err);
          return {
            ...mutual,
            channel: { title: 'Ошибка загрузки', tg_id: mutual.channel_id },
            creator_rating: 100
          };
        }
      })
    );

    res.json({ mutuals: mutualsWithChannels || [] });
  } catch (error) {
    console.error('List mutuals error:', error);
    res.status(500).json({ error: 'Internal server error', mutuals: [] });
  }
});

router.post('/mutuals/join', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { mutualId } = req.body;

    if (!mutualId) {
      return res.status(400).json({ error: 'Mutual ID is required' });
    }

    const user = await getUser(userId);
    if (user.rating < 60) {
      return res.status(400).json({ error: 'Рейтинг слишком низкий для участия во взаимках' });
    }

    const mutual = await getMutual(mutualId);
    if (!mutual || mutual.status !== 'active') {
      return res.status(400).json({ error: 'Взаимка не найдена или неактивна' });
    }

    if (mutual.creator_id === userId) {
      return res.status(400).json({ error: 'Нельзя участвовать в своей взаимке' });
    }

    // Возвращаем информацию о взаимке для показа меню
    const channel = await getChannel(mutual.channel_id);
    res.json({ 
      success: true, 
      mutual: {
        ...mutual,
        channel: channel
      }
    });
  } catch (error) {
    console.error('Join mutual error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Начать чат для взаимки
router.post('/chats/start', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { mutualId } = req.body;

    if (!mutualId) {
      return res.status(400).json({ error: 'Mutual ID is required' });
    }

    const mutual = await getMutual(mutualId);
    if (!mutual || mutual.status !== 'active') {
      return res.status(400).json({ error: 'Взаимка не найдена или неактивна' });
    }

    if (mutual.creator_id === userId) {
      return res.status(400).json({ error: 'Нельзя начать чат со своей взаимкой' });
    }

    // Создаём чат
    const { createChat } = await import('../db/chatQueries.js');
    const chat = await createChat(mutual.creator_id, userId, mutualId);

    // Создаём пару взаимки
    await createMutualPair(mutualId, mutual.creator_id, userId);
    
    // Создаём действия для обоих пользователей
    await createAction(mutualId, mutual.creator_id);
    await createAction(mutualId, userId);

    // Уведомляем создателя взаимки
    const channel = await getChannel(mutual.channel_id);
    const { notifyMutualFound } = await import('../bot.js');
    await notifyMutualFound(mutual.creator_id, {
      channel_title: channel.title,
      mutual_type: mutual.mutual_type
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/mutuals/check', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { mutualId } = req.body;

    if (!mutualId) {
      return res.status(400).json({ error: 'Mutual ID is required' });
    }

    const mutual = await getMutual(mutualId);
    if (!mutual) {
      return res.status(404).json({ error: 'Mutual not found' });
    }

    const channel = await getChannel(mutual.channel_id);
    const isSubscribed = await checkSubscription(userId, channel.tg_id);

    if (isSubscribed) {
      await updateActionStatus(mutualId, userId, 'done');
      
      // Проверяем, выполнена ли взаимка полностью
      const pairs = await getMutualPairsForUser(userId);
      const pair = pairs.find(p => p.mutual_id === mutualId);
      
      if (pair) {
        await updateMutualPairStatus(pair.id, userId, 'done');
        
        // Если оба выполнили, увеличиваем рейтинг
        if (pair.user1_status === 'done' && pair.user2_status === 'done') {
          await updateUserRating(userId, 2);
          await updateUserRating(mutual.creator_id, 2);
        }
      }

      res.json({ success: true, message: 'Действие подтверждено' });
    } else {
      await updateActionStatus(mutualId, userId, 'failed');
      res.status(400).json({ error: 'Действие не найдено. Убедитесь, что вы подписались на канал.' });
    }
  } catch (error) {
    console.error('Check mutual error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat Posts
router.post('/chat/post', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { channelId, postType, conditions } = req.body;

    if (!channelId || !postType) {
      return res.status(400).json({ error: 'Channel ID and post type are required' });
    }

    const user = await getUser(userId);
    if (user.rating < 80) {
      return res.status(400).json({ error: 'Рейтинг слишком низкий для создания запроса' });
    }

    // Проверяем лимит (3 поста в сутки)
    const postsCount = await getUserChatPostsCount(userId);
    if (postsCount >= 3) {
      return res.status(400).json({ error: 'Превышен лимит сообщений (3 в сутки)' });
    }

    const post = await createChatPost({
      userId,
      channelId: parseInt(channelId),
      postType,
      conditions: conditions || 'без ограничений'
    });

    res.json({ post });
  } catch (error) {
    console.error('Create chat post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/chat/list', verifyTelegramWebApp, async (req, res) => {
  try {
    const { type } = req.query;
    const posts = await getActiveChatPosts(type || null);
    
    // Добавляем информацию о каналах и пользователях
    const postsWithDetails = await Promise.all(
      (posts || []).map(async (post) => {
        try {
          const channel = await getChannel(post.channel_id);
          const user = await getUser(post.user_id);
          return {
            ...post,
            channel: channel || { title: 'Неизвестный канал', tg_id: post.channel_id },
            user_rating: user?.rating || 100
          };
        } catch (err) {
          console.error('Error processing chat post:', err);
          return {
            ...post,
            channel: { title: 'Ошибка загрузки', tg_id: post.channel_id },
            user_rating: 100
          };
        }
      })
    );

    res.json({ posts: postsWithDetails || [] });
  } catch (error) {
    console.error('List chat posts error:', error);
    res.status(500).json({ error: 'Internal server error', posts: [] });
  }
});

router.post('/chat/respond', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    const user = await getUser(userId);
    if (user.rating < 60) {
      return res.status(400).json({ error: 'Рейтинг слишком низкий для участия во взаимках' });
    }

    // Получаем пост
    const postResult = await pool.query('SELECT * FROM chat_posts WHERE id = $1', [postId]);
    const post = postResult.rows[0];
    
    if (!post || !post.is_active) {
      return res.status(404).json({ error: 'Пост не найден или неактивен' });
    }

    if (post.user_id === userId) {
      return res.status(400).json({ error: 'Нельзя откликнуться на свой пост' });
    }

    // Создаём взаимку из поста
    const channel = await getChannel(post.channel_id);
    const postOwner = await getUser(post.user_id);

    // Создаём взаимку для автора поста
    const mutual1 = await createMutual({
      creatorId: post.user_id,
      channelId: post.channel_id,
      mutualType: post.post_type === 'reaction' ? 'reaction' : 'subscribe',
      requiredCount: 1,
      holdHours: 24
    });

    // Создаём взаимку для откликнувшегося
    // Нужно найти канал откликнувшегося пользователя
    const userChannels = await getChannelsByOwner(userId);
    if (userChannels.length === 0) {
      return res.status(400).json({ error: 'У вас нет каналов для взаимки' });
    }

    const userChannel = userChannels[0];
    const mutual2 = await createMutual({
      creatorId: userId,
      channelId: userChannel.id,
      mutualType: post.post_type === 'reaction' ? 'reaction' : 'subscribe',
      requiredCount: 1,
      holdHours: 24
    });

    // Создаём пары взаимок
    await createMutualPair(mutual1.id, post.user_id, userId);
    await createMutualPair(mutual2.id, userId, post.user_id);

    // Деактивируем пост
    await deactivateChatPost(postId);

    // Уведомляем обоих пользователей
    await notifyMutualFound(post.user_id, {
      channel_title: channel.title,
      mutual_type: post.post_type === 'reaction' ? 'reaction' : 'subscribe'
    });
    await notifyMutualFound(userId, {
      channel_title: userChannel.title,
      mutual_type: post.post_type === 'reaction' ? 'reaction' : 'subscribe'
    });

    res.json({ success: true, mutual1, mutual2 });
  } catch (error) {
    console.error('Respond to chat post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chats
router.get('/chats', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const { getUserChats } = await import('../db/chatQueries.js');
    const chats = await getUserChats(userId);
    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Internal server error', chats: [] });
  }
});

router.get('/chats/:id/messages', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.query.userId;
    const chatId = parseInt(req.params.id);
    
    if (!chatId || isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID', messages: [] });
    }
    
    const { getChat, getChatMessages } = await import('../db/chatQueries.js');
    
    const chat = await getChat(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found', messages: [] });
    }
    
    if (chat.user1_id !== userId && chat.user2_id !== userId) {
      return res.status(403).json({ error: 'Access denied', messages: [] });
    }

    const messages = await getChatMessages(chatId);
    
    // Получаем информацию о пользователях из Telegram
    const bot = (await import('../bot.js')).default;
    const usersInfo = {};
    const uniqueUserIds = [...new Set(messages.map(m => m.user_telegram_id))];
    
    // Получаем информацию о каждом уникальном пользователе (параллельно для скорости)
    // Используем Promise.allSettled чтобы не прерывать выполнение при ошибках
    const userInfoPromises = uniqueUserIds.map(async (uid) => {
      try {
        // Пробуем получить информацию через getChat (работает для пользователей, с которыми бот общался)
        const userChat = await bot.getChat(uid);
        let photoUrl = null;
        
        // Пробуем получить фото профиля
        try {
          const userProfilePhotos = await bot.getUserProfilePhotos(uid, { limit: 1 });
          if (userProfilePhotos.total_count > 0 && userProfilePhotos.photos[0]) {
            const fileId = userProfilePhotos.photos[0][0].file_id;
            const file = await bot.getFile(fileId);
            photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
          }
        } catch (photoErr) {
          // Если не удалось получить фото, продолжаем без него
        }
        
        return {
          uid,
          info: {
            username: userChat.username || null,
            first_name: userChat.first_name || null,
            last_name: userChat.last_name || null,
            photo_url: photoUrl
          }
        };
      } catch (err) {
        // Если не удалось, возвращаем пустую информацию
        return {
          uid,
          info: {
            username: null,
            first_name: null,
            last_name: null,
            photo_url: null
          }
        };
      }
    });
    
    const results = await Promise.allSettled(userInfoPromises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        usersInfo[result.value.uid] = result.value.info;
      } else {
        // В случае ошибки используем пустую информацию
        const uid = uniqueUserIds[results.indexOf(result)];
        usersInfo[uid] = {
          username: null,
          first_name: null,
          last_name: null,
          photo_url: null
        };
      }
    });
    
    // Добавляем информацию о пользователях к сообщениям
    const messagesWithUsers = messages.map(msg => ({
      ...msg,
      user_info: usersInfo[msg.user_telegram_id] || {}
    }));
    
    res.json({ messages: messagesWithUsers });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Internal server error', messages: [] });
  }
});

router.post('/chats/:id/messages', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const chatId = parseInt(req.params.id);
    const { text } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!chatId || isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const { getChat, addMessage } = await import('../db/chatQueries.js');
    const chat = await getChat(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.user1_id !== userId && chat.user2_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (chat.status !== 'active') {
      return res.status(400).json({ error: 'Chat is not active' });
    }

    const message = await addMessage(chatId, userId, text.trim());
    
    // Получаем информацию о пользователе из Telegram
    const bot = (await import('../bot.js')).default;
    let userInfo = {};
    try {
      const chatMember = await bot.getChat(userId);
      let photoUrl = null;
      
      try {
        const userProfilePhotos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (userProfilePhotos.total_count > 0 && userProfilePhotos.photos[0]) {
          const fileId = userProfilePhotos.photos[0][0].file_id;
          const file = await bot.getFile(fileId);
          photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        }
      } catch (photoErr) {
        // Игнорируем ошибки получения фото
      }
      
      userInfo = {
        username: chatMember.username || null,
        first_name: chatMember.first_name || null,
        last_name: chatMember.last_name || null,
        photo_url: photoUrl
      };
    } catch (err) {
      console.error('Error getting user info:', err);
      // Используем базовую информацию если не удалось получить
      userInfo = {
        username: null,
        first_name: null,
        last_name: null,
        photo_url: null
      };
    }
    
    res.json({ 
      message: {
        ...message,
        user_telegram_id: userId,
        user_info: userInfo
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

router.post('/chats/:id/complete', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const chatId = parseInt(req.params.id);
    const { markChatCompleted, getChat } = await import('../db/chatQueries.js');
    const { updateUserRating } = await import('../db/queries.js');
    
    const chat = await getChat(chatId);
    if (!chat || (chat.user1_id !== userId && chat.user2_id !== userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await markChatCompleted(chatId, userId);
    
    // Если оба выполнили, начисляем рейтинг
    if (updated.status === 'completed') {
      await updateUserRating(chat.user1_id, 2);
      await updateUserRating(chat.user2_id, 2);
    }

    res.json({ success: true, chat: updated });
  } catch (error) {
    console.error('Complete chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// General Chat
router.get('/general-chat', verifyTelegramWebApp, async (req, res) => {
  try {
    const { getGeneralChatMessages } = await import('../db/chatQueries.js');
    const messages = await getGeneralChatMessages(100);
    
    // Получаем информацию о пользователях из Telegram
    const bot = (await import('../bot.js')).default;
    const usersInfo = {};
    const uniqueUserIds = [...new Set(messages.map(m => m.user_telegram_id))];
    
    // Получаем информацию о каждом уникальном пользователе (параллельно для скорости)
    await Promise.all(uniqueUserIds.map(async (uid) => {
      try {
        const userChat = await bot.getChat(uid);
        let photoUrl = null;
        
        // Пробуем получить фото профиля
        try {
          const userProfilePhotos = await bot.getUserProfilePhotos(uid, { limit: 1 });
          if (userProfilePhotos.total_count > 0 && userProfilePhotos.photos[0]) {
            const fileId = userProfilePhotos.photos[0][0].file_id;
            const file = await bot.getFile(fileId);
            photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
          }
        } catch (photoErr) {
          // Игнорируем ошибки получения фото
        }
        
        usersInfo[uid] = {
          username: userChat.username || null,
          first_name: userChat.first_name || null,
          last_name: userChat.last_name || null,
          photo_url: photoUrl
        };
      } catch (err) {
        // Если не удалось получить информацию, используем базовые данные
        usersInfo[uid] = {
          username: null,
          first_name: null,
          last_name: null,
          photo_url: null
        };
      }
    }));
    
    // Добавляем информацию о пользователях к сообщениям
    const messagesWithUsers = messages.map(msg => ({
      ...msg,
      user_info: usersInfo[msg.user_telegram_id] || {}
    }));
    
    res.json({ messages: messagesWithUsers });
  } catch (error) {
    console.error('Get general chat error:', error);
    res.status(500).json({ error: 'Internal server error', messages: [] });
  }
});

router.post('/general-chat', verifyTelegramWebApp, async (req, res) => {
  try {
    const userId = req.userId || req.body.userId;
    const { text } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const { addGeneralChatMessage } = await import('../db/chatQueries.js');
    const message = await addGeneralChatMessage(userId, text.trim());
    
    // Получаем информацию о пользователе из Telegram
    const bot = (await import('../bot.js')).default;
    let userInfo = {};
    try {
      const chatMember = await bot.getChat(userId);
      userInfo = {
        username: chatMember.username || null,
        first_name: chatMember.first_name || null,
        last_name: chatMember.last_name || null
      };
    } catch (err) {
      console.error('Error getting user info:', err);
    }
    
    res.json({ 
      message: {
        ...message,
        user_telegram_id: userId,
        user_info: userInfo
      }
    });
  } catch (error) {
    console.error('Send general chat message error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export default router;
