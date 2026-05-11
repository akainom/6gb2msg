import { useEffect, useState } from 'react';
import { reportsApi } from '../shared/resources';
import type { Report, ReportReason } from '../shared/types';
import { Card, EmptyState, ErrorMessage, Field, PageHeader, submitForm } from '../shared/ui';

const reasons: ReportReason[] = ['spam', 'harassment', 'inappropriate_content', 'other'];

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<unknown>(null);
  const load = () => reportsApi.listMine().then(setReports).catch(setError);
  useEffect(() => { void load(); }, []);

  return (
    <>
      <PageHeader title="Жалобы" />
      <div className="grid two">
        <Card>
          <h3 style={{ marginBottom: '.75rem' }}>Новая жалоба</h3>
          <form onSubmit={submitForm(async (form, _event) => {
            setError(null);
            try {
              await reportsApi.create({
                reported_id: String(form.get('reported_id')),
                reason: String(form.get('reason')) as ReportReason,
                description: String(form.get('description') ?? ''),
                message_ids: String(form.get('message_ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
              });
              await load();
            } catch (e) { setError(e); }
          })}>
            <Field label="Reported user id"><input name="reported_id" required /></Field>
            <Field label="Reason">
              <select name="reason">{reasons.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            </Field>
            <Field label="Message ids" hint="Через запятую"><input name="message_ids" /></Field>
            <Field label="Description"><textarea name="description" rows={3} maxLength={500} /></Field>
            <ErrorMessage error={error} />
            <button>Отправить</button>
          </form>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '.75rem' }}>Мои жалобы</h3>
          <div className="list">
            {reports.map((r) => (
              <article key={r._id} className="list-item">
                <span className="title">{r.reason}</span>
                <span className="secondary">{r.status} · {r.description || '—'}</span>
                <button type="button" className="btn-secondary" style={{ marginTop: '.25rem', fontSize: '.8rem', padding: '.25rem .5rem' }} onClick={() => { if (confirm('Удалить жалобу?')) void reportsApi.delete(r._id).then(load); }}>Удалить</button>
              </article>
            ))}
            {!reports.length && <EmptyState title="Жалоб нет" />}
          </div>
        </Card>
      </div>
    </>
  );
}
