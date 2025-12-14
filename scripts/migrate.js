import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTables = async () => {
  try {
    await client.connect();
    console.log('Connected to database');

    // Таблица users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        rating INT DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_banned BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE
      )
    `);

    // Таблица channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        tg_id BIGINT NOT NULL,
        username TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('channel', 'chat')),
        members_count INT DEFAULT 0,
        rating INT DEFAULT 100,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем колонку username, если её нет (для существующих таблиц)
    try {
      await client.query(`
        ALTER TABLE channels 
        ADD COLUMN IF NOT EXISTS username TEXT
      `);
    } catch (error) {
      // Игнорируем ошибку, если колонка уже существует
      console.log('Column username might already exist');
    }

    // Таблица mutuals
    await client.query(`
      CREATE TABLE IF NOT EXISTS mutuals (
        id SERIAL PRIMARY KEY,
        creator_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
        mutual_type TEXT NOT NULL CHECK (mutual_type IN ('subscribe', 'reaction')),
        required_count INT DEFAULT 1,
        hold_hours INT DEFAULT 24,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // Таблица actions
    await client.query(`
      CREATE TABLE IF NOT EXISTS actions (
        id SERIAL PRIMARY KEY,
        mutual_id INT REFERENCES mutuals(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
        checked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(mutual_id, user_id)
      )
    `);

    // Таблица chat_posts
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_posts (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
        post_type TEXT NOT NULL CHECK (post_type IN ('channel', 'chat', 'reaction')),
        conditions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Таблица mutual_pairs (для связи двух пользователей во взаимке)
    await client.query(`
      CREATE TABLE IF NOT EXISTS mutual_pairs (
        id SERIAL PRIMARY KEY,
        mutual_id INT REFERENCES mutuals(id) ON DELETE CASCADE,
        user1_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        user2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        user1_status TEXT DEFAULT 'pending' CHECK (user1_status IN ('pending', 'done', 'failed')),
        user2_status TEXT DEFAULT 'pending' CHECK (user2_status IN ('pending', 'done', 'failed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица chats (чаты между пользователями)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        user1_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        user2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        mutual_id INT REFERENCES mutuals(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        user1_completed BOOLEAN DEFAULT FALSE,
        user2_completed BOOLEAN DEFAULT FALSE,
        UNIQUE(user1_id, user2_id, mutual_id)
      )
    `);

    // Таблица messages (сообщения в чатах)
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица general_chat (общий чат)
    await client.query(`
      CREATE TABLE IF NOT EXISTS general_chat_messages (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Индексы для производительности
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mutuals_creator ON mutuals(creator_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mutuals_status ON mutuals(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_posts_active ON chat_posts(is_active, expires_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chats_user1 ON chats(user1_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chats_user2 ON chats(user2_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_general_chat_created ON general_chat_messages(created_at)`);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await client.end();
  }
};

createTables();

