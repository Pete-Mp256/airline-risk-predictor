import { useState } from 'react';
import api, { apiError } from '../api';

// Shown when an incident has no prediction (the model service was down).
export default function RetryPrediction({ incidentId, reason, canRetry, onPredicted }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  async function retry() {
    setRetrying(true);
    setError('');
    try {
      const res = await api.post(`/incidents/${incidentId}/predict`);
      window.dispatchEvent(new Event('notifications:refresh'));
      onPredicted(res.data.prediction);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      <p className="font-medium">The incident was saved, but it has no risk prediction yet.</p>
      <p className="mt-1">{error || reason || 'The risk prediction service could not be reached.'}</p>
      {canRetry && (
        <button type="button" className="btn-secondary mt-3 px-3 py-1.5" onClick={retry} disabled={retrying}>
          {retrying ? 'Predicting…' : 'Retry prediction'}
        </button>
      )}
    </div>
  );
}
