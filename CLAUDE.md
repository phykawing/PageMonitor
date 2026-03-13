# Page Monitor — Project Guide

## Overview
React Native Android app for monitoring web pages for changes. On-device only (no backend). TypeScript throughout.

## Tech Stack
- React Native (latest stable) with Hermes engine
- React Navigation v7 (native-stack)
- WatermelonDB (structured data: pages, snapshots, change records)
- react-native-mmkv (settings/preferences)
- react-native-background-fetch (configurable background checks via Android WorkManager, 15min minimum)
- @notifee/react-native (local push notifications)
- htmlparser2 (HTML parsing)
- diff/jsdiff (text diffing)
- i18next + react-i18next + react-native-localize (i18n: English + Traditional Chinese)
- zustand (transient UI state)
- date-fns (date formatting)
- @react-native-vector-icons/ionicons (icons)
- react-native-url-polyfill (URL polyfill for Hermes)

## Key Directories
- `src/database/` — WatermelonDB schema, models, migrations, init
- `src/services/` — Core business logic (BackgroundMonitor, PageFetcher, HtmlParser, DiffEngine, NotificationService, ShareService)
- `src/screens/` — 4 screens: HomeScreen, AddEditPageScreen, PageDetailScreen, DiffViewScreen
- `src/components/` — Reusable UI: DiffRenderer, LinkChangeList, PageListItem, StatusBadge, EmptyState
- `src/i18n/` — Translation files (en.json, zh-Hant.json)
- `src/store/` — Zustand store (useAppStore) and MMKV settings (useSettings)
- `src/hooks/` — Custom hooks wrapping WatermelonDB queries
- `src/utils/` — constants, textNormalizer, urlValidator
- `src/theme/` — colors, spacing, typography

## Coding Conventions
- TypeScript strict mode
- Functional components with hooks (no class components)
- Named exports (not default exports) for components and utilities
- All user-facing strings must use `t()` from i18next — never hardcode strings
- Database writes must be wrapped in `database.write(async () => { ... })`
- Use MMKV (synchronous) for flat key-value settings, WatermelonDB for relational data
- Keep services stateless — they receive dependencies as parameters

## Data Model (3 tables)
- `monitored_pages` — URL, title, is_active, check_interval_ms, last_checked_at, last_status, last_error, max_change_records (optional), created_at, updated_at
- `snapshots` — page_id (indexed), text_content, links_json, raw_html_hash, content_length, fetched_at
- `change_records` — page_id (indexed), old_snapshot_id, new_snapshot_id, text_diff_json, links_added_json, links_removed_json, change_summary, detected_at, was_notified

## Build & Run
```bash
npm install
npx react-native start            # Metro bundler
npx react-native run-android      # Build and install
cd android && ./gradlew assembleRelease  # Release APK
```

### Building for Real Device
The release APK is unsigned and will hang during installation on real devices. Use the **debug APK** instead:
```bash
powershell -ExecutionPolicy Bypass -File rebundle-install.ps1
```
This bundles JS in prod mode, builds a debug APK (pre-signed with debug keystore), and installs to the connected emulator/device. The debug APK is at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
To produce a signed release APK, a signing keystore must be configured in `android/app/build.gradle`.

## Background Monitoring Architecture
- Registered as headless task in index.js (before AppRegistry.registerComponent)
- BackgroundFetch configured in App.tsx on mount
- Flow: query active pages → filter due → fetch HTML → hash compare → parse if changed → diff → save → notify
- FNV-1a hash-first strategy skips expensive parsing when content unchanged (Hermes lacks crypto.subtle)

## Common Pitfalls
- htmlparser2 may need polyfills for Hermes — if issues arise, use htmlparser2-without-node-native
- Background fetch does NOT work reliably on Android emulators — test on physical device
- Android 13+ requires POST_NOTIFICATIONS runtime permission — Notifee handles this
- Some OEMs kill background tasks — app should guide users to disable battery optimization
- Max snapshot cap (50/page) must be enforced to prevent storage bloat
- WatermelonDB decorators require babel plugin `@babel/plugin-proposal-decorators` (legacy mode) in babel.config.js

## Testing
- Unit test services (HtmlParser, DiffEngine) with Jest
- Test background monitoring on a real Android device
- Test notifications on Android 13+ for permission flow
