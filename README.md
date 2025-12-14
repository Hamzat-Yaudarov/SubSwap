# SubSwap - Telegram MiniApp для взаимных подписок

Сервис безопасных взаимных подписок и реакций без общения в личных сообщениях Telegram.

## Описание

SubSwap - это Telegram MiniApp, который позволяет администраторам каналов и чатов безопасно обмениваться подписками и реакциями без необходимости общения в личных сообщениях. Это снижает риск жалоб и блокировок аккаунтов.

## Основные возможности

- ✅ Взаимные подписки на каналы и чаты
- ✅ Обмен реакциями на посты
- ✅ Система репутации и рейтинга
- ✅ Автоматическая проверка подписок
- ✅ Мини-чат для поиска партнёров
- ✅ Админ-панель для модерации
- ✅ Защита от скама и нарушений

## Технологии

- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Neon)
- **Bot**: node-telegram-bot-api
- **Frontend**: Vanilla JavaScript, Telegram WebApp API
- **Deployment**: Railway

## Установка (локально)

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd SubSwap
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example` и заполните переменные окружения:
```env
BOT_TOKEN=your_bot_token
BOT_USERNAME=your_bot_username
WEBAPP_URL=http://localhost:8080
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:port/database
PORT=8080
ADMIN_IDS=123456789
```

4. Запустите миграции базы данных:
```bash
npm run migrate
```

5. Запустите сервер:
```bash
npm start
```

Для разработки с автоперезагрузкой:
```bash
npm run dev
```

## Структура проекта

```
SubSwap/
├── server.js              # Основной Express сервер
├── bot.js                 # Логика Telegram-бота
├── db/
│   ├── index.js          # Подключение к БД
│   └── queries.js        # SQL запросы
├── routes/
│   ├── api.js            # API роуты для MiniApp
│   └── admin.js          # Админ API
├── services/
│   ├── mutualService.js  # Логика взаимок
│   └── scheduler.js      # Периодические задачи
├── public/
│   ├── index.html        # Главная страница MiniApp
│   ├── app.js            # JavaScript приложения
│   ├── styles.css        # Стили
│   └── admin.html        # Админ-панель
├── scripts/
│   └── migrate.js        # Миграции БД
└── package.json
```

## API Endpoints

### Пользовательские
- `POST /api/auth` - Авторизация
- `GET /api/profile` - Профиль пользователя
- `GET /api/channels` - Список каналов пользователя
- `POST /api/channels/add` - Добавить канал
- `GET /api/mutuals/list` - Список взаимок
- `POST /api/mutuals/create` - Создать взаимку
- `POST /api/mutuals/join` - Участвовать во взаимке
- `POST /api/mutuals/check` - Проверить выполнение
- `GET /api/chat/list` - Список постов в чате
- `POST /api/chat/post` - Создать пост
- `POST /api/chat/respond` - Откликнуться на пост

### Админские
- `GET /admin/users` - Список пользователей
- `GET /admin/channels` - Список каналов
- `GET /admin/stats` - Статистика
- `POST /admin/users/ban` - Забанить пользователя
- `POST /admin/chat/delete` - Удалить пост

## Деплой на Railway

Подробная инструкция по деплою находится в файле [DEPLOY.md](./DEPLOY.md).

Кратко:
1. Создайте проект на Railway
2. Подключите репозиторий
3. Настройте переменные окружения
4. Запустите миграции
5. Настройте WebApp в @BotFather

## Система репутации

- Начальный рейтинг: 100
- Успешная взаимка: +2
- Отписка раньше срока: -10
- Игнорирование взаимки: -5

Ограничения:
- Рейтинг < 80: нельзя создавать запросы в чате
- Рейтинг < 60: нельзя участвовать во взаимках

## Лицензия

ISC

## Поддержка

При возникновении проблем проверьте:
1. Логи в Railway Dashboard
2. Настройки переменных окружения
3. Права бота в каналах
4. Подключение к базе данных Neon

