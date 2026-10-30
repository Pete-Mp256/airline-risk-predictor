// Inline SVG icons (stroke style, 24x24) and the plane illustration used in page headers.

function Icon({ children, className = 'h-5 w-5', ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function PlaneIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </Icon>
  );
}

export function BellIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  );
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon strokeWidth="2.5" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function AlertIcon(props) {
  return (
    <Icon strokeWidth="2.5" {...props}>
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

// Morning, Afternoon and Night shift icons.
export function ShiftIcon({ type, ...props }) {
  if (type === 'Night') {
    return (
      <Icon {...props}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </Icon>
    );
  }
  if (type === 'Afternoon') {
    return (
      <Icon {...props}>
        <path d="M12 2v4" />
        <path d="m4.9 8.9 1.4 1.4" />
        <path d="m19.1 8.9-1.4 1.4" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="M22 22H2" />
        <path d="M16 18a4 4 0 0 0-8 0" />
      </Icon>
    );
  }
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </Icon>
  );
}

// Side view of an airliner for page headers (decorative).
export function PlaneIllustration({ className = '' }) {
  const windows = Array.from({ length: 17 }, (_, i) => 92 + i * 10);
  return (
    <svg className={className} viewBox="0 0 320 120" aria-hidden="true">
      <defs>
        <linearGradient id="fuselage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      {/* far wing */}
      <path d="M150 50 L112 26 L128 26 L192 50 Z" fill="#c8d9ec" />
      {/* tail fin and stabiliser */}
      <path d="M46 49 L26 10 L46 10 L84 49 Z" fill="#6f9bc8" />
      <path d="M42 64 L16 76 L32 78 L70 66 Z" fill="#a3c0df" />
      {/* fuselage */}
      <path d="M30 60 C30 53 37 48 46 48 L262 48 C281 48 297 56 302 61 C297 66 283 73 264 73 L46 73 C37 73 30 67 30 60 Z"
        fill="url(#fuselage)" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="46" y="64" width="222" height="3" rx="1.5" fill="#6f9bc8" />
      {windows.map((x) => <circle key={x} cx={x} cy="56" r="1.7" fill="#475569" />)}
      <path d="M273 53 L289 57 L286 60 L271 58.5 Z" fill="#334155" />
      {/* near wing and engine */}
      <path d="M138 68 L92 104 L112 104 L204 68 Z" fill="#94a3b8" />
      <rect x="128" y="76" width="40" height="13" rx="6.5" fill="#64748b" />
      <rect x="128" y="76" width="9" height="13" rx="4.5" fill="#334155" />
    </svg>
  );
}
