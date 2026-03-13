export const MAX_SNAPSHOTS_PER_PAGE = 50;
export const MAX_CHANGE_RECORDS_PER_PAGE = 25;
export const MAX_HTML_BYTES = 512 * 1024; // 512 KB
export const FETCH_TIMEOUT_MS = 15_000; // 15s — must fit within background task budget
export const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const CHECK_INTERVALS = [
  {label: '15 min', value: 15 * 60 * 1000},
  {label: '30 min', value: 30 * 60 * 1000},
  {label: '1 hour', value: 60 * 60 * 1000},
  {label: '2 hours', value: 2 * 60 * 60 * 1000},
  {label: '6 hours', value: 6 * 60 * 60 * 1000},
  {label: '12 hours', value: 12 * 60 * 60 * 1000},
  {label: '24 hours', value: 24 * 60 * 60 * 1000},
];

export const CHANGE_RECORD_LIMITS = [
  {label: '10', value: 10},
  {label: '25', value: 25},
  {label: '50', value: 50},
  {label: '100', value: 100},
  {label: 'Unlimited', value: 0}, // 0 = unlimited (stored as null in DB)
];

/** Look up the human-readable label for a check interval in milliseconds. */
export function getIntervalLabel(ms: number): string {
  const match = CHECK_INTERVALS.find(i => i.value === ms);
  if (match) return match.label;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

// Channel ID was changed from 'page-changes' to 'page-changes-v2' because
// Android notification channels are immutable after creation. The original
// channel was created without sound, causing notifications to be silent.
export const NOTIFICATION_CHANNEL_ID = 'page-changes-v2';
export const NOTIFICATION_CHANNEL_NAME = 'Page Changes';
export const BG_FETCH_TASK_ID = 'com.pagemonitor.background';
