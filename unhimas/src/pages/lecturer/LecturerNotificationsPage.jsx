import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdNotifications, MdDoneAll, MdMarkEmailRead, MdCampaign } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import BrowserPushControl from '../../components/layout/BrowserPushControl';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/lecturerService';

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_ICONS = {
  announcement: <MdCampaign />,
  marks_returned: '📋',
  marks_approved: '✅',
  course_assigned: '📚',
  timetable_change: '📅',
  general: '🔔',
};

export default function LecturerNotificationsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');

  const profileId = profile?.id;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['my-notifications', profileId],
    queryFn: () => getMyNotifications(profileId, { limit: 100 }),
    enabled: !!profileId,
  });

  const readMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries(['my-notifications', profileId]);
      qc.invalidateQueries({ queryKey: ['unread-notification-count', profileId] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(profileId),
    onSuccess: () => {
      qc.invalidateQueries(['my-notifications', profileId]);
      qc.invalidateQueries({ queryKey: ['unread-notification-count', profileId] });
      showToast('All notifications marked as read', 'success');
    },
  });

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppLayout pageTitle="Notifications">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="page-header-actions">
          <BrowserPushControl />
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >All</button>
          <button
            className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('unread')}
          >Unread {unreadCount > 0 && <span className="badge badge-red" style={{ marginLeft: 4 }}>{unreadCount}</span>}</button>
          {unreadCount > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              <MdDoneAll /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: 6 }} />
                <div className="skeleton skeleton-text" style={{ width: '50%' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MdNotifications /></div>
            <div className="empty-state-title">{filter === 'unread' ? 'No unread notifications' : 'No notifications'}</div>
            <p className="empty-state-text">You're all caught up!</p>
          </div>
        ) : (
          <div>
            {filtered.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.is_read ? 'transparent' : 'rgba(183,0,50,0.03)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                  {TYPE_ICONS[n.notification_type] || TYPE_ICONS.general}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                    <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      {n.title}
                    </span>
                    {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-secondary)', flexShrink: 0, display: 'inline-block' }} />}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {fmtDate(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => readMutation.mutate(n.id)}
                    aria-label="Mark as read"
                    style={{ flexShrink: 0 }}
                  >
                    <MdMarkEmailRead />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
