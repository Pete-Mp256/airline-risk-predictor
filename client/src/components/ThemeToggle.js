import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { cn } from 'lib/utils';
import { useTheme } from '../theme/ThemeContext';

// Round sun / moon button that switches between light and dark mode.
export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const reduce = useReducedMotion();
  const dark = theme === 'dark';
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'nav-pill w-11 justify-center px-0 text-slate-700 transition-colors hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-neutral-300 dark:hover:text-white',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? false : { rotate: -90, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotate: 90, scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="grid place-items-center"
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
