import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schema} from './schema';
import {migrations} from './migrations';
import {MonitoredPage} from './models/MonitoredPage';
import {Snapshot} from './models/Snapshot';
import {ChangeRecord} from './models/ChangeRecord';

let _database: Database | null = null;

export function getDatabase(): Database {
  if (_database) {
    return _database;
  }

  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'PageMonitorDB',
    jsi: false, // JSI disabled — can crash silently on RN 0.84 New Architecture
    onSetUpError: (error: Error) => {
      console.error('[WatermelonDB] Setup error:', error);
    },
  });

  _database = new Database({
    adapter,
    modelClasses: [MonitoredPage, Snapshot, ChangeRecord],
  });

  return _database;
}
