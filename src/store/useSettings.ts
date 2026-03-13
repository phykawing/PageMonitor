import {createMMKV} from 'react-native-mmkv';
import {DEFAULT_CHECK_INTERVAL_MS, MAX_SNAPSHOTS_PER_PAGE} from '../utils/constants';

const storage = createMMKV({id: 'app-settings'});

export interface AppSettings {
  defaultCheckIntervalMs: number;
  notificationsEnabled: boolean;
  maxSnapshotsPerPage: number;
  wifiOnlyChecks: boolean;
  onboardingCompleted: boolean;
}

const DEFAULTS: AppSettings = {
  defaultCheckIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
  notificationsEnabled: true,
  maxSnapshotsPerPage: MAX_SNAPSHOTS_PER_PAGE,
  wifiOnlyChecks: false,
  onboardingCompleted: false,
};

export const useSettings = {
  get defaultCheckIntervalMs(): number {
    return storage.getNumber('defaultCheckIntervalMs') ?? DEFAULTS.defaultCheckIntervalMs;
  },
  set defaultCheckIntervalMs(value: number) {
    storage.set('defaultCheckIntervalMs', value);
  },

  get notificationsEnabled(): boolean {
    return storage.getBoolean('notificationsEnabled') ?? DEFAULTS.notificationsEnabled;
  },
  set notificationsEnabled(value: boolean) {
    storage.set('notificationsEnabled', value);
  },

  get maxSnapshotsPerPage(): number {
    return storage.getNumber('maxSnapshotsPerPage') ?? DEFAULTS.maxSnapshotsPerPage;
  },
  set maxSnapshotsPerPage(value: number) {
    storage.set('maxSnapshotsPerPage', value);
  },

  get wifiOnlyChecks(): boolean {
    return storage.getBoolean('wifiOnlyChecks') ?? DEFAULTS.wifiOnlyChecks;
  },
  set wifiOnlyChecks(value: boolean) {
    storage.set('wifiOnlyChecks', value);
  },

  get onboardingCompleted(): boolean {
    return storage.getBoolean('onboardingCompleted') ?? DEFAULTS.onboardingCompleted;
  },
  set onboardingCompleted(value: boolean) {
    storage.set('onboardingCompleted', value);
  },
};
