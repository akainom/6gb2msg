import { useEffect, useState } from 'react';
import { apiRequest } from '../shared/api';
import { filesApi, profilesApi, reportsApi } from '../shared/resources';
import type { Message, Profile, Report, ReportReason } from '../shared/types';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Спам' },
  { key: 'harassment', label: 'Оскорбление' },
  { key: 'inappropriate_content', label: 'Недопустимый контент' },
  { key: 'other', label: 'Другое' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ На рассмотрении',
  resolved: '✅ Решено',
  dismissed: '❌ Отклонено',
};

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMessages, setViewMessages] = useState<Message[] | null>(null);
  const [viewReportInfo, setViewReportInfo] = useState('');
  const [senderProfiles, setSenderProfiles] = useState<Record<string, Profile>>({});
  const [reportedProfiles, setReportedProfiles] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    reportsApi.listMine().then(rpts => {
      setReports(rpts);
      // fetch names for reported users
      const ids = [...new Set(rpts.map(r => String(r.reported_id)))];
      ids.forEach(id => {
        profilesApi.getByUser(id).then(p => {
          setReportedProfiles(c => ({ ...c, [id]: p.displayName || p.username || id.slice(-6) }));
        }).catch(() => {});
      });
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toast_ = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const showMessages = async (report: Report) => {
    if (!report.message_ids?.length) return;
    try {
      const msgs = await apiRequest<Message[]>(`/chats/messages/by-ids?ids=${report.message_ids.join(',')}`);
      setViewMessages(msgs);
      setViewReportInfo(`${REASONS.find(x => x.key === report.reason)?.label || report.reason} · ${report.description || ''}`);
      // fetch sender profiles
      const senderIds = [...new Set(msgs.map(m => String(m.sender_id)))];
      const profiles: Record<string, Profile> = {};
      await Promise.all(senderIds.map(async id => {
        try { profiles[id] = await profilesApi.getByUser(id); } catch {}
      }));
      setSenderProfiles(profiles);
    } catch { toast_('Не удалось загрузить сообщения'); }
  };

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 60, right: 20, zIndex: 400, color: '#fff',
          padding: '.5rem 1rem', borderRadius: 'var(--radius)', fontSize: '.85rem', fontWeight: 600,
          boxShadow: 'var(--shadow-md)', background: 'var(--ok)',
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem' }}>Мои жалобы</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
          Отправленные через кнопку «Пожаловаться» в чате или профиле
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Загрузка…</p>
        ) : reports.length === 0 ? (
          <div className="empty">
            <strong>Жалоб пока нет</strong>
            <span>Чтобы пожаловаться, нажмите ⋮ на сообщении и выберите «Пожаловаться»</span>
          </div>
        ) : (
          <div className="list">
            {reports.map(r => (
              <div key={r._id} className="list-item" style={{ cursor: 'default', height: 'auto', padding: '.6rem .65rem', display: 'grid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '.82rem' }}>
                    {REASONS.find(x => x.key === r.reason)?.label || r.reason}
                  </span>
                  <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {STATUS_LABELS[r.status ?? 'pending'] || r.status}
                  </span>
                </div>
                {r.description && (
                  <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: '.15rem' }}>{r.description}</p>
                )}
                <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '.15rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                  <span>👤 {reportedProfiles[String(r.reported_id)] || '…'}</span>
                  {r.message_ids?.length ? <span>📎 {r.message_ids.length} сообщ.</span> : null}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.35rem', gap: '.35rem' }}>
                  <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '.3rem' }}>
                    {r.message_ids && r.message_ids.length > 0 && (
                      <button type="button" style={{ fontSize: '.72rem', padding: '.2rem .5rem' }}
                        onClick={() => showMessages(r)}>Просмотр</button>
                    )}
                    <button type="button" className="btn-ghost" style={{ fontSize: '.75rem', color: 'var(--danger)' }}
                      onClick={() => { if (confirm('Удалить жалобу?')) { reportsApi.delete(r._id).then(() => { toast_('Удалено'); load(); }); } }}>
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewMessages && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setViewMessages(null); setViewReportInfo(''); } }}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Сообщения жалобы</h3>
              <button type="button" className="btn-ghost" onClick={() => { setViewMessages(null); setViewReportInfo(''); }}>✕</button>
            </div>
            <p className="text-secondary">{viewReportInfo}</p>
            <div className="messages" style={{ maxHeight: '50vh', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '.5rem' }}>
              {viewMessages.map((msg) => {
                const sender = senderProfiles[String(msg.sender_id)];
                const name = sender?.displayName || sender?.username || String(msg.sender_id).slice(-6);
                const initial = name[0].toUpperCase();
                return (
                  <article key={msg._id} className="message">
                    <div className="message-header">
                      {sender?._id ? (
                        <img className="avatar" src={`${filesApi.avatarUrl(sender._id)}?v=0`} alt="" style={{ width: 20, height: 20, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div className="avatar" style={{ width: 20, height: 20, fontSize: '.55rem', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{initial}</div>
                      )}
                      <span className="username">{name}</span>
                      <div className="spacer" />
                      <span className="message-meta">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <div className="message-text">{msg.content || '[вложение]'}</div>
                  </article>
                );
              })}
              {!viewMessages.length && (
                <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Сообщения не найдены</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
