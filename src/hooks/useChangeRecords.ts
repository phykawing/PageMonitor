import {useEffect, useState} from 'react';
import {Q} from '@nozbe/watermelondb';
import {getDatabase} from '../database';
import {ChangeRecord} from '../database/models/ChangeRecord';

export function useChangeRecords(pageId: string) {
  const [records, setRecords] = useState<ChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId) {
      return;
    }
    const db = getDatabase();
    const subscription = db
      .get<ChangeRecord>('change_records')
      .query(Q.where('page_id', pageId), Q.sortBy('detected_at', Q.desc))
      .observe()
      .subscribe({
        next: results => {
          setRecords(results);
          setLoading(false);
        },
        error: err => {
          console.error('[useChangeRecords]', err);
          setLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [pageId]);

  return {records, loading};
}
