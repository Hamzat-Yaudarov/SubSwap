-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  rating INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_banned BOOLEAN DEFAULT FALSE
);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id),
  tg_id BIGINT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('channel', 'chat')),
  members_count INT DEFAULT 0,
  rating INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mutuals table (взаимки)
CREATE TABLE IF NOT EXISTS mutuals (
  id SERIAL PRIMARY KEY,
  creator_id BIGINT NOT NULL REFERENCES users(id),
  channel_id INT NOT NULL REFERENCES channels(id),
  mutual_type VARCHAR(20) NOT NULL CHECK (mutual_type IN ('subscribe', 'reaction')),
  required_count INT DEFAULT 1,
  hold_hours INT DEFAULT 24,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Actions table (выполнение взаимок)
CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  mutual_id INT NOT NULL REFERENCES mutuals(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(mutual_id, user_id)
);

-- Chat posts table
CREATE TABLE IF NOT EXISTS chat_posts (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  channel_id INT NOT NULL REFERENCES channels(id),
  post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('channel', 'chat', 'reaction')),
  conditions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_channels_owner_id ON channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_mutuals_creator_id ON mutuals(creator_id);
CREATE INDEX IF NOT EXISTS idx_mutuals_status ON mutuals(status);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_mutual_id ON actions(mutual_id);
CREATE INDEX IF NOT EXISTS idx_chat_posts_user_id ON chat_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_posts_created_at ON chat_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_posts_expires_at ON chat_posts(expires_at);
