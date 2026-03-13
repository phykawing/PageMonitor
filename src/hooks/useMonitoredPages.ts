import {useEffect, useState} from 'react';
import {Q} from '@nozbe/watermelondb';
import {getDatabase} from '../database';
import {MonitoredPage} from '../database/models/MonitoredPage';

export function useMonitoredPages() {
  const [pages, setPages] = useState<MonitoredPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase();
    const subscription = db
      .get<MonitoredPage>('monitored_pages')
      .query(Q.sortBy('created_at', Q.desc))
      .observeWithColumns(['last_status', 'last_checked_at', 'last_error'])
      .subscribe({
        next: results => {
          setPages(results);
          setLoading(false);
        },
        error: err => {
          console.error('[useMonitoredPages]', err);
          setLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  return {pages, loading};
}
