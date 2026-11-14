import { cn } from 'lib/utils';
import { PlaneIllustration } from './Icons';

// A plane that flies across its (relatively positioned) parent on a loop, trailing a fading contrail.
// Decorative only: hidden from screen readers and switched off for users who prefer reduced motion.
// `top` places the flight path; `duration` and `delay` are in seconds.
export default function FlyingPlane({ top = '30%', duration = 16, delay = 0, size = 'h-14', className }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 overflow-hidden', className)}
      style={{ top, height: '8rem' }}>
      <div
        className="absolute left-0 top-8 flex items-center animate-fly motion-reduce:hidden"
        style={{ '--fly-duration': `${duration}s`, animationDelay: `${delay}s`, animationFillMode: 'backwards' }}
      >
        <span className="mr-[-6px] h-[3px] w-40 rounded-full bg-gradient-to-r from-transparent via-slate-400/30 to-slate-400/60 dark:via-white/10 dark:to-white/30 sm:w-64" />
        <PlaneIllustration className={cn(size, 'w-auto drop-shadow-[0_10px_14px_rgba(0,0,0,0.18)]')} />
      </div>
    </div>
  );
}
