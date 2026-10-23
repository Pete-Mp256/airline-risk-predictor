// Display helpers for dates and times from the API (ISO strings).

// value: 'YYYY-MM-DD' (shift_date). Parsed as a local date so it never shifts by a day.
export function formatDate(value) {
  if (!value) return '';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

export function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
}

// Value for <input type="datetime-local"> in the browser's time zone.
export function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// <input type="datetime-local"> value -> ISO string with the time zone, as the API expects.
export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

export function todayISODate() {
  return toLocalInput(new Date()).slice(0, 10);
}
