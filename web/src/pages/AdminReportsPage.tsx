import { useEffect, useState } from 'react';
import { apiRequest } from '../shared/api';
import { reportsApi } from '../shared/resources';
import type { Message, Report } from '../shared/types';

type SystemLogEntry = { _id: string; event: string; userId: string | null; details: Record<string, unknown>; ip: string | null; createdAt: string };

const DURATION_PRESETS = [
  { label: '1 день', ms: 24 * 60 * 60 * 1000 },
  { label: '3 дня', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 дней', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 дней', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'Навсегда', ms: 365 * 24 * 60 * 60 * 1000 },
];

function calcUnbanDate(ms: number) {
  return new Date(Date.now() + ms).toISOString().slice(0, 16);
}

function ReportsTab({ reports, reportFilter, setReportFilter, loadReports, openBanModal, onViewMessages, showToast }: {
  reports: Report[];
  reportFilter: string;
  setReportFilter: (v: string) => void;
  loadReports: () => void;
  openBanModal: (userId: string, reportId?: string, reason?: string) => void;
  onViewMessages: (r: Report) => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const filtered = reportFilter
    ? reports.filter(r => [r.reason, r.description, String(r.reported_id)].some(v => (v ?? '').toLowerCase().includes(reportFilter.toLowerCase())))
    : reports;

  return (
    <div className="grid two">
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: '.5rem' }}>Новые жалобы</div>
        <input style={{ marginBottom: '.5rem', fontSize: '.82rem' }} placeholder="Фильтр по тексту..." value={reportFilter} onChange={e => setReportFilter(e.target.value)} />
        <div className="list">
          {filtered.map(r => (
            <div key={r._id} className="list-item" style={{ cursor: 'default', height: 'auto', padding: '.55rem .65rem', display: 'grid', gap: '.15rem', overflow: 'visible' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{r.reason}</span>
                <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>ID: {String(r.reported_id).slice(-8)}</span>
              </div>
              {r.description && <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{r.description}</p>}
              {r.message_ids && r.message_ids.length > 0 && (
                <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>📎 {r.message_ids.length} сообщ.</span>
              )}
              <div style={{ display: 'flex', gap: '.35rem', marginTop: '.2rem' }}>
                {r.message_ids && r.message_ids.length > 0 && (
                  <button type="button" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
                    onClick={() => onViewMessages(r)}>Просмотр</button>
                )}
                <button type="button" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
                  onClick={() => openBanModal(String(r.reported_id), r._id, r.reason)}>Бан</button>
                <button type="button" className="btn-secondary" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
                  onClick={async () => { try { await reportsApi.dismiss(r._id); showToast('Жалоба отклонена'); loadReports(); } catch { showToast('Ошибка', false); } }}>Отклонить</button>
              </div>
            </div>
          ))}
          {!reports.length && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Нет новых жалоб</p>}
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: '.5rem' }}>Ручная модерация</div>
        <div style={{ display: 'grid', gap: '.75rem' }}>
          <form onSubmit={e => { e.preventDefault(); openBanModal(String(new FormData(e.currentTarget).get('user_id'))); }}
            style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: '.25rem', flex: 1 }}>
              <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ID пользователя</label>
              <input name="user_id" required style={{ fontSize: '.82rem' }} />
            </div>
            <button type="submit" className="btn-danger" style={{ padding: '.45rem 1rem', flexShrink: 0 }}>Забанить</button>
          </form>
        <form onSubmit={async e => {
          e.preventDefault();
          try {
            await reportsApi.unban(String(new FormData(e.currentTarget).get('user_id')));
            showToast('Пользователь разбанен');
            await loadReports();
          } catch (e: any) { showToast(e?.message || 'Ошибка разбана', false); }
        }} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: '.25rem', flex: 1 }}>
              <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ID пользователя</label>
              <input name="user_id" required style={{ fontSize: '.82rem' }} />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: '.45rem 1rem', flexShrink: 0 }}>Разбанить</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function LogsTab({ logs, logEvent, setLogEvent, loadLogs }: {
  logs: SystemLogEntry[];
  logEvent: string;
  setLogEvent: (v: string) => void;
  loadLogs: () => void;
}) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
        <h3 className="eyebrow" style={{ margin: 0 }}>Системные логи</h3>
        <input placeholder="Фильтр по событию" value={logEvent} onChange={e => setLogEvent(e.target.value)}
          style={{ maxWidth: 200, fontSize: '.82rem' }} />
        <button onClick={loadLogs} className="btn-secondary" type="button">Обновить</button>
      </div>
      <div className="list">
        {logs.map(entry => (
          <div key={entry._id} className="list-item" style={{ cursor: 'default', height: 'auto', padding: '.5rem .65rem', display: 'grid', gap: '.15rem', overflow: 'visible' }}>
            <div>
              <span className="event-tag" style={{
                background: entry.event.startsWith('report') ? 'var(--danger-light)' : 'var(--accent-light)',
                color: entry.event.startsWith('report') ? 'var(--danger)' : 'var(--accent)',
              }}>{entry.event}</span>
            </div>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
              {new Date(entry.createdAt).toLocaleString()} · user: {String(entry.userId ?? 'система')} · ip: {entry.ip ?? '-'}
            </span>
            <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
              {Object.entries(entry.details || {}).map(([k, v]) =>
                `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
              ).join(' · ')}
            </span>
          </div>
        ))}
        {!logs.length && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Логов пока нет</p>}
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [tab, setTab] = useState<'reports' | 'logs'>('reports');
  const [logEvent, setLogEvent] = useState('');
  const [viewMessages, setViewMessages] = useState<Message[] | null>(null);
  const [viewReportInfo, setViewReportInfo] = useState('');
  const [reportFilter, setReportFilter] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const [toastOk, setToastOk] = useState(true);
  const showToast = (msg: string, ok = true) => { setToast(msg); setToastOk(ok); setTimeout(() => setToast(null), 3000); };

  const [banModal, setBanModal] = useState<{ user_id: string; report_id?: string; reason?: string } | null>(null);
  const [banDuration, setBanDuration] = useState(DURATION_PRESETS[0].ms);
  const [banReason, setBanReason] = useState('');
  const [banCustomDate, setBanCustomDate] = useState('');

  const loadReports = () => reportsApi.pending().then(setReports).catch(() => {});
  const loadLogs = () => apiRequest<SystemLogEntry[]>(`/stats/logs${logEvent ? '?event=' + logEvent : ''}`).then(setLogs).catch(() => {});

  useEffect(() => { loadReports(); loadLogs(); }, []);

  const openBanModal = (userId: string, reportId?: string, reason?: string) => {
    setBanModal({ user_id: userId, report_id: reportId, reason });
    setBanDuration(DURATION_PRESETS[0].ms);
    setBanReason(reason || '');
    setBanCustomDate('');
  };

  const doBan = async () => {
    if (!banModal) return;
    try {
      const unbanDate = banCustomDate || calcUnbanDate(banDuration);
      await reportsApi.ban({ user_id: banModal.user_id, report_id: banModal.report_id, reason: banReason, unbanDate });
      showToast('Пользователь забанен');
      await loadReports();
      setBanModal(null);
    } catch (e: any) { showToast(e?.message || 'Ошибка бана', false); }
  };

  const handleViewMessages = async (r: Report) => {
    if (!r.message_ids?.length) return;
    try {
      const msgs = await apiRequest<Message[]>(`/chats/messages/by-ids?ids=${r.message_ids.join(',')}`);
      setViewMessages(msgs);
      setViewReportInfo(`${r.reason} · id: ${String(r.reported_id).slice(-8)}`);
    } catch (e) { showToast('Ошибка загрузки сообщений', false); }
  };

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 60, right: 20, zIndex: 400, color: '#fff',
          padding: '.5rem 1rem', borderRadius: 'var(--radius)', fontSize: '.85rem', fontWeight: 600,
          boxShadow: 'var(--shadow-md)', background: toastOk ? 'var(--ok)' : 'var(--danger)',
        }}>{toast}</div>
      )}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Администрирование</h2>
      </div>

      <div className="modal-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab${tab === 'reports' ? ' active' : ''}`}
          onClick={() => setTab('reports')} type="button">Жалобы</button>
        <button className={`tab${tab === 'logs' ? ' active' : ''}`}
          onClick={() => setTab('logs')} type="button">Системные логи</button>
      </div>

      {tab === 'reports' && (
        <ReportsTab reports={reports} reportFilter={reportFilter} setReportFilter={setReportFilter}
          loadReports={loadReports} openBanModal={openBanModal} onViewMessages={handleViewMessages} showToast={showToast} />
      )}

      {tab === 'logs' && (
        <LogsTab logs={logs} logEvent={logEvent} setLogEvent={setLogEvent} loadLogs={loadLogs} />
      )}

      {viewMessages && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setViewMessages(null); setViewReportInfo(''); } }}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Сообщения жалобы</h3>
              <button type="button" className="btn-ghost" onClick={() => { setViewMessages(null); setViewReportInfo(''); }}>✕</button>
            </div>
            <p className="text-secondary">{viewReportInfo}</p>
            <div className="messages" style={{ maxHeight: '50vh', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '.5rem' }}>
              {viewMessages.map(msg => (
                <article key={msg._id} className="message">
                  <div className="message-header">
                    <span className="username">ID: {String(msg.sender_id || '').slice(-6)}</span>
                    <div className="spacer" />
                    <span className="message-meta">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <div className="message-text">{msg.content || '[вложение]'}</div>
                </article>
              ))}
              {!viewMessages.length && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Сообщения не найдены</p>}
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBanModal(null); }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Забанить пользователя</h3>
              <button type="button" className="btn-ghost" onClick={() => setBanModal(null)}>✕</button>
            </div>
            <p className="text-secondary">User: {banModal.user_id.slice(-8)}</p>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Длительность</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', marginBottom: '.25rem' }}>
                {DURATION_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    className={`tab${banDuration === p.ms && !banCustomDate ? ' active' : ''}`}
                    onClick={() => { setBanDuration(p.ms); setBanCustomDate(''); }}>{p.label}</button>
                ))}
              </div>
              <input type="datetime-local" value={banCustomDate}
                onChange={e => { setBanCustomDate(e.target.value); setBanDuration(0); }}
                style={{ fontSize: '.82rem' }} />
            </div>
            <div style={{ display: 'grid', gap: '.25rem' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Причина</label>
              <input value={banReason} onChange={e => setBanReason(e.target.value)} style={{ fontSize: '.82rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setBanModal(null)}>Отмена</button>
              <button type="button" className="btn-danger" onClick={doBan} disabled={!banReason.trim()}>Забанить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
