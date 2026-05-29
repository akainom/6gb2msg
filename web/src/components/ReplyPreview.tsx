import type { FC } from 'react';

type Props = {
  replyTo: { text: string; senderName: string } | null;
  onCancel: () => void;
};

export const ReplyPreview: FC<Props> = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;
  return (
    <div className="reply-preview">
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--accent)' }}>
          В ответ {replyTo.senderName}
        </span>
        <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginLeft: '.5rem' }}>
          {replyTo.text.slice(0, 120)}
        </span>
      </div>
      <button type="button" className="btn-ghost" onClick={onCancel} style={{ fontSize: '1rem', padding: '0 .3rem' }}>
        ✕
      </button>
    </div>
  );
};
