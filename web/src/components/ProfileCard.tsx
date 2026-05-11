import type { Profile } from '../shared/types';
import { filesApi } from '../shared/resources';
import { useState } from 'react';

const statusIcons: Record<string, string> = {
  online: '🟢',
  offline: '⚫',
  away: '🟡',
  'do not disturb': '🔴',
};

export function ProfileCard({
  profile,
  isOwn,
  onClose,
  onStartChat,
  onReport,
}: {
  profile: Profile;
  isOwn: boolean;
  onClose: () => void;
  onStartChat?: () => void;
  onReport?: () => void;
}) {
  const [avatarKey] = useState(Date.now());
  const initial = (profile.displayName || profile.username || '?')[0].toUpperCase();
  const statusIcon = statusIcons[profile.status ?? 'offline'] || '⚫';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Профиль</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="profile-card">
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <div className="avatar avatar-lg" style={{ display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{initial}</div>
            {profile._id && (
              <img className="avatar avatar-lg" src={`${filesApi.avatarUrl(profile._id)}?v=${avatarKey}`} alt={`${profile.username} avatar`}
                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>
          <div>
            <div className="username">{profile.username}</div>
            {profile.displayName && <div className="display-name">{profile.displayName}</div>}
            <div className="text-secondary" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>@{profile.username}</div>
          </div>
          {profile.bio && <div className="bio">{profile.bio}</div>}
          <div className="meta">
            <span>{statusIcon} {profile.status || 'offline'}</span>
            {profile.location && <span style={{ marginLeft: '.75rem' }}>📍 {profile.location}</span>}
          </div>
          {!isOwn && (
            <div className="actions">
              {onStartChat && <button type="button" onClick={onStartChat}>Написать</button>}
              {onReport && <button type="button" className="btn-secondary" onClick={onReport}>Пожаловаться</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
