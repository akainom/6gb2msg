import { useEffect, useRef, useState, type FC } from 'react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😢', '😡', '🔥', '👏', '💯'];

type ReactionData = { reaction: string; user_id: string; created_at?: string };
type Props = {
  messageId: string;
  chatId: string;
  reactions: ReactionData[];
  currentUserId: string;
  onReact: (chatId: string, messageId: string, reaction: string) => Promise<void>;
};

export const ReactionPicker: FC<Props> = ({ messageId, chatId, reactions, currentUserId, onReact }) => {
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as HTMLElement)) setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPicker]);

  const grouped = (reactions || []).reduce((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ position: 'relative', marginTop: 2 }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {Object.entries(grouped).map(([emoji, count]) => {
          const active = reactions?.some(r => r.reaction === emoji && String(r.user_id) === String(currentUserId));
          return (
            <button key={emoji}
              className={`rx-btn ${active ? 'rx-active' : ''}`}
              onClick={() => onReact(chatId, messageId, emoji)}
              title={emoji}
            >
              {emoji} {count > 1 && <span style={{ fontSize: '.6rem' }}>{count}</span>}
            </button>
          );
        })}
        <button className="rx-add" onClick={() => setShowPicker(!showPicker)} title="Добавить реакцию">+</button>
      </div>
      {showPicker && (
        <div className="rx-picker" ref={ref}>
          {QUICK_REACTIONS.map(e => (
            <button key={e} className="rx-item" onClick={() => { onReact(chatId, messageId, e); setShowPicker(false); }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
};
