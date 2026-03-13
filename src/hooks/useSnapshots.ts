import {useEffect, useState} from 'react';
import {Q} from '@nozbe/watermelondb';
import {getDatabase} from '../database';
import {Snapshot} from '../database/models/Snapshot';

export function useSnapshots(pageId: string) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId) {
      return;
    }
    const db = getDatabase();
    const subscription = db
      .get<Snapshot>('snapshots')
      .query(Q.where('page_id', pageId), Q.sortBy('fetched_at', Q.desc))
      .observe()
      .subscribe({
        next: results => {
          setSnapshots(results);
          setLoading(false);
        },
        error: err => {
          console.error('[useSnapshots]', err);
          setLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [pageId]);

  return {snapshots, loading};
}
