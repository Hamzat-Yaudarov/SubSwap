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
    currentMutual: null,
    currentChatId: null,
    apiUrl: window.location.origin + '/api',
    chatUpdateInterval: null,
    lastMessageId: null,
    selectedUserId: null,
    selectedUserName: null,
    selectedUserUsername: null
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
            await app.loadChats();
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
    // Останавливаем автообновление чата если уходим со страницы чата
    if (app.currentChatId && pageName !== 'chat-view') {
        app.stopChatAutoUpdate();
        app.currentChatId = null;
    }
    
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
        app.loadChats();
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

    // Табы на странице чата больше не нужны - убрали
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

// Участие во взаимке - показываем модалку
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
            app.currentMutual = data.mutual;
            app.showJoinMutualModal();
        } else {
            tg.showAlert(data.error || 'Ошибка при участии во взаимке');
        }
    } catch (error) {
        console.error('Join mutual error:', error);
        tg.showAlert('Ошибка при участии во взаимке');
    }
};

// Показать модалку участия
app.showJoinMutualModal = () => {
    if (!app.currentMutual) {
        console.error('No currentMutual to show modal');
        return;
    }
    
    console.log('Showing join mutual modal for:', app.currentMutual);
    
    const titleEl = document.getElementById('join-mutual-title');
    const infoEl = document.getElementById('join-mutual-info');
    const errorEl = document.getElementById('join-mutual-error');
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('modal-join-mutual');
    
    if (!titleEl || !infoEl || !errorEl || !overlayEl || !modalEl) {
        console.error('Modal elements not found');
        tg.showAlert('Ошибка: элементы модалки не найдены');
        return;
    }
    
    titleEl.textContent = 'Участие во взаимке';
    infoEl.innerHTML = `
        <p><strong>Канал:</strong> ${app.currentMutual.channel?.title || 'Неизвестный'}</p>
        <p><strong>Тип:</strong> ${app.currentMutual.mutual_type === 'subscribe' ? 'Подписка' : 'Реакция'}</p>
        <p>Нажмите "Начать чат" чтобы начать общение с создателем взаимки.</p>
    `;
    errorEl.classList.remove('active');
    
    overlayEl.classList.add('active');
    modalEl.classList.add('active');
};

// Начать чат для взаимки
app.startChatForMutual = async () => {
    if (!app.currentMutual) return;
    
    const errorDiv = document.getElementById('join-mutual-error');
    errorDiv.classList.remove('active');
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/chats/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                mutualId: app.currentMutual.id,
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            app.closeModal();
            app.currentChatId = data.chat.id;
            app.showChatView(data.chat.id);
        } else {
            errorDiv.textContent = data.error || 'Ошибка при создании чата';
            errorDiv.classList.add('active');
        }
    } catch (error) {
        console.error('Start chat error:', error);
        errorDiv.textContent = 'Ошибка при создании чата';
        errorDiv.classList.add('active');
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

// Загрузка чатов
app.loadChats = async () => {
    const list = document.getElementById('chats-list');
    if (!list) {
        console.error('chats-list element not found');
        return;
    }
    
    list.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const initData = tg.initData || '';
        console.log('Loading chats, userId:', app.userId);
        const response = await fetch(`${app.apiUrl}/chats`, {
            headers: {
                'X-Telegram-Init-Data': initData,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to load chats:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Chats data:', data);
        const chats = data.chats || [];

        // Добавляем общий чат в начало
        const generalChat = {
            id: 'general',
            is_general: true,
            title: 'Общий чат',
            user1_id: null,
            user2_id: null
        };

        const allChats = [generalChat, ...chats];
        
        if (allChats.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">Нет чатов</div>
                </div>
            `;
        } else {
            list.innerHTML = allChats.map(chat => {
                if (chat.is_general) {
                    return `
                        <div class="chat-card" onclick="app.showGeneralChat()">
                            <div class="channel-header">
                                <div class="channel-avatar">💬</div>
                                <div class="channel-info">
                                    <div class="channel-name">${chat.title}</div>
                                    <div class="channel-meta">Общий чат для всех пользователей</div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    const channelTitle = chat.channel_title || 'Взаимка';
                    return `
                        <div class="chat-card" onclick="app.showChatView(${chat.id})">
                            <div class="channel-header">
                                <div class="channel-avatar">💬</div>
                                <div class="channel-info">
                                    <div class="channel-name">${channelTitle}</div>
                                    <div class="channel-meta">Чат 1 на 1</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        }
    } catch (error) {
        console.error('Load chats error:', error);
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Ошибка загрузки чатов</div>
                <div style="margin-top: 10px; font-size: 12px; color: #757575;">${error.message}</div>
            </div>
        `;
    }
};

// Показать общий чат
app.showGeneralChat = () => {
    app.currentChatId = 'general';
    app.showChatView('general');
};

// Показать конкретный чат
app.showChatView = async (chatId) => {
    app.currentChatId = chatId;
    
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Показываем страницу чата
    const page = document.getElementById('page-chat-view');
    if (page) {
        page.classList.add('active');
    }
    
    // Устанавливаем заголовок
    const titleEl = document.getElementById('chat-title');
    if (titleEl) {
        if (chatId === 'general') {
            titleEl.textContent = 'Общий чат';
        } else {
            // Загружаем информацию о чате для заголовка
            const chats = await fetch(`${app.apiUrl}/chats`, {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || '',
                    'Content-Type': 'application/json'
                }
            }).then(r => r.json()).catch(() => ({ chats: [] }));
            
            const chat = chats.chats?.find(c => c.id === chatId);
            if (chat) {
                titleEl.textContent = chat.channel_title || 'Чат';
            } else {
                titleEl.textContent = 'Чат';
            }
        }
    }
    
    // Загружаем сообщения
    await app.loadChatMessages();
    
    // Прокручиваем вниз
    setTimeout(() => {
        const messagesDiv = document.getElementById('chat-messages');
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }, 100);
    
    // Запускаем автообновление чата
    app.startChatAutoUpdate();
};

// Загрузить сообщения чата
app.loadChatMessages = async () => {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    messagesDiv.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const initData = tg.initData || '';
        let response;
        
        if (app.currentChatId === 'general') {
            response = await fetch(`${app.apiUrl}/general-chat`, {
                headers: {
                    'X-Telegram-Init-Data': initData,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            if (!app.currentChatId || isNaN(app.currentChatId)) {
                throw new Error('Invalid chat ID');
            }
            
            response = await fetch(`${app.apiUrl}/chats/${app.currentChatId}/messages`, {
                headers: {
                    'X-Telegram-Init-Data': initData,
                    'Content-Type': 'application/json'
                }
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to load messages:', errorData);
            throw new Error(errorData.error || `Failed to load messages (${response.status})`);
        }

        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
            messagesDiv.innerHTML = '<div class="empty-state">Нет сообщений</div>';
        } else {
            const wasScrolledToBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop <= messagesDiv.clientHeight + 100;
            
            messagesDiv.innerHTML = messages.map(msg => {
                const isOwn = msg.user_telegram_id === app.userId;
                const userInfo = msg.user_info || {};
                const username = userInfo.username || userInfo.first_name || `User ${msg.user_telegram_id}`;
                const displayName = userInfo.first_name || username;
                
                // Сохраняем последний ID сообщения для оптимизации обновлений
                if (!app.lastMessageId || msg.id > app.lastMessageId) {
                    app.lastMessageId = msg.id;
                }
                
                const photoUrl = userInfo.photo_url || '';
                const avatarHTML = photoUrl 
                    ? `<img src="${photoUrl}" class="message-avatar" alt="${displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : '';
                const placeholderHTML = !photoUrl 
                    ? `<div class="message-avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
                    : '';
                
                return `
                    <div class="message ${isOwn ? 'message-own' : 'message-other'}" data-message-id="${msg.id}">
                        ${!isOwn ? `
                            <div class="message-user-info" onclick="app.showUserMenu(${msg.user_telegram_id}, '${displayName.replace(/'/g, "\\'")}', '${(userInfo.username || '').replace(/'/g, "\\'")}', '${(photoUrl || '').replace(/'/g, "\\'")}')">
                                ${avatarHTML}
                                ${placeholderHTML}
                                <div class="message-author">${displayName}</div>
                            </div>
                        ` : ''}
                        <div class="message-text">${msg.text}</div>
                        <div class="message-time">${app.formatTime(msg.created_at)}</div>
                    </div>
                `;
            }).join('');
            
            // Прокручиваем вниз только если пользователь уже был внизу
            if (wasScrolledToBottom) {
                setTimeout(() => {
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }, 50);
            }
        }
        
        // Прокручиваем вниз
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
        
        // Показываем кнопку "Выполнено" для личных чатов
        if (app.currentChatId !== 'general') {
            const completeSection = document.getElementById('chat-complete-section');
            if (completeSection) {
                completeSection.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Load messages error:', error);
        messagesDiv.innerHTML = '<div class="error-message active">Ошибка загрузки сообщений</div>';
    }
};

// Отправить сообщение
app.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    
    const text = input.value.trim();
    input.value = '';

    try {
        const initData = tg.initData || '';
        let response;
        
        if (app.currentChatId === 'general') {
            response = await fetch(`${app.apiUrl}/general-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': initData
                },
                body: JSON.stringify({
                    text: text,
                    userId: app.userId
                })
            });
        } else {
            if (!app.currentChatId || app.currentChatId === 'general' || isNaN(app.currentChatId)) {
                tg.showAlert('Ошибка: неверный ID чата');
                return;
            }
            
            response = await fetch(`${app.apiUrl}/chats/${app.currentChatId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': initData
                },
                body: JSON.stringify({
                    text: text,
                    userId: app.userId
                })
            });
        }

        if (response.ok) {
            const data = await response.json();
            // Добавляем новое сообщение сразу в UI для мгновенной обратной связи
            if (data.message) {
                app.addMessageToUI(data.message);
            }
            // Затем обновляем все сообщения для синхронизации
            await app.loadChatMessages();
        } else {
            const errorData = await response.json().catch(() => ({}));
            tg.showAlert(errorData.error || 'Ошибка при отправке сообщения');
        }
    } catch (error) {
        console.error('Send message error:', error);
        tg.showAlert('Ошибка при отправке сообщения');
    }
};

// Отметить чат как выполненный
app.completeChat = async () => {
    if (!app.currentChatId || app.currentChatId === 'general') return;
    
    try {
        const initData = tg.initData;
        const response = await fetch(`${app.apiUrl}/chats/${app.currentChatId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData
            },
            body: JSON.stringify({
                userId: app.userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            tg.showAlert('✅ Взаимка отмечена как выполненная!');
            await app.loadChats();
            app.showPage('chat');
        } else {
            tg.showAlert(data.error || 'Ошибка');
        }
    } catch (error) {
        console.error('Complete chat error:', error);
        tg.showAlert('Ошибка');
    }
};

// Автообновление чата
app.startChatAutoUpdate = () => {
    // Останавливаем предыдущий интервал если есть
    if (app.chatUpdateInterval) {
        clearInterval(app.chatUpdateInterval);
    }
    
    // Обновляем каждые 1 секунду для более быстрого отклика
    app.chatUpdateInterval = setInterval(async () => {
        if (app.currentChatId && document.getElementById('page-chat-view')?.classList.contains('active')) {
            await app.updateChatMessages();
        }
    }, 1000);
};

// Остановить автообновление
app.stopChatAutoUpdate = () => {
    if (app.chatUpdateInterval) {
        clearInterval(app.chatUpdateInterval);
        app.chatUpdateInterval = null;
    }
};

// Оптимизированное обновление сообщений (только новые)
app.updateChatMessages = async () => {
    if (!app.currentChatId) return;
    
    try {
        const initData = tg.initData || '';
        let response;
        
        if (app.currentChatId === 'general') {
            response = await fetch(`${app.apiUrl}/general-chat`, {
                headers: {
                    'X-Telegram-Init-Data': initData,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            response = await fetch(`${app.apiUrl}/chats/${app.currentChatId}/messages`, {
                headers: {
                    'X-Telegram-Init-Data': initData,
                    'Content-Type': 'application/json'
                }
            });
        }

        if (response.ok) {
            const data = await response.json();
            const messages = data.messages || [];
            
            // Находим новые сообщения
            const messagesDiv = document.getElementById('chat-messages');
            if (!messagesDiv) return;
            
            const existingIds = new Set(
                Array.from(messagesDiv.querySelectorAll('[data-message-id]'))
                    .map(el => parseInt(el.dataset.messageId))
            );
            
            const newMessages = messages.filter(msg => !existingIds.has(msg.id));
            
            // Добавляем только новые сообщения
            if (newMessages.length > 0) {
                const wasScrolledToBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop <= messagesDiv.clientHeight + 100;
                
                newMessages.forEach(msg => {
                    app.addMessageToUI(msg);
                });
                
                // Прокручиваем вниз только если пользователь был внизу
                if (wasScrolledToBottom) {
                    setTimeout(() => {
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }, 50);
                }
            }
        }
    } catch (error) {
        console.error('Update chat messages error:', error);
    }
};

// Добавить сообщение в UI
app.addMessageToUI = (msg) => {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    const isOwn = msg.user_telegram_id === app.userId;
    const userInfo = msg.user_info || {};
    const username = userInfo.username || userInfo.first_name || `User ${msg.user_telegram_id}`;
    const displayName = userInfo.first_name || username;
    const photoUrl = userInfo.photo_url || '';
    const avatarHTML = photoUrl 
        ? `<img src="${photoUrl}" class="message-avatar" alt="${displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
        : '';
    const placeholderHTML = !photoUrl 
        ? `<div class="message-avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
        : '';
    
    const messageHTML = `
        <div class="message ${isOwn ? 'message-own' : 'message-other'}" data-message-id="${msg.id}">
            ${!isOwn ? `
                <div class="message-user-info" onclick="app.showUserMenu(${msg.user_telegram_id}, '${displayName.replace(/'/g, "\\'")}', '${(userInfo.username || '').replace(/'/g, "\\'")}', '${(photoUrl || '').replace(/'/g, "\\'")}')">
                    ${avatarHTML}
                    ${placeholderHTML}
                    <div class="message-author">${displayName}</div>
                </div>
            ` : ''}
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${app.formatTime(msg.created_at)}</div>
        </div>
    `;
    
    messagesDiv.insertAdjacentHTML('beforeend', messageHTML);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

// Старая функция loadChatPosts (удаляем или оставляем для совместимости)
app.loadChatPosts = async () => {
    // Больше не используется, перенаправляем на loadChats
    await app.loadChats();
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
            app.loadChats();
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
            app.loadChats();
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

// Показать меню пользователя
app.showUserMenu = (userId, displayName, username, photoUrl) => {
    app.selectedUserId = userId;
    app.selectedUserName = displayName;
    app.selectedUserUsername = username;
    
    const avatarEl = document.getElementById('user-modal-avatar');
    const nameEl = document.getElementById('user-modal-name');
    const usernameEl = document.getElementById('user-modal-username');
    
    if (avatarEl) {
        if (photoUrl) {
            avatarEl.src = photoUrl;
            avatarEl.style.display = 'block';
        } else {
            avatarEl.style.display = 'none';
        }
    }
    
    if (nameEl) {
        nameEl.textContent = displayName;
    }
    
    if (usernameEl) {
        usernameEl.textContent = username ? `@${username}` : '';
        usernameEl.style.display = username ? 'block' : 'none';
    }
    
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-user').classList.add('active');
};

// Открыть чат с пользователем в MiniApp
app.openChatWithUser = async () => {
    if (!app.selectedUserId) return;
    
    try {
        // Ищем существующий чат или создаем новый
        const initData = tg.initData || '';
        const response = await fetch(`${app.apiUrl}/chats`, {
            headers: {
                'X-Telegram-Init-Data': initData,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const chats = data.chats || [];
            
            // Ищем чат с этим пользователем
            let chat = chats.find(c => 
                (c.user1_id === app.selectedUserId && c.user2_id === app.userId) ||
                (c.user1_id === app.userId && c.user2_id === app.selectedUserId)
            );
            
            if (chat) {
                app.closeModal();
                app.showChatView(chat.id);
            } else {
                // Создаем новый чат (без mutual_id для обычного общения)
                const createResponse = await fetch(`${app.apiUrl}/chats/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': initData
                    },
                    body: JSON.stringify({
                        userId: app.userId,
                        otherUserId: app.selectedUserId
                    })
                });
                
                if (createResponse.ok) {
                    const chatData = await createResponse.json();
                    app.closeModal();
                    app.showChatView(chatData.chat.id);
                } else {
                    const errorData = await createResponse.json().catch(() => ({}));
                    tg.showAlert(errorData.error || 'Ошибка при создании чата');
                }
            }
        }
    } catch (error) {
        console.error('Open chat error:', error);
        tg.showAlert('Ошибка при открытии чата');
    }
};

// Открыть чат в Telegram
app.openTelegramChat = () => {
    if (!app.selectedUserId) return;
    
    const username = app.selectedUserUsername;
    if (username) {
        window.open(`https://t.me/${username}`, '_blank');
    } else {
        // Если нет username, открываем через user ID (работает только если пользователь уже писал боту)
        tg.openLink(`https://t.me/user${app.selectedUserId}`);
    }
    
    app.closeModal();
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

