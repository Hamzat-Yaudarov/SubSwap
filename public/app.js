const { useState, useEffect, useRef } = React;
const root = ReactDOM.createRoot(document.getElementById('app'));

// API helper
const api = {
  baseURL: '/api',
  
  async request(method, endpoint, data = null) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Init-Data': window.Telegram?.WebApp?.initData || ''
    };

    const options = {
      method,
      headers
    };

    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },

  async get(endpoint) {
    return this.request('GET', endpoint);
  },

  async patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  },

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
};

// Components
function Home({ user, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get('/profile');
      setProfile(data.user);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-content">
      <h1 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: '700' }}>Главная</h1>

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : profile ? (
        <>
          {/* Stats card */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Ваш прогресс</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Получено подписчиков</div>
                <div className="stat-value">{profile.channels_count || 0}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Активных взаимок</div>
                <div className="stat-value">{profile.active_mutuals || 0}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Рейтинг</div>
                <div className="stat-value">⭐ {profile.rating}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Выполнено</div>
                <div className="stat-value">{profile.completed_mutuals || 0}</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="card">
            <button 
              className="button button-primary mb-12"
              onClick={() => onNavigate('mutuals')}
            >
              🔍 Найти взаимку
            </button>
            <button 
              className="button button-secondary"
              onClick={() => onNavigate('channels')}
            >
              ➕ Добавить канал
            </button>
          </div>

          {/* How it works */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Как это работает</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>1️⃣</div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Добавь канал</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Добавьте свой канал или чат в систему</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>2️⃣</div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Найди взаимку</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Выбери подходящую взаимку и выполни задание</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>3️⃣</div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Получай рост</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Участвуй во взаимках и расти безопасно</div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Channels({ onNavigate }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ link: '', type: 'channel' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await api.get('/channels');
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const data = await api.post('/channels/add', formData);
      setChannels([...channels, data.channel]);
      setFormData({ link: '', type: 'channel' });
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="app-content">
      <h1 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: '700' }}>Мои каналы</h1>

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : channels.length === 0 && !showAddForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📺</div>
          <div className="empty-state-title">Нет каналов</div>
          <div className="empty-state-text">Добавьте свой первый канал или чат</div>
          <button 
            className="button button-primary"
            onClick={() => setShowAddForm(true)}
          >
            ➕ Добавить канал
          </button>
        </div>
      ) : (
        <>
          {channels.map(channel => (
            <div key={channel.id} className="channel-card">
              <div className="channel-avatar">
                {channel.type === 'channel' ? '📢' : '💬'}
              </div>
              <div className="channel-info">
                <div className="channel-title">{channel.title}</div>
                <div className="channel-meta">
                  <span>{channel.type === 'channel' ? 'Канал' : 'Чат'}</span>
                  <span>👥 {channel.members_count}</span>
                  <span className="channel-rating">⭐ {channel.rating}</span>
                </div>
              </div>
            </div>
          ))}

          {!showAddForm && (
            <button 
              className="button button-secondary"
              onClick={() => setShowAddForm(true)}
              style={{ marginTop: '12px' }}
            >
              ➕ Добавить канал
            </button>
          )}
        </>
      )}

      {showAddForm && (
        <div className="card" style={{ marginTop: '12px', border: '2px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '12px', fontWeight: '600' }}>Добавить канал</h2>
          <form onSubmit={handleAddChannel}>
            <div className="form-group">
              <label className="form-label">Ссылка на канал</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://t.me/..."
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                disabled={formLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Тип</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={formLoading}
              >
                <option value="channel">Канал</option>
                <option value="chat">Чат</option>
              </select>
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <button 
              type="submit"
              className="button button-primary mb-12"
              disabled={formLoading}
            >
              {formLoading ? (
                <>
                  <div className="spinner"></div>
                  Проверка...
                </>
              ) : (
                '✓ Проверить и добавить'
              )}
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
              disabled={formLoading}
            >
              Отмена
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Mutuals({ onNavigate }) {
  const [tab, setTab] = useState('subscribe');
  const [mutuals, setMutuals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMutuals();
  }, [tab]);

  const loadMutuals = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/mutuals/available?mutual_type=${tab}`);
      setMutuals(data.mutuals || []);
    } catch (err) {
      console.error('Failed to load mutuals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (mutualId) => {
    try {
      await api.post(`/mutuals/${mutualId}/join`, {});
      setMutuals(mutuals.filter(m => m.id !== mutualId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app-content">
      <h1 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '700' }}>Взаимки</h1>

      <div className="tabs">
        <div 
          className={`tab ${tab === 'subscribe' ? 'active' : ''}`}
          onClick={() => setTab('subscribe')}
        >
          Подписки
        </div>
        <div 
          className={`tab ${tab === 'reaction' ? 'active' : ''}`}
          onClick={() => setTab('reaction')}
        >
          Реакции
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : mutuals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Взаимок не найдено</div>
          <div className="empty-state-text">Попробуйте позже или выберите другой тип</div>
        </div>
      ) : (
        <>
          {mutuals.map(mutual => (
            <div key={mutual.id} className="mutual-card">
              <div className="mutual-header">
                <div className="mutual-title">{mutual.title}</div>
                <div className="mutual-type">
                  {mutual.mutual_type === 'subscribe' ? '📢 Подписка' : '😊 Реакция'}
                </div>
              </div>
              <div className="mutual-details">
                <div className="mutual-detail-item">
                  👥 <strong>{mutual.members_count}</strong>
                </div>
                <div className="mutual-detail-item">
                  ✓ <strong>{mutual.required_count}</strong>
                </div>
                <div className="mutual-detail-item">
                  ⏱️ <strong>{mutual.hold_hours}ч</strong>
                </div>
                <div className="mutual-detail-item">
                  ⭐ <strong>{mutual.creator_rating}</strong>
                </div>
              </div>
              <button
                className="button button-primary button-small"
                onClick={() => handleJoin(mutual.id)}
              >
                💪 Участвовать
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Chat() {
  const [tab, setTab] = useState('channel');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [channels, setChannels] = useState([]);
  const [formData, setFormData] = useState({ channel_id: '', post_type: 'channel', conditions: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadPosts();
    loadChannels();
  }, [tab]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const postTypeMap = { channel: 'channel', chat: 'chat', reaction: 'reaction' };
      const data = await api.get(`/chat/posts?post_type=${postTypeMap[tab]}`);
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const data = await api.get('/channels');
      setChannels(data.channels || []);
      if (data.channels && data.channels.length > 0) {
        setFormData(prev => ({ ...prev, channel_id: data.channels[0].id }));
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (!formData.channel_id) {
        throw new Error('Выберите канал');
      }

      const data = await api.post('/chat/post', {
        channel_id: parseInt(formData.channel_id),
        post_type: formData.post_type,
        conditions: formData.conditions
      });

      setShowCreateForm(false);
      setFormData({ channel_id: channels[0]?.id || '', post_type: 'channel', conditions: '' });
      loadPosts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRespond = async (postId) => {
    try {
      await api.post(`/chat/${postId}/respond`, {});
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app-content">
      <h1 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '700' }}>Чат взаимок</h1>

      <div className="tabs">
        <div 
          className={`tab ${tab === 'channel' ? 'active' : ''}`}
          onClick={() => setTab('channel')}
        >
          Каналы
        </div>
        <div 
          className={`tab ${tab === 'chat' ? 'active' : ''}`}
          onClick={() => setTab('chat')}
        >
          Чаты
        </div>
        <div 
          className={`tab ${tab === 'reaction' ? 'active' : ''}`}
          onClick={() => setTab('reaction')}
        >
          Реакции
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : posts.length === 0 && !showCreateForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-title">Нет запросов</div>
          <div className="empty-state-text">Создайте свой первый запрос взаимки</div>
          {channels.length > 0 && (
            <button
              className="button button-primary"
              onClick={() => setShowCreateForm(true)}
              style={{ marginTop: '16px' }}
            >
              ➕ Создать запрос
            </button>
          )}
        </div>
      ) : (
        <>
          {posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-title">{post.channel_title}</div>
                <div className="post-time">{post.time_ago}</div>
              </div>
              <div className="post-meta">
                {post.post_type === 'channel' && 'Взаимная подписка на канал'}
                {post.post_type === 'chat' && 'Взаимная подписка на чат'}
                {post.post_type === 'reaction' && 'Обмен реакциями'}
                {post.conditions && ` • ${post.conditions}`}
              </div>
              <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                👥 {post.members_count} подписчиков • ⭐ {post.creator_rating} рейтинг
              </div>
              <button
                className="button button-primary button-small"
                onClick={() => handleRespond(post.id)}
              >
                ✓ Откликнуться
              </button>
            </div>
          ))}
        </>
      )}

      {!showCreateForm && channels.length > 0 && (
        <button
          className="button button-secondary"
          onClick={() => setShowCreateForm(true)}
          style={{ marginTop: '12px' }}
        >
          ➕ Создать запрос
        </button>
      )}

      {showCreateForm && (
        <div className="card" style={{ marginTop: '12px', border: '2px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '12px', fontWeight: '600' }}>Создать запрос</h2>
          <form onSubmit={handleCreatePost}>
            <div className="form-group">
              <label className="form-label">Выберите канал</label>
              <select
                className="form-select"
                value={formData.channel_id}
                onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                disabled={formLoading}
              >
                <option value="">-- Выберите канал --</option>
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title} ({ch.type === 'channel' ? '📢' : '💬'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Тип взаимки</label>
              <select
                className="form-select"
                value={formData.post_type}
                onChange={(e) => setFormData({ ...formData, post_type: e.target.value })}
                disabled={formLoading}
              >
                <option value="channel">📢 Подписка на канал</option>
                <option value="chat">💬 Подписка на чат</option>
                <option value="reaction">😊 Реакции</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Условия (опционально)</label>
              <input
                type="text"
                className="form-input"
                placeholder="например: до 500 подписчиков"
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                disabled={formLoading}
              />
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <button
              type="submit"
              className="button button-primary mb-12"
              disabled={formLoading}
            >
              {formLoading ? (
                <>
                  <div className="spinner"></div>
                  Публикация...
                </>
              ) : (
                '✓ Опубликовать'
              )}
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setShowCreateForm(false);
                setFormError('');
              }}
              disabled={formLoading}
            >
              Отмена
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get('/profile');
      setProfile(data.user);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-content">
      <h1 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: '700' }}>Профиль</h1>

      {loading ? (
        <div className="flex justify-center items-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : profile ? (
        <>
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>ID: {profile.id}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Участник с {new Date(profile.created_at).toLocaleDateString('ru-RU')}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Рейтинг</div>
                <div className="stat-value">⭐ {profile.rating}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Каналов</div>
                <div className="stat-value">{profile.channels_count}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Выполнено</div>
                <div className="stat-value">{profile.completed_mutuals}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Активных</div>
                <div className="stat-value">{profile.active_mutuals}</div>
              </div>
            </div>
          </div>

          {profile.is_banned && (
            <div className="alert alert-error">
              ⛔ Ваш аккаунт заблокирован
            </div>
          )}

          <button className="button button-danger" style={{ marginTop: '12px' }}>
            🚪 Выйти
          </button>
        </>
      ) : null}
    </div>
  );
}

// Main App component
function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initWebApp();
  }, []);

  const initWebApp = async () => {
    try {
      if (window.Telegram?.WebApp) {
        const webapp = window.Telegram.WebApp;
        webapp.ready();
        webapp.expand();
      }

      // Initialize user
      const data = await api.post('/auth', {});
      setUser(data.user);
    } catch (err) {
      console.error('Failed to initialize:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-main">
        {currentScreen === 'home' && <Home user={user} onNavigate={setCurrentScreen} />}
        {currentScreen === 'channels' && <Channels onNavigate={setCurrentScreen} />}
        {currentScreen === 'mutuals' && <Mutuals onNavigate={setCurrentScreen} />}
        {currentScreen === 'chat' && <Chat />}
        {currentScreen === 'profile' && <Profile user={user} />}
      </div>

      <nav className="bottom-nav">
        <div 
          className={`nav-item ${currentScreen === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('home')}
        >
          <div className="nav-item-icon">🏠</div>
          <div>Главная</div>
        </div>
        <div 
          className={`nav-item ${currentScreen === 'mutuals' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('mutuals')}
        >
          <div className="nav-item-icon">🔗</div>
          <div>Взаимки</div>
        </div>
        <div 
          className={`nav-item ${currentScreen === 'chat' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('chat')}
        >
          <div className="nav-item-icon">💬</div>
          <div>Чат</div>
        </div>
        <div 
          className={`nav-item ${currentScreen === 'channels' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('channels')}
        >
          <div className="nav-item-icon">📺</div>
          <div>Каналы</div>
        </div>
        <div 
          className={`nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('profile')}
        >
          <div className="nav-item-icon">👤</div>
          <div>Профиль</div>
        </div>
      </nav>
    </div>
  );
}

root.render(<App />);
