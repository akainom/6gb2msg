import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { DropdownMenu } from '../components/Menu';
import { ProfileCard } from '../components/ProfileCard';
import { chatsApi, filesApi, profilesApi } from '../shared/resources';
import type { Chat, Profile } from '../shared/types';

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [avatarV, setAvatarV] = useState(0);

  const displayProfile = auth.profile;
  const initial = (displayProfile?.displayName || displayProfile?.username || auth.userId || '?')[0].toUpperCase();

  const prevProfile = useRef(auth.profile);
  useEffect(() => {
    if (auth.profile !== prevProfile.current) {
      prevProfile.current = auth.profile;
      setAvatarV((v) => v + 1);
    }
  }, [auth.profile]);

  // Dark theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ profiles: Profile[]; chats: Chat[] }>({ profiles: [], chats: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchProfileModal, setSearchProfileModal] = useState<Profile | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults({ profiles: [], chats: [] }); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const [profiles, chats] = await Promise.all([
          profilesApi.search(q).catch(() => []),
          chatsApi.search(q).catch(() => []),
        ]);
        setSearchResults({ profiles, chats });
        setSearchOpen(true);
      } catch { setSearchResults({ profiles: [], chats: [] }); }
    }, 250);
  };

  const clearSearch = () => { setSearchQuery(''); setSearchResults({ profiles: [], chats: [] }); setSearchOpen(false); };

  const selectChatFromSearch = (chatId: string) => {
    clearSearch();
    navigate('/');
    setTimeout(() => document.dispatchEvent(new CustomEvent('chat:select', { detail: chatId })), 100);
  };

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
          <NavLink to="/" className="topbar-brand">6GB2MSG</NavLink>
          <nav className="topbar-nav">
            {!auth.isAdmin && <NavLink to="/">Чаты</NavLink>}
            {!auth.isAdmin && <NavLink to="/profile">Профиль</NavLink>}
            {!auth.isAdmin && <NavLink to="/reports">Жалобы</NavLink>}
            <NavLink to="/stats">Статистика</NavLink>
            {auth.isAdmin && <NavLink to="/admin/reports">Модерация</NavLink>}
          </nav>
        </div>
        <div className="topbar-right">
          {!auth.isAdmin && <div className="search-bar" style={{ position: 'relative', maxWidth: 280 }}>
            <svg style={{ position: 'absolute', left: '.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.profiles.length + searchResults.chats.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              style={{ paddingLeft: '2.2rem', fontSize: '.85rem' }}
            />
            {searchOpen && (searchResults.profiles.length > 0 || searchResults.chats.length > 0) && (
              <div className="search-dropdown">
                {searchResults.chats.length > 0 && (
                  <>
                    <div style={{ padding: '.35rem .75rem', fontSize: '.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Чаты</div>
                    {searchResults.chats.map((c) => (
                      <button key={c._id} type="button" className="menu-item"
                        onMouseDown={() => selectChatFromSearch(c._id)}>
                        💬 {c.title || `чат ${c.type === 'private' ? '1-на-1' : 'групповой'}`}
                      </button>
                    ))}
                  </>
                )}
                {searchResults.profiles.length > 0 && (
                  <>
                    <div style={{ padding: '.35rem .75rem', fontSize: '.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Люди</div>
                    {searchResults.profiles.map((p) => (
                      <button key={p._id} type="button" className="menu-item"
                        onMouseDown={() => { setSearchOpen(false); setSearchProfileModal(p); }}>
                        {p.displayName || p.username} <span className="text-secondary" style={{ marginLeft: '.25rem' }}>@{p.username}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>}
          {!auth.isAdmin && <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Переключить тему">{theme === 'dark' ? '☀️' : '🌙'}</button>}
          <DropdownMenu
            trigger={
              <div className="topbar-user">
                {displayProfile?._id ? (
                  <img className="avatar" src={`${filesApi.avatarUrl(displayProfile._id)}?v=${avatarV}`} alt="" style={{ width: 28, height: 28 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                <div className="avatar" style={{ width: 28, height: 28, fontSize: '.7rem', display: displayProfile?._id ? 'none' : 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{initial}</div>
                <span className="text-secondary" style={{ fontSize: '.85rem' }}>
                  {displayProfile?.displayName || displayProfile?.username || auth.userId}
                </span>
              </div>
            }
            items={[
              ...(auth.isAdmin ? [] : [{ label: 'Профиль', action: () => navigate('/profile') }]),
              { label: 'Выйти со всех устройств', action: () => void auth.logoutAll().then(() => navigate('/login')) },
              { label: 'Выйти', danger: true, action: () => void auth.logout().then(() => navigate('/login')) },
            ]}
          />
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>

      {searchProfileModal && (
        <ProfileCard
          profile={searchProfileModal}
          isOwn={searchProfileModal.user_id === auth.userId}
          onClose={() => setSearchProfileModal(null)}
          onStartChat={async () => {
            try {
              const [chat, profile] = await Promise.all([
                chatsApi.createPrivate(searchProfileModal.user_id),
                profilesApi.getByUser(searchProfileModal.user_id),
              ]);
              if (profile) {
                chat.peer = {
                  user_id: searchProfileModal.user_id,
                  profile_id: profile._id,
                  username: profile.username,
                  displayName: profile.displayName,
                  status: profile.status,
                  last_online: profile.last_online,
                };
              }
              setSearchProfileModal(null);
              navigate('/');
              setTimeout(() => document.dispatchEvent(new CustomEvent('chat:select', { detail: chat._id })), 100);
            } catch (e: any) {
              if (e?.code === 'ERR_CHAT_EX') {
                setSearchProfileModal(null);
                navigate('/');
                const items = await chatsApi.list();
                const found = items.find((c: Chat) =>
                  c.type === 'private' && c.participants?.some((p: any) => String(p.user_id) === String(searchProfileModal.user_id)),
                );
                setTimeout(() => { if (found) document.dispatchEvent(new CustomEvent('chat:select', { detail: found._id })); }, 100);
              }
            }
          }}
        />
      )}
    </>
  );
}
