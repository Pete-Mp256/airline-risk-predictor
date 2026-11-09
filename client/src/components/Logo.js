import { PlaneIcon } from './Icons';

export default function Logo() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm">
        <PlaneIcon className="h-4 w-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight" style={{ fontStretch: '85%' }}>Incident Risk</span>
    </span>
  );
}
