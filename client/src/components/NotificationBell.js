import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { BellIcon } from './Icons';

const POLL_MS = 30000;

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
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

  // Close the panel on an outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

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
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="icon-btn"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
          <p className="section-title border-b border-slate-100 px-4 py-3">Notifications</p>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.notification_id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${n.is_read ? 'text-slate-500' : 'bg-red-50/60 text-slate-800'}`}
                  >
                    <span className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
                      <span>
                        {n.message}
                        <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
