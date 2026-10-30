import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { UserIcon } from './Icons';

export default function ProfileMenu() {
  const { manager, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)}
        aria-label="Account menu" aria-expanded={open}>
        <UserIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{manager.first_name} {manager.last_name}</p>
            <p className="truncate text-xs text-slate-500">{manager.email}</p>
          </div>
          <button type="button" onClick={logout}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
