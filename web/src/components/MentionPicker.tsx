import { useEffect, useRef, type FC } from 'react';

type Props = {
  query: string;          // текст после @
  participants: { user_id: string; username?: string; displayName?: string }[];
  senderNames: Record<string, string>;
  onPick: (username: string) => void;
  onClose: () => void;
};

export const MentionPicker: FC<Props> = ({ query, participants, senderNames, onPick, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as HTMLElement)) onClose();
    };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [onClose]);

  const filtered = participants
    .map(p => {
      const uid = String((p.user_id as any)?._id ?? p.user_id);
      const name = senderNames[uid] || uid.slice(-6);
      return { uid, name };
    })
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  if (!filtered.length) return null;

  return (
    <div className="mention-picker" ref={ref}>
      {filtered.map(p => (
        <button key={p.uid} type="button" className="mention-item"
          onClick={() => onPick(p.name)}>
          @{p.name}
        </button>
      ))}
    </div>
  );
};
