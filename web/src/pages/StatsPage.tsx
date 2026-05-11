import { useEffect, useState } from 'react';
import { statsApi } from '../shared/resources';
import type { AppStats } from '../shared/types';
import { Card, PageHeader, EmptyState, ErrorMessage } from '../shared/ui';

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU').format(n);
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <span style={{ fontSize: '1.8rem' }}>{icon}</span>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{fmt(value)}</div>
          <span className="text-secondary" style={{ fontSize: '.8rem' }}>{label}</span>
        </div>
      </div>
    </Card>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.get()
      .then(setStats)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><p className="text-secondary">Загрузка статистики...</p></div>;
  if (error) return <div style={{ maxWidth: 520, margin: '0 auto' }}><Card><ErrorMessage error={error} /></Card></div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: '2rem' }}><EmptyState title="Статистика недоступна" /></div>;

  const updated = stats.computed_at ? new Date(stats.computed_at).toLocaleString('ru-RU') : null;

  return (
    <>
      <PageHeader title="Статистика платформы" description={updated ? `Обновлено: ${updated}` : ''} />
      <div className="grid three" style={{ marginBottom: '1.5rem' }}>
        <StatCard icon="👥" value={stats.users.total} label="Всего пользователей" />
        <StatCard icon="🟢" value={stats.users.active_today} label="Активны за 24ч" />
        <StatCard icon="📅" value={stats.users.active_week} label="Активны за неделю" />
      </div>
      <div className="grid three" style={{ marginBottom: '1.5rem' }}>
        <StatCard icon="💬" value={stats.chats.total} label="Всего чатов" />
        <StatCard icon="🔒" value={stats.chats.private} label="Приватных" />
        <StatCard icon="👥" value={stats.chats.group} label="Групповых" />
      </div>
      <div className="grid three">
        <StatCard icon="✉️" value={stats.messages.total} label="Всего сообщений" />
        <StatCard icon="📨" value={stats.messages.last_24h} label="За 24 часа" />
        <StatCard icon="📬" value={stats.messages.last_week} label="За неделю" />
      </div>
    </>
  );
}
