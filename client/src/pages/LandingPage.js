import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BellRing, ClipboardList, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import FlyingPlane from '../components/FlyingPlane';
import { PlaneIcon } from '../components/Icons';
import PredictionResult from '../components/PredictionResult';
import PublicNavbar from '../components/PublicNavbar';
import Reveal from '../components/Reveal';
import StepPlayer from 'components/ui/step-player';

// A real prediction from the system (night shift, Base Maintenance), shown as the example.
const EXAMPLE = {
  risk_level: 'High',
  confidence: 0.922,
  probabilities: { Low: 0.001, Medium: 0.076, High: 0.922 },
  top_factors: [
    { feature: 'severity_score', value: 0.95, effect: 'raises' },
    { feature: 'tool_wear_min', value: 210, effect: 'raises' },
    { feature: 'rotational_speed', value: 1380, effect: 'lowers' },
  ],
  high_threshold: 0.425,
};

const STEPS = [
  {
    title: 'Log the incident',
    text: 'Record it against the shift with the readings you already take: tool wear, temperatures, rotational speed and severity.',
  },
  {
    title: 'Get a risk rating',
    text: 'A model trained on maintenance and incident records rates it Low, Medium or High, with a confidence score, in well under a second.',
  },
  {
    title: 'Hand over with reasons',
    text: 'The handover shows the three readings that drove each rating, so the incoming staff know what to deal with first.',
  },
];

const AUTOMATIONS = [
  { icon: BellRing, title: 'High risk email', text: 'Staff on the shift are emailed the rating and its reasons as soon as a High risk incident is logged.' },
  { icon: ClipboardList, title: 'Handover summary', text: 'When a shift ends, the next person on duty receives its open tasks, incidents and notes.' },
  { icon: Mail, title: 'Task reminders', text: 'Staff are reminded about tasks still open shortly before their shift ends.' },
  { icon: ShieldAlert, title: 'Escalation', text: 'A High risk alert that nobody reads in time is sent on to a supervisor.' },
];

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
];

function SectionHeading({ title, text }) {
  return (
    <Reveal className="mx-auto max-w-xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-5xl dark:text-white">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-lg dark:text-neutral-400">{text}</p>
    </Reveal>
  );
}

function HowItWorks() {
  const [step, setStep] = useState(0);
  // Picking a step by hand restarts the player there (a new key resets its progress bar).
  const [run, setRun] = useState(0);
  const pick = (index) => {
    setStep(index);
    setRun((r) => r + 1);
  };
  return (
    <section id="how" className="scroll-mt-24 px-4 py-24 sm:px-8 sm:py-32">
      <SectionHeading title="How it works" text="Three steps between logging an incident and handing it over." />
      <Reveal delay={0.1} className="mx-auto mt-14 max-w-5xl">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((item, index) => {
            const active = index === step;
            return (
              <li key={item.title}>
                <button type="button" onClick={() => pick(index)} aria-current={active ? 'step' : undefined}
                  className={`bento h-full w-full p-6 text-left transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${active
                    ? 'opacity-100 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)] md:-translate-y-1'
                    : 'opacity-60 hover:opacity-90'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${active
                    ? 'bg-accent-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-neutral-400'}`}>
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-ink dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-neutral-400">{item.text}</p>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 flex justify-center">
          <StepPlayer key={run} steps={STEPS.map((s) => ({ label: s.title }))} value={step} onValueChange={setStep}
            defaultPlaying loop seekable duration={5000} size={40} />
        </div>
      </Reveal>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-24 px-4 pb-24 sm:px-8 sm:pb-32">
      <SectionHeading title="Reasons, not just ratings"
        text="Every rating comes with the readings behind it, and the alerts go out on their own." />

      <div className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-3">
        <Reveal className="bento p-2 lg:col-span-2 lg:row-span-2">
          <figure className="flex h-full flex-col">
            <div className="flex-1 rounded-[1.25rem] bg-[#f4f4f6] p-5 sm:p-7 dark:bg-[#1a1a1a]">
              <p className="text-xs text-slate-500 dark:text-neutral-500">Night shift, Base Maintenance</p>
              <p className="mb-5 mt-0.5 font-semibold text-ink dark:text-white">Hardware fault on a pending task</p>
              <PredictionResult prediction={EXAMPLE} />
            </div>
            <figcaption className="flex items-center justify-between px-4 py-4">
              <span className="font-semibold text-ink dark:text-white">Example prediction</span>
              <span className="text-sm text-slate-500 dark:text-neutral-500">Top 3 reasons, explained</span>
            </figcaption>
          </figure>
        </Reveal>

        {AUTOMATIONS.map(({ icon: Icon, title, text }, i) => (
          <Reveal key={title} delay={0.05 * (i + 1)} className="bento p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700 dark:bg-accent-600/15 dark:text-accent-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-semibold text-ink dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-neutral-400">{text}</p>
          </Reveal>
        ))}

        <Reveal delay={0.25} className="bento bg-accent-600 p-6 text-white ring-0 dark:bg-accent-700">
          <h3 className="text-xl font-semibold">Ready for the next handover?</h3>
          <p className="mt-1.5 text-sm text-white/80">Create a staff account and log your first incident.</p>
          <Link to="/register"
            className="mt-auto inline-flex items-center gap-1.5 self-start pt-6 text-sm font-semibold hover:underline">
            Sign up <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { manager, loading } = useAuth();
  if (!loading && manager) return <Navigate to="/shifts" replace />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white dark:bg-black">
      <PublicNavbar links={NAV_LINKS} />

      <main>
        {/* Hero */}
        <section className="p-2 sm:p-3">
          <div className="panel flex min-h-[calc(100svh-1rem)] flex-col items-center justify-center px-4 pb-20 pt-28 text-center sm:min-h-[calc(100svh-1.5rem)]">
            <PlaneIcon aria-hidden="true" strokeWidth="0.6"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 -rotate-12 text-black/[0.035] dark:text-white/[0.04]" />
            <FlyingPlane top="12%" duration={18} />
            <FlyingPlane top="68%" duration={24} delay={9} size="h-8" className="opacity-60" />

            <Reveal className="relative">
              <span className="eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-600" /> Aircraft maintenance
              </span>
            </Reveal>
            <Reveal delay={0.08} className="relative">
              <h1 className="mt-6 text-[3.25rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink sm:text-8xl lg:text-[8.5rem] dark:text-white">
                Shift Handover
              </h1>
              <h2 className="mt-2 bg-gradient-to-r from-accent-600 via-accent-500 to-accent-700 bg-clip-text pb-2 text-[2.5rem] font-extrabold leading-[1] tracking-[-0.04em] text-transparent sm:text-7xl lg:text-[6rem] dark:from-accent-500 dark:via-accent-400 dark:to-accent-600">
                Risk Prediction
              </h2>
            </Reveal>
            <Reveal delay={0.16} className="relative">
              <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg dark:text-neutral-400">
                Every incident logged at handover is rated Low, Medium or High risk, with the readings
                behind the rating.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link to="/register" className="btn-primary h-12 px-7 text-base">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how" className="btn-secondary h-12 px-7 text-base">See how it works</a>
              </div>
            </Reveal>
          </div>
        </section>

        <HowItWorks />
        <Features />
      </main>

      {/* Footer: giant title over a crimson glow. */}
      <footer className="p-2 sm:p-3">
        <div className="panel overflow-hidden bg-black px-6 pt-16 text-white ring-0 sm:px-10 dark:bg-[#0b0b0b] dark:ring-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-40 left-1/4 h-96 w-[70%] rounded-full bg-accent-600/70 blur-[120px]" />
            <div className="absolute -bottom-24 right-0 h-72 w-1/2 rounded-full bg-accent-500/50 blur-[100px]" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600">
                <PlaneIcon className="h-4 w-4" />
              </span>
              Incident Risk
            </span>
            <nav aria-label="Footer" className="flex gap-6 text-sm text-white/60">
              <a href="#how" className="hover:text-white">How it works</a>
              <a href="#features" className="hover:text-white">Features</a>
              <Link to="/login" className="hover:text-white">Log in</Link>
              <Link to="/register" className="hover:text-white">Sign up</Link>
            </nav>
          </div>
          <p aria-hidden="true"
            className="relative mt-12 select-none whitespace-nowrap text-[17vw] font-extrabold leading-[0.85] tracking-[-0.06em] sm:text-[15vw]">
            Handover
          </p>
          <p className="relative py-6 text-xs text-white/60">
            Incident Risk Predictor · a final-year project at Strathmore University
          </p>
        </div>
      </footer>
    </div>
  );
}
