# Wormz Bot - MiniApp для взаимных подписок

Telegram Bot + MiniApp для безопасных взаимных подписок и реакций без общения в личных сообщениях.

## 🚀 Быстрый старт

### Требования
- Node.js 18+
- PostgreSQL (Neon)
- Telegram Bot Token

### Установка локально

1. **Клонируйте репозиторий**
   ```bash
   git clone <repo-url>
   cd wormzrobot-miniapp
   ```

2. **Установите зависимости**
   ```bash
   npm install
   ```

3. **Создайте .env файл**
   ```bash
   cp .env.example .env
   ```

4. **Настройте переменные окружения в .env**
   ```
   BOT_TOKEN=ваш_токен_бота
   BOT_USERNAME=имя_бота
   WEBAPP_URL=https://yourdomain.com
   DATABASE_URL=postgresql://user:password@host/database
   PORT=8080
   NODE_ENV=development
   ```

5. **Запустите сервер**
   ```bash
   npm run dev
   ```

Сервер будет доступен на `http://localhost:8080`

## 📱 Структура проекта

```
├── server.js                 # Основной файл сервера
├── bot/
│   └── bot.js              # Telegram bot логика
├── db/
│   ├── pool.js             # PostgreSQL connection pool
│   └── schema.sql          # Database schema
├── handlers/
│   ├── auth.js             # Authentication endpoints
│   ├── channels.js         # Channel management
│   ├── mutuals.js          # Mutual subscriptions logic
│   └── chat.js             # Chat posts logic
├── routes/
│   └── api.js              # API routes setup
├── utils/
│   └── telegram.js         # Telegram API utilities
├── public/
│   ├── index.html          # MiniApp HTML
│   ├── app.js              # React app (no build step)
│   └── styles.css          # Styles
└── package.json            # Dependencies
```

## 🛠️ API endpoints

### Authentication
- `POST /api/auth` - Authenticate user with Telegram WebApp data
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update user profile

### Channels
- `POST /api/channels/add` - Add new channel
- `GET /api/channels` - Get user's channels
- `GET /api/channels/:id` - Get specific channel
- `DELETE /api/channels/:id` - Delete channel

### Mutuals (Subscriptions/Reactions)
- `POST /api/mutuals/create` - Create new mutual
- `GET /api/mutuals` - Get user's mutuals
- `GET /api/mutuals/available` - Get available mutuals to join
- `GET /api/mutuals/:id` - Get specific mutual
- `POST /api/mutuals/:id/join` - Join a mutual
- `POST /api/mutuals/:id/check` - Check if mutual is completed

### Chat
- `POST /api/chat/post` - Create chat post
- `GET /api/chat/posts` - Get chat posts
- `POST /api/chat/:postId/respond` - Respond to chat post
- `DELETE /api/chat/:postId` - Delete chat post

## 🗄️ Database Schema

### users
- `id` (BIGINT) - Telegram user ID
- `rating` (INT) - User rating (default 100)
- `created_at` (TIMESTAMP)
- `is_banned` (BOOLEAN)

### channels
- `id` (SERIAL) - Channel ID
- `owner_id` (BIGINT) - Owner's user ID
- `tg_id` (BIGINT) - Telegram channel ID
- `title` (TEXT)
- `type` (VARCHAR) - 'channel' or 'chat'
- `members_count` (INT)
- `rating` (INT)
- `is_active` (BOOLEAN)

### mutuals
- `id` (SERIAL)
- `creator_id` (BIGINT)
- `channel_id` (INT)
- `mutual_type` (VARCHAR) - 'subscribe' or 'reaction'
- `required_count` (INT)
- `hold_hours` (INT)
- `status` (VARCHAR) - 'active', 'completed', 'cancelled'

### actions
- `id` (SERIAL)
- `mutual_id` (INT)
- `user_id` (BIGINT)
- `status` (VARCHAR) - 'pending', 'done', 'failed'
- `checked_at` (TIMESTAMP)

### chat_posts
- `id` (SERIAL)
- `user_id` (BIGINT)
- `channel_id` (INT)
- `post_type` (VARCHAR) - 'channel', 'chat', 'reaction'
- `conditions` (TEXT)
- `created_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP)

## 🚀 Deployment на Railway

1. **Подготовьте репозиторий**
   - Убедитесь, что есть .gitignore и .env.example
   - Закоммитьте все изменения

2. **Создайте Railway проект**
   - Перейдите на railway.app
   - Создайте новый проект
   - Подключите GitHub репозиторий

3. **Настройте переменные окружения**
   - Перейдите в Variables
   - Добавьте все переменные из .env.example

4. **Добавьте PostgreSQL базу**
   - Нажмите "Add Service"
   - Выберите PostgreSQL
   - Railway автоматически создаст DATABASE_URL

5. **Разверните приложение**
   - Railway автоматически запустит `npm start`
   - Получите URL вашего приложения

6. **Обновите WEBAPP_URL**
   - Скопируйте URL Railway приложения
   - Обновите WEBAPP_URL в переменных окружения

## 🤖 Telegram Bot Commands

### /start
Показывает приветственное сообщение и кнопку открытия MiniApp

## 📋 Функциональность

### Пользователь может:
- ✅ Добавлять свои каналы и чаты
- ✅ Участвовать во взаимках (подписки, реакции)
- ✅ Искать партнёров для взаимок
- ✅ Общаться через MiniApp-чат без ЛС
- ✅ Отслеживать рейтинг и статистику
- ✅ Получать уведомления о выполненных взаимках

### Рейтинг система:
- Начальный рейтинг: 100
- Успешная взаимка: +2
- Отписка раньше срока: -10
- Игнорирование взаимки: -5

### Ограничения по рейтингу:
- Рейтинг < 80: нельзя создавать посты в чате
- Рейтинг < 60: нельзя участвовать во взаимках

## 🔒 Безопасность

- WebApp data validation
- User authentication через Telegram
- Проверка прав администратора перед добавлением канала
- SQL injection защита (параметризованные запросы)
- CORS защита

## 📝 Лимиты

- 3 сообщения в чате в сутки
- Сообщение живёт 24 часа
- Повторная публикация через 1 час

## 🐛 Debugging

Смотрите логи сервера для отладки. Используйте переменные окружения для тестирования:

```bash
NODE_ENV=development npm run dev
```

## 📞 Support

Для проблем с Telegram Bot API смотрите: https://core.telegram.org/bots/api

## 📄 License

MIT
