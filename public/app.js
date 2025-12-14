// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Глобальное состояние
const app = {
    userId: null,
    user: null,
    channels: [],
    currentMutualType: 'subscribe',
    currentChatType: 'channel',
    currentTask: null,
    apiUrl: window.location.origin + '/api'
};

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await app.init();
    app.setupNavigation();
    app.setupTabs();
});

// Инициализация приложения
app.init = async () => {
    try {
        // Получаем initData от Telegram
        const initData = tg.initData;
        console.log('Initializing app, initData:', initData ? 'present' : 'missing');
        
        // Авторизация
        const response = await fetch(`${app.apiUrl}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData || ''
            },
            body: JSON.stringify({
                initData: initData || '',
                userId: tg.initDataUnsafe?.user?.id
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Auth failed:', errorData);
            // Пробуем использовать userId из initDataUnsafe
            if (tg.initDataUnsafe?.user?.id) {
                app.userId = tg.initDataUnsafe.user.id;
                console.log('Using userId from initDataUnsafe:', app.userId);
            } else {
                throw new Error(errorData.error || 'Auth failed');
            }
        } else {
            const data = await response.json();
            app.userId = data.user.id;
            app.user = data.user;
            console.log('Auth successful, userId:', app.userId);
        }

        // Загружаем данные только если есть userId
        if (app.userId) {
            await app.loadProfile();
            await app.loadChannels();
            await app.loadMutuals();
            await app.loadChatPosts();
        } else {
            console.error('No userId available');
            tg.showAlert('Ошибка авторизации. Перезапустите приложение.');
        }
    } catch (error) {
        console.error('Init error:', error);
        tg.showAlert('Ошибка инициализации: ' + error.message);
    }
};

// Навигация
app.setupNavigation = () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            app.showPage(page);
        });
    });
};

app.showPage = (pageName) => {
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Показываем выбранную страницу
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }

    // Обновляем активную кнопку навигации
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });

    // Загружаем данные для страницы
    if (pageName === 'mutuals') {
        app.loadMutuals();
    } else if (pageName === 'chat') {
        app.loadChatPosts();
    } else if (pageName === 'channels') {
        app.loadChannels();
    } else if (pageName === 'profile') {
        app.loadProfile();
    } else if (pageName === 'home') {
        app.loadHomeStats();
    }
};

// Табы
app.setupTabs = () => {
    // Табы на странице взаимок
    const mutualTabs = document.querySelectorAll('#page-mutuals .tab');
    mutualTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mutualTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            app.currentMutualType = tab.dataset.type;
            app.loadMutuals();
        });
    });

    // Табы на странице чата
    const chatTabs = document.querySelectorAll('#page-chat .tab');
    chatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            chatTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            app.currentChatType = tab.dataset.type;
            app.loadChatPosts();
        });
    });
};

// Загрузка профиля
app.loadProfile = async () => {
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/profile?userId=${app.userId}`, {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('profile-id').textContent = data.user.id;
            document.getElementById('profile-rating').textContent = data.user.rating;
            document.getElementById('profile-completed').textContent = data.stats.completed_mutuals;
            document.getElementById('profile-active').textContent = data.stats.active_mutuals;
        }
    } catch (error) {
        console.error('Load profile error:', error);
    }
};

// Загрузка статистики на главной
app.loadHomeStats = async () => {
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/profile?userId=${app.userId}`, {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('stat-rating').textContent = data.user.rating;
            document.getElementById('stat-active').textContent = data.stats.active_mutuals;
            // Получено подписчиков - упрощённая версия
            document.getElementById('stat-subscribers').textContent = data.stats.completed_mutuals * 10;
        }
    } catch (error) {
        console.error('Load home stats error:', error);
    }
};

// Загрузка каналов
app.loadChannels = async () => {
    const list = document.getElementById('channels-list');
    list.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/channels?userId=${app.userId}`, {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });

        if (response.ok) {
            const data = await response.json();
            app.channels = data.channels;

            if (data.channels.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📢</div>
                        <div class="empty-state-text">Вы ещё не добавили ни одного канала</div>
                    </div>
                `;
            } else {
                list.innerHTML = data.channels.map(channel => `
                    <div class="channel-card">
                        <div class="channel-header">
                            <div class="channel-avatar">${channel.type === 'channel' ? '📢' : '💬'}</div>
                            <div class="channel-info">
                                <div class="channel-name">${channel.title}</div>
                                <div class="channel-meta">
                                    ${channel.type === 'channel' ? 'Канал' : 'Чат'} • 
                                    ${channel.members_count} подписчиков • 
                                    Рейтинг: ${channel.rating}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Load channels error:', error);
        list.innerHTML = '<div class="error-message active">Ошибка загрузки каналов</div>';
    }
};

// Показать модалку добавления канала
app.showAddChannel = () => {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-add-channel').classList.add('active');
    document.getElementById('channel-link').value = '';
    document.getElementById('channel-error').classList.remove('active');
};

// Добавить канал
app.addChannel = async () => {
    const link = document.getElementById('channel-link').value.trim();
    const type = document.querySelector('input[name="channel-type"]:checked').value;
    const errorDiv = document.getElementById('channel-error');

    if (!link) {
        errorDiv.textContent = 'Введите ссылку на канал';
        errorDiv.classList.add('active');
        return;
    }

    errorDiv.classList.remove('active');

    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/channels/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                link: link,
                type: type,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            tg.showAlert('Канал успешно добавлен!');
            app.closeModal();
            app.loadChannels();
        } else {
            errorDiv.textContent = data.error || 'Ошибка при добавлении канала';
            errorDiv.classList.add('active');
        }
    } catch (error) {
        console.error('Add channel error:', error);
        errorDiv.textContent = 'Ошибка при добавлении канала';
        errorDiv.classList.add('active');
    }
};

// Загрузка взаимок
app.loadMutuals = async () => {
    const list = document.getElementById('mutuals-list');
    if (!list) return;
    
    list.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const initData = tg.initData || '';
        const response = await fetch(`${app.apiUrl}/mutuals/list?type=${app.currentMutualType}`, {
            headers: {
                'X-Telegram-Init-Data': initData,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.mutuals || data.mutuals.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🤝</div>
                    <div class="empty-state-text">Нет доступных взаимок</div>
                </div>
            `;
        } else {
            list.innerHTML = data.mutuals.map(mutual => `
                <div class="mutual-card">
                    <div class="channel-header">
                        <div class="channel-avatar">${mutual.mutual_type === 'subscribe' ? '📢' : '👍'}</div>
                        <div class="channel-info">
                            <div class="channel-name">${mutual.channel?.title || 'Канал'}</div>
                            <div class="channel-meta">
                                ${mutual.mutual_type === 'subscribe' ? 'Подписка' : 'Реакция'} • 
                                Требуется: ${mutual.required_count} • 
                                Удержание: ${mutual.hold_hours}ч • 
                                Рейтинг партнёра: ${mutual.creator_rating || 100}
                            </div>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn btn-primary" onclick="app.joinMutual(${mutual.id})">
                            Участвовать
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Load mutuals error:', error);
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Ошибка загрузки взаимок</div>
                <div style="margin-top: 10px; font-size: 12px; color: #757575;">${error.message}</div>
            </div>
        `;
    }
};

// Участие во взаимке
app.joinMutual = async (mutualId) => {
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/mutuals/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                mutualId: mutualId,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            app.currentTask = { mutualId: mutualId };
            app.showTask(mutualId);
        } else {
            tg.showAlert(data.error || 'Ошибка при участии во взаимке');
        }
    } catch (error) {
        console.error('Join mutual error:', error);
        tg.showAlert('Ошибка при участии во взаимке');
    }
};

// Показать задание
app.showTask = async (mutualId) => {
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/mutuals/list?type=`, {
            headers: {
                'X-Telegram-Init-Data': initData
            }
        });

        if (response.ok) {
            const data = await response.json();
            const mutual = data.mutuals.find(m => m.id === mutualId);
            
            if (mutual) {
                app.currentTask = mutual;
                const channel = mutual.channel;
                const channelLink = channel.username 
                    ? `https://t.me/${channel.username}`
                    : `https://t.me/c/${String(channel.tg_id).replace('-100', '')}`;

                document.getElementById('task-title').textContent = channel.title;
                document.getElementById('task-info').innerHTML = `
                    <p>Тип: ${mutual.mutual_type === 'subscribe' ? 'Подписка' : 'Реакция'}</p>
                    <p>Удержание: ${mutual.hold_hours} часов</p>
                `;
                document.getElementById('task-link').href = channelLink;
                document.getElementById('task-error').classList.remove('active');

                document.getElementById('modal-overlay').classList.add('active');
                document.getElementById('modal-task').classList.add('active');
            }
        }
    } catch (error) {
        console.error('Show task error:', error);
    }
};

// Проверка выполнения задания
app.checkTask = async () => {
    if (!app.currentTask) return;

    const errorDiv = document.getElementById('task-error');
    errorDiv.classList.remove('active');

    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/mutuals/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                mutualId: app.currentTask.id,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            tg.showAlert('✅ Взаимка выполнена!');
            app.closeModal();
            app.loadMutuals();
            app.loadHomeStats();
        } else {
            errorDiv.textContent = data.error || 'Действие не найдено';
            errorDiv.classList.add('active');
        }
    } catch (error) {
        console.error('Check task error:', error);
        errorDiv.textContent = 'Ошибка при проверке';
        errorDiv.classList.add('active');
    }
};

// Загрузка постов чата
app.loadChatPosts = async () => {
    const list = document.getElementById('chat-list');
    if (!list) return;
    
    list.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const initData = tg.initData || '';
        const type = app.currentChatType === 'channel' ? 'channel' : 
                     app.currentChatType === 'chat' ? 'chat' : 'reaction';
        
        const response = await fetch(`${app.apiUrl}/chat/list?type=${type}`, {
            headers: {
                'X-Telegram-Init-Data': initData,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.posts || data.posts.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">Нет сообщений</div>
                </div>
            `;
        } else {
            list.innerHTML = data.posts.map(post => `
                <div class="chat-post-card">
                    <div class="post-header">
                        <div class="post-avatar">${post.post_type === 'channel' ? '📢' : post.post_type === 'chat' ? '💬' : '👍'}</div>
                        <div class="post-info">
                            <div class="post-name">${post.channel?.title || 'Канал'}</div>
                            <div class="post-meta">
                                ${post.post_type === 'channel' ? 'Взаимная подписка' : 
                                  post.post_type === 'chat' ? 'Взаимная подписка на чат' : 
                                  'Обмен реакциями'} • 
                                ${post.conditions || 'без ограничений'} • 
                                Рейтинг: ${post.user_rating || 100} • 
                                ${app.formatTime(post.created_at)}
                            </div>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn btn-primary" onclick="app.respondToPost(${post.id})">
                            Откликнуться
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Load chat posts error:', error);
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Ошибка загрузки сообщений</div>
                <div style="margin-top: 10px; font-size: 12px; color: #757575;">${error.message}</div>
            </div>
        `;
    }
};

// Показать модалку создания поста
app.showCreatePost = () => {
    // Заполняем список каналов
    const select = document.getElementById('post-channel');
    select.innerHTML = '<option value="">Выберите канал</option>';
    app.channels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.title;
        select.appendChild(option);
    });

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-create-post').classList.add('active');
    document.getElementById('post-error').classList.remove('active');
};

// Создать пост
app.createPost = async () => {
    const channelId = document.getElementById('post-channel').value;
    const postType = document.getElementById('post-type').value;
    const conditions = document.getElementById('post-conditions').value;
    const errorDiv = document.getElementById('post-error');

    if (!channelId) {
        errorDiv.textContent = 'Выберите канал';
        errorDiv.classList.add('active');
        return;
    }

    errorDiv.classList.remove('active');

    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/chat/post`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                channelId: channelId,
                postType: postType,
                conditions: conditions,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            tg.showAlert('Запрос опубликован!');
            app.closeModal();
            app.loadChatPosts();
        } else {
            errorDiv.textContent = data.error || 'Ошибка при публикации';
            errorDiv.classList.add('active');
        }
    } catch (error) {
        console.error('Create post error:', error);
        errorDiv.textContent = 'Ошибка при публикации';
        errorDiv.classList.add('active');
    }
};

// Откликнуться на пост
app.respondToPost = async (postId) => {
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/chat/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                postId: postId,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            tg.showAlert('✅ Взаимка создана! Проверьте уведомления.');
            app.loadChatPosts();
        } else {
            tg.showAlert(data.error || 'Ошибка при отклике');
        }
    } catch (error) {
        console.error('Respond to post error:', error);
        tg.showAlert('Ошибка при отклике');
    }
};

// Закрыть модалку
app.closeModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
};

// Форматирование времени
app.formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000 / 60);
    
    if (diff < 1) return 'только что';
    if (diff < 60) return `${diff} мин назад`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
};

