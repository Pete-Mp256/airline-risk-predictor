// Temporary page for screens built in later issues.
export default function PlaceholderPage({ title, issue }) {
  return (
    <div className="card">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">This page is built in issue #{issue}.</p>
    </div>
  );
}
