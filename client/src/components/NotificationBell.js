import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, BellOff, ClipboardList } from 'lucide-react';
import api from '../api';
import { cn } from 'lib/utils';
import { Button } from 'components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover';

const POLL_MS = 30000;

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

// High risk alerts link to an incident; task reminders link to a shift.
function NotificationIcon({ n }) {
  if (n.incident_id) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-risk-high-tint text-risk-high">
        <AlertTriangle className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <ClipboardList className="h-4 w-4" />
    </span>
  );
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get('/notifications')
      .then((res) => {
        setNotifications(res.data.notifications);
        setUnread(res.data.unread_count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    window.addEventListener('notifications:refresh', load);
    return () => {
      clearInterval(id);
      window.removeEventListener('notifications:refresh', load);
    };
  }, [load]);

  async function openNotification(n) {
    if (!n.is_read) {
      try {
        await api.patch(`/notifications/${n.notification_id}/read`);
      } catch {
        // Still navigate; the next poll refreshes the state.
      }
      load();
    }
    setOpen(false);
    if (n.incident_id) navigate(`/incidents/${n.incident_id}`);
    else if (n.shift_id) navigate(`/shifts/${n.shift_id}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={`Notifications, ${unread} unread`}>
          <Bell className="!size-5 text-slate-600" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          {unread > 0 && (
            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">{unread} unread</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">You're all caught up</p>
            <p className="text-xs text-slate-400">High risk alerts and task reminders appear here.</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.notification_id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                    !n.is_read && 'bg-accent-50/40'
                  )}
                >
                  <NotificationIcon n={n} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block', n.is_read ? 'text-slate-500' : 'font-medium text-ink')}>{n.message}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-600" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
