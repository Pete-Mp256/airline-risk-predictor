// Calls the Flask risk model (ml/app.py, POST /predict).

const DEFAULT_URL = 'http://localhost:5001';
const DEFAULT_TIMEOUT_MS = 5000;

class MlServiceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'MlServiceError';
    this.details = details;
  }
}

// features: the 8 model inputs. Resolves to { result, responseMs }; throws MlServiceError.
async function predict(features) {
  const baseUrl = (process.env.ML_SERVICE_URL || DEFAULT_URL).replace(/\/$/, '');
  const timeoutMs = Number(process.env.ML_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  let res;
  try {
    res = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError';
    throw new MlServiceError(
      timedOut
        ? `Risk prediction service did not respond within ${timeoutMs} ms`
        : 'Risk prediction service unavailable'
    );
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.risk_level) {
    throw new MlServiceError(
      `Risk prediction service returned an error (HTTP ${res.status})`,
      body && body.details
    );
  }
  return { result: body, responseMs: Date.now() - started };
}

module.exports = { predict, MlServiceError };
