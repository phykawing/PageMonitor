/**
 * Page Monitor — Entry Point
 * @format
 */

import 'react-native-url-polyfill/auto';
import {AppRegistry} from 'react-native';
import {App} from './src/app/App';
import {name as appName} from './app.json';

import BackgroundFetch from 'react-native-background-fetch';
import notifee, {EventType} from '@notifee/react-native';
import {
  backgroundFetchHandler,
  backgroundFetchTimeout,
} from './src/services/BackgroundMonitor';

// Register Notifee background event handler (runs when notification is tapped
// while app is killed or in background)
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (
    type === EventType.PRESS &&
    detail.notification?.data?.type === 'page_change'
  ) {
    const pageId = detail.notification.data.pageId;
    if (pageId) {
      console.log(
        '[Notifee] Background press: page',
        pageId,
      );
    }
  }
});

// Register BackgroundFetch headless task (runs when app is terminated)
BackgroundFetch.registerHeadlessTask(async ({taskId, timeout}) => {
  if (timeout) {
    backgroundFetchTimeout(taskId);
    return;
  }
  await backgroundFetchHandler(taskId);
});

AppRegistry.registerComponent(appName, () => App);
