import BackgroundFetch from 'react-native-background-fetch';
import {AppState, type NativeEventSubscription} from 'react-native';
import {Q} from '@nozbe/watermelondb';
import {getDatabase} from '../database';
import {MonitoredPage} from '../database/models/MonitoredPage';
import {Snapshot} from '../database/models/Snapshot';
import {ChangeRecord} from '../database/models/ChangeRecord';
import {PageFetcher} from './PageFetcher';
import {HtmlParser} from './HtmlParser';
import {DiffEngine} from './DiffEngine';
import {NotificationService} from './NotificationService';
import {useSettings} from '../store/useSettings';
import {BG_FETCH_TASK_ID} from '../utils/constants';

// Tolerance for background "due" check: check pages that will be due within
// this window, since the next BackgroundFetch may be 15+ minutes away.
// With 15-min fetch interval + 15-min page interval, a 10-min tolerance
// ensures the page is always caught on the first BackgroundFetch after becoming due.
const BG_DUE_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes

// Safety cutoff for background task: stop processing pages when elapsed time
// approaches the Android-imposed ~60 second limit for background tasks.
const BG_TIME_BUDGET_MS = 50_000; // 50 seconds

// --- Simple string hash (Hermes compatible, no crypto.subtle) ---
function simpleHash(text: string): string {
  // FNV-1a 64-bit approximation using two 32-bit halves
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = (h1 * 16777619) >>> 0;
    h2 ^= c ^ (i & 0xff);
    h2 = (h2 * 16777259) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// --- Snapshot cleanup ---
async function pruneOldSnapshots(pageId: string): Promise<void> {
  try {
    const db = getDatabase();
    const maxSnapshots = useSettings.maxSnapshotsPerPage;

    const allSnapshots = await db
      .get<Snapshot>('snapshots')
      .query(Q.where('page_id', pageId), Q.sortBy('fetched_at', Q.desc))
      .fetch();

    if (allSnapshots.length <= maxSnapshots) {
      return;
    }

    // Get IDs referenced by change_records to preserve them
    const changeRecords = await db
      .get<ChangeRecord>('change_records')
      .query(Q.where('page_id', pageId))
      .fetch();

    const referencedIds = new Set<string>();
    for (const record of changeRecords) {
      referencedIds.add(record.oldSnapshotId);
      referencedIds.add(record.newSnapshotId);
    }

    // Delete oldest snapshots that are not referenced
    const toDelete = allSnapshots
      .slice(maxSnapshots)
      .filter(s => !referencedIds.has(s.id));

    if (toDelete.length > 0) {
      await db.write(async () => {
        for (const snapshot of toDelete) {
          await snapshot.destroyPermanently();
        }
      });
    }
  } catch (err) {
    console.warn('[BackgroundMonitor] pruneOldSnapshots error:', err);
  }
}

// --- Change record cleanup ---
async function pruneOldChangeRecords(pageId: string, maxRecords: number | null): Promise<void> {
  try {
    if (!maxRecords) return; // null or 0 = unlimited

    const db = getDatabase();
    const allRecords = await db
      .get<ChangeRecord>('change_records')
      .query(Q.where('page_id', pageId), Q.sortBy('detected_at', Q.desc))
      .fetch();

    if (allRecords.length <= maxRecords) return;

    const toDelete = allRecords.slice(maxRecords);

    // Collect snapshot IDs referenced by records we're keeping
    const keptRecords = allRecords.slice(0, maxRecords);
    const keptSnapshotIds = new Set<string>();
    for (const r of keptRecords) {
      keptSnapshotIds.add(r.oldSnapshotId);
      keptSnapshotIds.add(r.newSnapshotId);
    }

    // Collect orphaned snapshot IDs (referenced only by deleted records)
    const orphanSnapshotIds = new Set<string>();
    for (const r of toDelete) {
      if (!keptSnapshotIds.has(r.oldSnapshotId)) orphanSnapshotIds.add(r.oldSnapshotId);
      if (!keptSnapshotIds.has(r.newSnapshotId)) orphanSnapshotIds.add(r.newSnapshotId);
    }

    await db.write(async () => {
      for (const record of toDelete) {
        await record.destroyPermanently();
      }
      // Delete orphaned snapshots
      for (const snapshotId of orphanSnapshotIds) {
        try {
          const snapshot = await db.get<Snapshot>('snapshots').find(snapshotId);
          await snapshot.destroyPermanently();
        } catch {
          // Snapshot already deleted or not found
        }
      }
    });
  } catch (err) {
    console.warn('[BackgroundMonitor] pruneOldChangeRecords error:', err);
  }
}

export type CheckResult = {
  status: 'changed' | 'unchanged' | 'first_snapshot' | 'error';
  summary?: string;
  error?: string;
};

// --- Core page check logic ---
export async function checkPage(pageId: string): Promise<CheckResult> {
  const db = getDatabase();

  const pages = await db
    .get<MonitoredPage>('monitored_pages')
    .query(Q.where('id', pageId))
    .fetch();

  if (pages.length === 0) {
    return {status: 'error', error: 'Page not found'};
  }
  const page = pages[0];
  const now = Date.now();

  try {
    // 1. Fetch HTML
    console.log('[BackgroundMonitor] Fetching:', page.url);
    const html = await PageFetcher.fetch(page.url);
    console.log('[BackgroundMonitor] Fetched', html.length, 'chars');

    // 2. Hash for quick comparison
    const newHash = simpleHash(html);
    console.log('[BackgroundMonitor] Hash:', newHash);

    // 3. Get latest snapshot
    const latestSnapshots = await db
      .get<Snapshot>('snapshots')
      .query(Q.where('page_id', pageId), Q.sortBy('fetched_at', Q.desc), Q.take(1))
      .fetch();
    const previousSnapshot = latestSnapshots[0] ?? null;
    console.log(
      '[BackgroundMonitor] Previous snapshot:',
      previousSnapshot ? `hash=${previousSnapshot.rawHtmlHash}` : 'none',
    );

    // 4. Hash match: no change
    if (previousSnapshot && previousSnapshot.rawHtmlHash === newHash) {
      console.log('[BackgroundMonitor] Hash unchanged, skipping parse');
      await db.write(async () => {
        await page.update(p => {
          p.lastCheckedAt = now;
          p.lastStatus = 'ok';
          p.lastError = null;
        });
      });
      return {status: 'unchanged'};
    }

    // 5. Parse HTML
    const {textContent, links} = HtmlParser.parse(html);
    console.log(
      '[BackgroundMonitor] Parsed:',
      textContent.length,
      'chars text,',
      links.length,
      'links',
    );

    // 6. Save new snapshot
    let newSnapshot!: Snapshot;
    await db.write(async () => {
      newSnapshot = await db.get<Snapshot>('snapshots').create(s => {
        s.pageId = pageId;
        s.textContent = textContent;
        s.linksJson = JSON.stringify(links);
        s.rawHtmlHash = newHash;
        s.fetchedAt = now;
        s.contentLength = html.length;
      });
    });
    console.log('[BackgroundMonitor] Snapshot saved:', newSnapshot.id);

    // 7. Diff against previous snapshot
    if (previousSnapshot) {
      const oldLinks: Array<{href: string; text: string}> = JSON.parse(
        previousSnapshot.linksJson || '[]',
      );
      const textDiff = DiffEngine.computeTextDiff(
        previousSnapshot.textContent,
        textContent,
      );
      const {added: linksAdded, removed: linksRemoved} =
        DiffEngine.computeLinkDiff(oldLinks, links);

      const hasChanges = DiffEngine.hasSignificantChanges(
        textDiff,
        linksAdded,
        linksRemoved,
      );

      console.log(
        '[BackgroundMonitor] Diff:',
        `+${textDiff.addedLines}/-${textDiff.removedLines} lines,`,
        `+${linksAdded.length}/-${linksRemoved.length} links,`,
        `significant=${hasChanges}`,
      );

      if (hasChanges) {
        const summary = DiffEngine.generateSummary(
          textDiff,
          linksAdded,
          linksRemoved,
        );

        // 8. Save change record
        let changeRecord: ChangeRecord;
        await db.write(async () => {
          changeRecord = await db.get<ChangeRecord>('change_records').create(c => {
            c.pageId = pageId;
            c.oldSnapshotId = previousSnapshot.id;
            c.newSnapshotId = newSnapshot.id;
            c.textDiffJson = JSON.stringify(textDiff.changes);
            c.linksAddedJson = JSON.stringify(linksAdded);
            c.linksRemovedJson = JSON.stringify(linksRemoved);
            c.changeSummary = summary;
            c.detectedAt = now;
            c.wasNotified = false;
          });
        });
        console.log('[BackgroundMonitor] Change record saved:', changeRecord!.id);

        // 9. Update page status
        await db.write(async () => {
          await page.update(p => {
            p.lastCheckedAt = now;
            p.lastStatus = 'changed';
            p.lastError = null;
          });
        });
        console.log('[BackgroundMonitor] Page status updated to changed');

        // 10. Notify if enabled
        if (useSettings.notificationsEnabled) {
          try {
            const displayTitle = page.title || page.url;
            await NotificationService.notifyChange(
              pageId,
              displayTitle,
              summary,
              page.url,
            );
            console.log('[BackgroundMonitor] Notification sent');
          } catch (notifErr) {
            console.warn('[BackgroundMonitor] Notification error:', notifErr);
          }
        }

        // 11. Prune old snapshots and change records
        await pruneOldSnapshots(pageId);
        await pruneOldChangeRecords(pageId, page.maxChangeRecords);

        return {status: 'changed', summary};
      } else {
        // No significant changes
        await db.write(async () => {
          await page.update(p => {
            p.lastCheckedAt = now;
            p.lastStatus = 'ok';
            p.lastError = null;
          });
        });
        await pruneOldSnapshots(pageId);
        await pruneOldChangeRecords(pageId, page.maxChangeRecords);
        return {status: 'unchanged'};
      }
    } else {
      // First-ever snapshot
      console.log('[BackgroundMonitor] First snapshot saved');
      await db.write(async () => {
        await page.update(p => {
          p.lastCheckedAt = now;
          p.lastStatus = 'ok';
          p.lastError = null;
        });
      });
      return {status: 'first_snapshot'};
    }
  } catch (err: any) {
    console.error('[BackgroundMonitor] checkPage error:', err);
    await db.write(async () => {
      await page.update(p => {
        p.lastCheckedAt = now;
        p.lastStatus = 'error';
        p.lastError = err?.message ?? String(err);
      });
    });
    return {status: 'error', error: err?.message ?? String(err)};
  }
}

// --- Background fetch handler ---
// Uses JobScheduler (not AlarmManager) so the process runs inside a JobService
// and is NOT subject to Android's App Freezer during execution.
export async function backgroundFetchHandler(taskId: string): Promise<void> {
  console.log('[BackgroundMonitor] Task started:', taskId, '(background)');
  try {
    // Ensure notification channel exists (may be headless with no App mount)
    try {
      await NotificationService.initialize();
    } catch (notifInitErr) {
      console.warn('[BackgroundMonitor] NotificationService init failed:', notifInitErr);
    }

    let db;
    try {
      db = getDatabase();
    } catch (dbErr) {
      console.error('[BackgroundMonitor] Database error:', dbErr);
      BackgroundFetch.finish(taskId);
      return;
    }

    const now = Date.now();

    const activePages = await db
      .get<MonitoredPage>('monitored_pages')
      .query(Q.where('is_active', true))
      .fetch();

    // Check pages that are due or will be due within 10 min,
    // since JobScheduler may batch/delay tasks and the next fetch may be 15+ min away.
    const duePages = activePages.filter(
      p =>
        !p.lastCheckedAt ||
        now - p.lastCheckedAt >= p.checkIntervalMs - BG_DUE_TOLERANCE_MS,
    );

    console.log(
      `[BackgroundMonitor] ${activePages.length} active pages, ${duePages.length} due (with ${BG_DUE_TOLERANCE_MS / 60000}min tolerance)`,
    );

    const taskStartTime = Date.now();
    let checkedCount = 0;

    for (const page of duePages) {
      // Check time budget before starting the next page
      const elapsed = Date.now() - taskStartTime;
      if (elapsed >= BG_TIME_BUDGET_MS) {
        const skipped = duePages.length - checkedCount;
        console.warn(
          `[BackgroundMonitor] Time budget exceeded (${elapsed}ms), skipping ${skipped} pages`,
        );
        break;
      }

      const result = await checkPage(page.id);
      checkedCount++;
      console.log(
        `[BackgroundMonitor] Background check result for ${page.url}:`,
        result.status,
      );
    }
  } catch (err) {
    console.error('[BackgroundMonitor] Handler error:', err);
  } finally {
    BackgroundFetch.finish(taskId);
  }
}

export function backgroundFetchTimeout(taskId: string): void {
  console.warn('[BackgroundMonitor] Task timed out:', taskId);
  BackgroundFetch.finish(taskId);
}

// --- Configure BackgroundFetch (called from App.tsx on mount) ---
export async function configureBackgroundFetch(): Promise<void> {
  const STATUS_MAP: Record<number, string> = {
    0: 'STATUS_RESTRICTED',
    1: 'STATUS_DENIED',
    2: 'STATUS_AVAILABLE',
  };

  const status = await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // 15 minutes (Android minimum)
      // Use JobScheduler (default) — NOT AlarmManager.
      // JobScheduler runs tasks inside a JobService where Android keeps the process
      // alive (not subject to App Freezer). AlarmManager uses BroadcastReceiver which
      // gets frozen after ~10 seconds, killing HTTP requests mid-flight.
      forceAlarmManager: false,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      requiresCharging: false,
      requiresDeviceIdle: false,
    },
    async (taskId: string) => {
      await backgroundFetchHandler(taskId);
    },
    async (taskId: string) => {
      backgroundFetchTimeout(taskId);
    },
  );

  const statusName = STATUS_MAP[status] ?? `UNKNOWN(${status})`;
  console.log('[BackgroundMonitor] Configured, status:', statusName);
}

// --- Foreground interval checking (called while app is open) ---
let foregroundInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

async function runForegroundCheck(): Promise<void> {
  try {
    const db = getDatabase();
    const now = Date.now();

    const activePages = await db
      .get<MonitoredPage>('monitored_pages')
      .query(Q.where('is_active', true))
      .fetch();

    const duePages = activePages.filter(
      p => !p.lastCheckedAt || now - p.lastCheckedAt >= p.checkIntervalMs,
    );

    if (duePages.length > 0) {
      console.log(
        `[BackgroundMonitor] Foreground: ${duePages.length} pages due`,
      );
      for (const page of duePages) {
        await checkPage(page.id);
      }
    }
  } catch (err) {
    console.warn('[BackgroundMonitor] Foreground check error:', err);
  }
}

export function startForegroundChecking(): void {
  if (foregroundInterval) return;

  console.log('[BackgroundMonitor] Starting foreground checking (every 60s)');
  foregroundInterval = setInterval(runForegroundCheck, 60_000);

  // Run an immediate check when app returns to foreground
  // (setInterval is throttled/paused by Android when app is in background)
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        console.log('[BackgroundMonitor] App resumed → immediate check');
        runForegroundCheck();
      }
    });
  }
}

export function stopForegroundChecking(): void {
  if (foregroundInterval) {
    clearInterval(foregroundInterval);
    foregroundInterval = null;
    console.log('[BackgroundMonitor] Stopped foreground checking');
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
