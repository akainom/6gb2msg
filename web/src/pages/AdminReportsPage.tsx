import { useEffect, useState } from 'react';
import { apiRequest } from '../shared/api';
import { reportsApi } from '../shared/resources';
import type { Message, Report } from '../shared/types';
import { Card, EmptyState, ErrorMessage, Field, PageHeader, submitForm } from '../shared/ui';

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

export function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<'reports' | 'logs'>('reports');
  const [logEvent, setLogEvent] = useState('');
  const [viewMessages, setViewMessages] = useState<Message[] | null>(null);
  const [viewReportInfo, setViewReportInfo] = useState<string>('');
  const [reportFilter, setReportFilter] = useState('');

  const [banModal, setBanModal] = useState<{ user_id: string; report_id?: string; reason?: string } | null>(null);
  const [banDuration, setBanDuration] = useState(DURATION_PRESETS[0].ms);
  const [banReason, setBanReason] = useState('');
  const [banCustomDate, setBanCustomDate] = useState('');

  const filteredReports = reportFilter
    ? reports.filter((r) =>
        [r.reason, r.description, String(r.reported_id)].some((v) =>
          (v ?? '').toLowerCase().includes(reportFilter.toLowerCase()),
        ),
      )
    : reports;

  const loadReports = () => reportsApi.pending().then(setReports).catch(setError);
  const loadLogs = () => apiRequest<SystemLogEntry[]>(`/stats/logs${logEvent ? '?event=' + logEvent : ''}`).then(setLogs).catch(setError);

  useEffect(() => { void loadReports(); void loadLogs(); }, []);

  const openBanModal = (userId: string, reportId?: string, reason?: string) => {
    setBanModal({ user_id: userId, report_id: reportId, reason });
    setBanDuration(DURATION_PRESETS[0].ms);
    setBanReason(reason || '');
    setBanCustomDate('');
  };

  const doBan = async () => {
    if (!banModal) return;
    const unbanDate = banCustomDate || calcUnbanDate(banDuration);
    await reportsApi.ban({ user_id: banModal.user_id, report_id: banModal.report_id, reason: banReason, unbanDate });
    await loadReports();
    setBanModal(null);
  };

  return (
    <>
      <PageHeader title="Администрирование" />
      <div className="modal-tabs" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'reports' ? 'tab active' : 'tab'} onClick={() => setTab('reports')}>Reports</button>
        <button className={tab === 'logs' ? 'tab active' : 'tab'} onClick={() => setTab('logs')}>System Logs</button>
      </div>

      {tab === 'reports' ? (
        <div className="grid two">
          <Card>
            <h3 style={{ marginBottom: '.75rem' }}>Pending reports</h3>
            <input style={{ marginBottom: '.5rem' }} placeholder="Фильтр по тексту..." value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} />
            <ErrorMessage error={error} />
            <div className="list">
              {filteredReports.map((r) => (
                <article key={r._id} className="list-item">
                  <span className="title">{r.reason}</span>
                  <span className="secondary">id: {String(r.reported_id).slice(-8)} · {r.description}</span>
                  {r.message_ids && r.message_ids.length > 0 && (
                    <span className="secondary" style={{ fontSize: '.75rem' }}>📎 {r.message_ids.length} сообщений</span>
                  )}
                  <div style={{ display: 'flex', gap: '.4rem', marginTop: '.25rem' }}>
                    {r.message_ids && r.message_ids.length > 0 && (
                      <button type="button" className="btn-secondary" style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}
                        onClick={async () => {
                          try {
                            const msgs = await apiRequest<Message[]>(`/chats/messages/by-ids?ids=${r.message_ids!.join(',')}`);
                            setViewMessages(msgs);
                            setViewReportInfo(`${r.reason} · id: ${String(r.reported_id).slice(-8)}`);
                          } catch { /* ignore */ }
                        }}>View</button>
                    )}
                    <button type="button" style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}
                      onClick={() => openBanModal(String(r.reported_id), r._id, r.reason)}>Ban</button>
                    <button type="button" className="btn-secondary" onClick={() => void reportsApi.dismiss(r._id).then(loadReports)} style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}>Dismiss</button>
                  </div>
                </article>
              ))}
              {!reports.length && <EmptyState title="Нет pending reports" />}
            </div>
          </Card>

          <Card>
            <h3 style={{ marginBottom: '.75rem' }}>Manual moderation</h3>
            <form onSubmit={submitForm(async (form) => {
              openBanModal(String(form.get('user_id')));
            })}>
              <Field label="User id"><input name="user_id" required /></Field>
              <button>Ban user</button>
            </form>
            <form className="mini-form" style={{ marginTop: '.75rem' }} onSubmit={submitForm(async (form) => { await reportsApi.unban(String(form.get('user_id'))); await loadReports(); })}>
              <input name="user_id" placeholder="user id" required />
              <button className="btn-secondary">Unban</button>
            </form>
          </Card>
        </div>
      ) : (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
            <h3>System Logs</h3>
            <input placeholder="Фильтр по событию" value={logEvent} onChange={(e) => setLogEvent(e.target.value)} style={{ maxWidth: 200 }} />
            <button onClick={loadLogs} className="btn-secondary">Обновить</button>
          </div>
          <div className="list">
            {logs.map((entry) => (
              <article key={entry._id} className="list-item log-entry">
                <div><span className={`event-tag ${entry.event.startsWith('report') ? 'danger' : ''}`}>{entry.event}</span></div>
                <span className="secondary">{new Date(entry.createdAt).toLocaleString()} · user: {String(entry.userId ?? 'system')} · ip: {entry.ip ?? '-'}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{JSON.stringify(entry.details)}</span>
              </article>
            ))}
            {!logs.length && <EmptyState title="No logs yet" />}
          </div>
        </Card>
      )}

      {viewMessages && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setViewMessages(null); setViewReportInfo(''); } }}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Сообщения жалобы</h3>
              <button type="button" className="btn-ghost" onClick={() => { setViewMessages(null); setViewReportInfo(''); }}>✕</button>
            </div>
            <p className="text-secondary">{viewReportInfo}</p>
            <div className="messages" style={{ maxHeight: '50vh', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.5rem' }}>
              {viewMessages.map((msg) => (
                <article key={msg._id} className="message">
                  <div className="message-header">
                    <span className="username">{msg.sender_id ? `user: ${msg.sender_id.slice(-6)}` : 'unknown'}</span>
                    <span className="message-meta">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <div className="message-text">{msg.content || '[вложение]'}</div>
                </article>
              ))}
              {!viewMessages.length && <EmptyState title="Сообщения не найдены" />}
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBanModal(null); }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Ban user</h3>
              <button type="button" className="btn-ghost" onClick={() => setBanModal(null)}>✕</button>
            </div>
            <p className="text-secondary">User: {banModal.user_id.slice(-8)}</p>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '.35rem' }}>Длительность</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '.5rem' }}>
                {DURATION_PRESETS.map((p) => (
                  <button key={p.label} type="button"
                    className={banDuration === p.ms && !banCustomDate ? 'tab active' : 'tab'}
                    onClick={() => { setBanDuration(p.ms); setBanCustomDate(''); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input type="datetime-local" value={banCustomDate}
                onChange={(e) => { setBanCustomDate(e.target.value); setBanDuration(0); }}
                style={{ fontSize: '.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '.35rem' }}>Причина</label>
              <input value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setBanModal(null)}>Отмена</button>
              <button type="button" className="btn-danger" onClick={doBan} disabled={!banReason.trim()}>
                Забанить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
