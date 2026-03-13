import {createNavigationContainerRef} from '@react-navigation/native';
import type {RootStackParamList} from './NavigationTypes';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToPageDetail(pageId: string): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('PageDetail', {pageId});
  } else {
    // Navigation not ready yet — store for later (handled by initial notification logic)
    console.log('[Navigation] Not ready, deferring navigation to page:', pageId);
  }
}
