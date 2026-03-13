import React, {useEffect, useCallback} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import notifee, {EventType} from '@notifee/react-native';

import '../i18n';
import type {RootStackParamList} from './NavigationTypes';
import {navigationRef, navigateToPageDetail} from './navigationRef';
import {HomeScreen} from '../screens/HomeScreen';
import {AddEditPageScreen} from '../screens/AddEditPageScreen';
import {PageDetailScreen} from '../screens/PageDetailScreen';
import {DiffViewScreen} from '../screens/DiffViewScreen';
import {NotificationService} from '../services/NotificationService';
import {
  configureBackgroundFetch,
  startForegroundChecking,
  stopForegroundChecking,
} from '../services/BackgroundMonitor';
import {colors} from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function App(): React.JSX.Element {
  // Handle notification tap that launched the app (from killed/background state)
  const handleInitialNotification = useCallback(async () => {
    const initialNotification = await notifee.getInitialNotification();
    if (
      initialNotification?.pressAction?.id === 'default' &&
      initialNotification.notification?.data?.type === 'page_change'
    ) {
      const pageId = initialNotification.notification.data.pageId as string;
      if (pageId) {
        console.log('[App] Initial notification tap → page:', pageId);
        navigateToPageDetail(pageId);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await NotificationService.initialize();
        await NotificationService.requestPermission();
      } catch (err) {
        console.warn('Notification init failed:', err);
      }
      try {
        await configureBackgroundFetch();
      } catch (err) {
        console.warn('BackgroundFetch init failed:', err);
      }
      // Start foreground periodic checking (checks due pages every 60s)
      startForegroundChecking();
    };
    init();

    // Handle notification taps while app is in foreground
    const unsubForeground = notifee.onForegroundEvent(({type, detail}) => {
      if (
        type === EventType.PRESS &&
        detail.notification?.data?.type === 'page_change'
      ) {
        const pageId = detail.notification.data.pageId as string;
        if (pageId) {
          console.log('[App] Foreground notification tap → page:', pageId);
          navigateToPageDetail(pageId);
        }
      }
    });

    return () => {
      unsubForeground();
      stopForegroundChecking();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <NavigationContainer
          ref={navigationRef}
          onReady={handleInitialNotification}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              contentStyle: {backgroundColor: colors.background},
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddEditPage" component={AddEditPageScreen} />
            <Stack.Screen name="PageDetail" component={PageDetailScreen} />
            <Stack.Screen name="DiffView" component={DiffViewScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
