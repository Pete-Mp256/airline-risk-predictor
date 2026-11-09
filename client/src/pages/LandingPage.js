import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PlaneIllustration } from '../components/Icons';
import Logo from '../components/Logo';
import PredictionResult from '../components/PredictionResult';

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
  {
    title: 'High risk email',
    text: 'Staff on the shift are emailed the rating and its reasons as soon as a High risk incident is logged.',
  },
  {
    title: 'Handover summary',
    text: 'When a shift ends, the next person on duty receives its open tasks, incidents and notes.',
  },
  {
    title: 'Unfinished task reminders',
    text: 'Staff are reminded about tasks still open shortly before their shift ends.',
  },
  {
    title: 'Escalation',
    text: 'A High risk alert that nobody reads in time is sent on to a supervisor.',
  },
];

export default function LandingPage() {
  const { manager, loading } = useAuth();
  if (!loading && manager) return <Navigate to="/shifts" replace />;

  return (
    <div className="min-h-screen bg-white">
      <div className="livery" aria-hidden="true" />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link to="/login" className="btn-secondary">Log in</Link>
          <Link to="/register" className="btn-primary hidden sm:inline-flex">Create account</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-14">
          <div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-6xl"
              style={{ fontStretch: '78%' }}>
              Know which incidents put the next shift at risk.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
              Log maintenance incidents at shift handover. Each one is rated Low, Medium or High risk,
              with the readings that drove the rating, so the incoming shift can act before a problem
              reaches the flight schedule.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary px-6 py-2.5 text-base">Create an account</Link>
              <Link to="/login" className="btn-secondary px-6 py-2.5 text-base">Log in</Link>
            </div>
          </div>

          <div className="relative lg:pt-6">
            <PlaneIllustration className="pointer-events-none absolute -top-20 right-0 hidden h-20 w-auto -rotate-6 drop-shadow-lg sm:block" />
            <figure className="card bg-white shadow-[0_12px_32px_-12px_rgba(31,35,40,0.25)]">
              <figcaption className="mb-4 border-b border-slate-200 pb-3">
                <p className="text-xs text-slate-500">Example prediction, night shift, Base Maintenance</p>
                <p className="mt-0.5 font-semibold text-ink">Hardware fault on a pending task</p>
              </figcaption>
              <PredictionResult prediction={EXAMPLE} />
            </figure>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-[#f3f4f6]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl" style={{ fontStretch: '85%' }}>
              How it works
            </h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-t-2 border-accent-600 pt-4">
                  <p className="text-sm font-semibold text-accent-700">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl" style={{ fontStretch: '85%' }}>
            What happens without anyone asking
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Alerts and handover emails go out on their own, so nothing depends on someone remembering to check.
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {AUTOMATIONS.map((item) => (
              <div key={item.title} className="border-l-2 border-slate-200 pl-4">
                <dt className="font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{item.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:px-8">
          <p>Incident Risk Predictor, a final-year project at Strathmore University.</p>
          <Link to="/login" className="link">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
