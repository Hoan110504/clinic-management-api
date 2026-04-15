// Minimal utilities for formatting dates in Vietnam timezone (UTC+7)
export function formatToVietnamISOString(input = null) {
  const d = input ? new Date(input) : new Date();
  const opts = {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const datePart = `${map.year}-${map.month}-${map.day}`;
  const timePart = `${map.hour}:${map.minute}:${map.second}`;
  return `${datePart}T${timePart}+07:00`;
}

export function nowVietnam() {
  return formatToVietnamISOString();
}
