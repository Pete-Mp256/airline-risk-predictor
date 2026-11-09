import { ChevronsUpDown, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, AvatarFallback } from 'components/ui/avatar';
import { Button } from 'components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'components/ui/dropdown-menu';

function initials(manager) {
  return `${manager.first_name?.[0] ?? ''}${manager.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}

// variant "full": avatar, name and email (sidebar). Default: avatar only (mobile top bar).
export default function ProfileMenu({ variant = 'compact' }) {
  const { manager, logout } = useAuth();
  const name = `${manager.first_name} ${manager.last_name}`;

  const trigger =
    variant === 'full' ? (
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-slate-100"
      >
        <Avatar><AvatarFallback>{initials(manager)}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs text-slate-500">{manager.email}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    ) : (
      <Button variant="ghost" size="icon" className="rounded-full p-0" aria-label="Account menu">
        <Avatar className="h-8 w-8"><AvatarFallback>{initials(manager)}</AvatarFallback></Avatar>
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === 'full' ? 'start' : 'end'}
        side={variant === 'full' ? 'top' : 'bottom'}
        className="w-60"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
            <Mail className="h-3 w-3" />{manager.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-accent-700 focus:bg-accent-50 focus:text-accent-800 [&_svg]:text-accent-600">
          <LogOut />Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
