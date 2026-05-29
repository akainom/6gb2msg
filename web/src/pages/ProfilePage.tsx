import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { filesApi, profilesApi } from '../shared/resources';
import { authApi } from '../shared/api';
import { useSocketEvent } from '../features/socket/useSocketEvent';

const STATUS_OPTIONS = [
  { key: 'online', label: 'В сети',     color: '#168555', bg: '#e3fcf1' },
  { key: 'away',  label: 'Отошёл',      color: '#d27a00', bg: '#fef3e5' },
  { key: 'do not disturb', label: 'Не беспокоить', color: '#c72527', bg: '#fde8e8' },
  { key: 'offline', label: 'Не в сети',  color: '#5c6c75', bg: '#e8edeb' },
];

export function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(auth.profile);
  const [saving, setSaving] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [showDanger, setShowDanger] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.userId) {
      profilesApi.getByUser(auth.userId).then(p => { setProfile(p); auth.setProfile(p); });
    }
  }, [auth.userId]);

  useSocketEvent('user:status', (data: any) => {
    if (auth.userId && data.userId === auth.userId) {
      setProfile((p) => p ? { ...p, status: data.status, displayName: data.displayName ?? p.displayName, username: data.username ?? p.username } : p);
    }
  });

  const toast_ = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const onAvatar = async (f: File) => {
    try {
      const u = await filesApi.uploadAvatar(f);
      const p = await profilesApi.updateMe({ avatar: u.avatar });
      setProfile(p); auth.setProfile(p); setAvatarKey(Date.now());
      toast_('ok', 'Аватар обновлён');
    } catch { toast_('err', 'Ошибка загрузки'); }
  };

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const p = await profilesApi.updateMe({
        username: String(fd.get('username')),
        displayName: String(fd.get('displayName') ?? ''),
        bio: String(fd.get('bio') ?? ''),
        location: String(fd.get('location') ?? ''),
        status: String(fd.get('status') ?? 'online'),
      });
      setProfile(p); auth.setProfile(p);
      toast_('ok', 'Сохранено');
    } catch { toast_('err', 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const onPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await authApi.changePassword(String(fd.get('oldPassword')), String(fd.get('newPassword')));
      e.currentTarget.reset();
      toast_('ok', 'Пароль изменён');
    } catch { toast_('err', 'Неверный текущий пароль'); }
  };

  const onDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await profilesApi.deleteMe(String(new FormData(e.currentTarget).get('password')));
      await auth.logout(); navigate('/login');
    } catch { toast_('err', 'Неверный пароль'); }
  };

  const initial = (profile?.displayName || profile?.username || '?')[0].toUpperCase();
  const status = STATUS_OPTIONS.find(s => s.key === (profile?.status ?? 'online'))!;
  const isOAuth = auth.user?.authProvider === 'google';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 60, right: 20, zIndex: 400, color: '#fff', padding: '.5rem 1rem',
          borderRadius: 'var(--radius)', fontSize: '.85rem', fontWeight: 600, boxShadow: 'var(--shadow-md)',
          background: toast.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
        }}>{toast.msg}</div>
      )}

      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto', cursor: 'pointer',
          borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--bg-panel)', boxShadow: 'var(--shadow-sm)' }}
          onClick={() => avatarRef.current?.click()} title="Сменить аватар">
          {profile?._id
            ? <img key={avatarKey} src={`${filesApi.avatarUrl(profile._id)}?v=${avatarKey}`} alt=""
                style={{ width: 96, height: 96, objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: 96, height: 96, background: 'var(--accent)', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: '2.4rem', fontWeight: 700 }}>{initial}</div>
          }
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid',
            placeItems: 'center', opacity: 0, transition: 'opacity .15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}>
            <span style={{ color: '#fff', fontSize: '.7rem', fontWeight: 600 }}>Сменить</span>
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onAvatar(f); e.target.value = ''; }} />

        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '.65rem 0 .15rem', color: 'var(--text-primary)' }}>
          {profile?.displayName || profile?.username || '…'}
        </h1>
        <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          @{profile?.username}
          {profile?.location ? ` · ${profile.location}` : ''}
        </p>
        <div style={{ marginTop: '.5rem' }}>
          <span style={{ display: 'inline-block', padding: '.2rem .65rem', borderRadius: '999px',
            fontSize: '.78rem', fontWeight: 600, color: status.color, background: status.bg }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* ─── Profile Form ─── */}
      <form onSubmit={onSave} style={{ display: 'grid', gap: '1.25rem' }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '.75rem' }}>Основное</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.85rem' }}>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Имя пользователя
              </label>
              <input name="username" defaultValue={profile?.username} minLength={6} maxLength={15} required />
            </div>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Отображаемое имя
              </label>
              <input name="displayName" defaultValue={profile?.displayName ?? ''} maxLength={128} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '.75rem' }}>О себе</div>
          <textarea name="bio" defaultValue={profile?.bio ?? ''} rows={3} maxLength={1000}
            placeholder="Расскажите о себе…" />
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '.75rem' }}>Город и статус</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.85rem' }}>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Город</label>
              <input name="location" defaultValue={profile?.location ?? ''} placeholder="Москва" />
            </div>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Статус</label>
              <select name="status" defaultValue={profile?.status ?? 'online'}>
                {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} style={{ padding: '.5rem 1.5rem' }}>
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        </div>
      </form>

      {/* ─── Password ─── */}
      {!isOAuth && (
        <form onSubmit={onPassword} style={{ marginTop: '1.25rem' }}>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: '.75rem' }}>Смена пароля</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.85rem' }}>
              <div style={{ display: 'grid', gap: '.25rem' }}>
                <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Текущий пароль
                </label>
                <input name="oldPassword" type="password" autoComplete="off" required />
              </div>
              <div style={{ display: 'grid', gap: '.25rem' }}>
                <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Новый пароль
                </label>
                <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
              </div>
            </div>
            <div style={{ marginTop: '.85rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-secondary" style={{ padding: '.5rem 1.5rem' }}>Сменить пароль</button>
            </div>
          </div>
        </form>
      )}

      {/* ─── Danger Zone ─── */}
      <div style={{ marginTop: '1.25rem', marginBottom: '2rem' }}>
        {!showDanger ? (
          <button className="btn-secondary" style={{ width: '100%', padding: '.5rem', fontSize: '.8rem', color: 'var(--text-secondary)' }}
            onClick={() => setShowDanger(true)}>
            Удалить аккаунт
          </button>
        ) : (
          <form onSubmit={onDelete}>
            <div className="card danger-card">
              <div className="eyebrow" style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>Удаление аккаунта</div>
              <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.65rem' }}>
                Это действие необратимо: все чаты, сообщения и данные будут удалены.
              </p>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <input name="password" type="password" placeholder="Введите пароль для подтверждения" required
                  style={{ flex: 1 }} autoFocus />
                <button type="submit" className="btn-danger" style={{ padding: '.55rem 1.25rem', flexShrink: 0 }}>
                  Удалить
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '.55rem 1rem', flexShrink: 0 }}
                  onClick={() => setShowDanger(false)}>
                  Отмена
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
