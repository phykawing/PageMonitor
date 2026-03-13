import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import {NOTIFICATION_CHANNEL_ID, NOTIFICATION_CHANNEL_NAME} from '../utils/constants';

export class NotificationService {
  static async initialize(): Promise<void> {
    // Delete the old channel (created without sound, causing silent notifications).
    // Android channels are immutable after creation, so we migrated to a new ID.
    try {
      await notifee.deleteChannel('page-changes');
    } catch {
      // Channel may not exist — that's fine
    }

    await notifee.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: NOTIFICATION_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      description: 'Notifications when monitored web pages change',
    });
  }

  static async requestPermission(): Promise<boolean> {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  }

  static async notifyChange(
    pageId: string,
    pageTitle: string,
    summary: string,
    url: string,
  ): Promise<void> {
    await notifee.displayNotification({
      title: `Page Changed: ${pageTitle}`,
      body: summary,
      android: {
        channelId: NOTIFICATION_CHANNEL_ID,
        smallIcon: 'ic_notification',
        // Explicitly disable foreground service — on Android 12+ (API 31+),
        // starting a foreground service from a background context throws
        // ForegroundServiceStartNotAllowedException.
        asForegroundService: false,
        timestamp: Date.now(),
        showTimestamp: true,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        style: {
          type: AndroidStyle.BIGTEXT,
          text: `${summary}\n${url}`,
        },
      },
      data: {
        pageId,
        type: 'page_change',
      },
    });
  }

  static onForegroundEvent(
    handler: (pageId: string) => void,
  ): () => void {
    return notifee.onForegroundEvent(({type, detail}) => {
      if (
        type === EventType.PRESS &&
        detail.notification?.data?.type === 'page_change'
      ) {
        const pageId = detail.notification.data.pageId as string;
        if (pageId) {
          handler(pageId);
        }
      }
    });
  }
}
