import type { FC } from 'react';

type Props = {
  pinned: { text: string; message_id: string } | null;
  onUnpin?: () => void;
  onJump?: (messageId: string) => void;
};

export const PinnedBanner: FC<Props> = ({ pinned, onUnpin, onJump }) => {
  if (!pinned) return null;
  return (
    <div className="pinned-banner" onClick={() => onJump?.(pinned.message_id)} style={{ cursor: 'pointer' }}>
      <span style={{ fontSize: '.85rem' }}>📌</span>
      <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pinned.text}
      </span>
      {onUnpin && (
        <button type="button" className="btn-ghost" onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          style={{ fontSize: '1rem', padding: '0 .3rem' }}>✕</button>
      )}
    </div>
  );
};
