import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { filesApi, profilesApi } from '../shared/resources';
import type { Profile } from '../shared/types';
import { Card, ErrorMessage, Field, PageHeader, submitForm } from '../shared/ui';

export function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(auth.profile);
  const [error, setError] = useState<unknown>(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deletePassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.userId) void profilesApi.getByUser(auth.userId).then((next) => { setProfile(next); auth.setProfile(next); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  return (
    <>
      <PageHeader title="Настройки профиля" />
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            {profile?._id ? (
              <img key={avatarKey} className="avatar avatar-lg" src={`${filesApi.avatarUrl(profile._id)}?v=${avatarKey}`} alt="" style={{ width: 72, height: 72 }} />
            ) : (
              <div className="avatar avatar-lg" style={{ width: 72, height: 72 }}>{(profile?.username || '?')[0].toUpperCase()}</div>
            )}
            <form style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: 1 }}
              onSubmit={submitForm(async (form) => {
                const file = form.get('avatar');
                if (!(file instanceof File) || !file.size) return;
                const uploaded = await filesApi.uploadAvatar(file);
                const next = await profilesApi.updateMe({ avatar: uploaded.avatar });
                setProfile(next); auth.setProfile(next); setAvatarKey(Date.now());
              })}>
              <input name="avatar" type="file" accept="image/*" style={{ fontSize: '.82rem' }} />
              <button>Сменить</button>
            </form>
          </div>

          <form onSubmit={submitForm(async (form) => {
            setError(null);
            try {
              const next = await profilesApi.updateMe({
                username: String(form.get('username')),
                displayName: String(form.get('displayName') ?? ''),
                bio: String(form.get('bio') ?? ''),
                location: String(form.get('location') ?? ''),
                status: String(form.get('status') ?? 'online'),
              });
              setProfile(next); auth.setProfile(next);
            } catch (e) { setError(e); }
          })}>
            <Field label="Username"><input name="username" defaultValue={profile?.username} minLength={6} maxLength={15} required /></Field>
            <Field label="Display Name"><input name="displayName" defaultValue={profile?.displayName ?? ''} maxLength={128} /></Field>
            <Field label="Bio"><textarea name="bio" defaultValue={profile?.bio} rows={3} /></Field>
            <Field label="Location"><input name="location" defaultValue={profile?.location} /></Field>
            <Field label="Display Status">
              <select name="status" defaultValue={profile?.status ?? 'online'}>
                <option value="online">🟢 Online</option>
                <option value="away">🟡 Away</option>
                <option value="do not disturb">🔴 Do Not Disturb</option>
                <option value="offline">⚫ Offline</option>
              </select>
            </Field>
            <ErrorMessage error={error} />
            <button>Сохранить</button>
          </form>
        </Card>

        <Card className="danger-card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ color: 'var(--danger)' }}>Опасная зона</h3>
          {!deleteConfirm ? (
            <button className="btn-danger" onClick={() => setDeleteConfirm(true)}>Удалить аккаунт</button>
          ) : (
            <form onSubmit={submitForm(async (form) => {
              setError(null);
              try {
                await profilesApi.deleteMe(String(form.get('password')));
                await auth.logout();
                navigate('/login');
              } catch (e) { setError(e); }
            })} style={{ display: 'grid', gap: '.5rem' }}>
              <p className="text-secondary" style={{ fontSize: '.85rem' }}>Введите пароль для подтверждения удаления. Это действие необратимо.</p>
              <input ref={deletePassRef} name="password" type="password" placeholder="Пароль" required autoFocus />
              <ErrorMessage error={error} />
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(false)}>Отмена</button>
                <button type="submit" className="btn-danger">Подтвердить удаление</button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
