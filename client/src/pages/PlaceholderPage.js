import PageHeader from '../components/PageHeader';

// Temporary page for screens built in later issues.
export default function PlaceholderPage({ title, issue }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div className="card">
        <p className="text-sm text-slate-500">This page is built in issue #{issue}.</p>
      </div>
    </div>
  );
}
