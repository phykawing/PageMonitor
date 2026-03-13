import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../app/NavigationTypes';
import {useMonitoredPages} from '../hooks/useMonitoredPages';
import {useAppStore} from '../store/useAppStore';
import {PageListItem} from '../components/PageListItem';
import {EmptyState} from '../components/EmptyState';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {checkPage} from '../services/BackgroundMonitor';
import {getDatabase} from '../database';
import type {MonitoredPage} from '../database/models/MonitoredPage';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({navigation}: Props) {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {pages, loading} = useMonitoredPages();
  const {setChecking, isChecking} = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        pages
          .filter(p => p.isActive && !isChecking(p.id))
          .map(async page => {
            setChecking(page.id, true);
            try {
              await checkPage(page.id);
            } finally {
              setChecking(page.id, false);
            }
          }),
      );
    } finally {
      setRefreshing(false);
    }
  }, [pages, isChecking, setChecking]);

  const handleDeletePage = useCallback(
    (page: MonitoredPage) => {
      Alert.alert(
        t('addEdit.deleteConfirmTitle'),
        t('addEdit.deleteConfirmMessage'),
        [
          {text: t('addEdit.deleteCancel'), style: 'cancel'},
          {
            text: t('addEdit.deleteConfirm'),
            style: 'destructive',
            onPress: async () => {
              const db = getDatabase();
              await db.write(async () => {
                await page.markAsDeleted();
              });
            },
          },
        ],
      );
    },
    [t],
  );

  const handleLongPress = useCallback(
    (page: MonitoredPage) => {
      Alert.alert(
        t('home.actions'),
        page.title || page.url,
        [
          {
            text: t('home.edit'),
            onPress: () => navigation.navigate('AddEditPage', {pageId: page.id}),
          },
          {
            text: t('home.delete'),
            style: 'destructive',
            onPress: () => handleDeletePage(page),
          },
          {text: t('addEdit.deleteCancel'), style: 'cancel'},
        ],
      );
    },
    [t, navigation, handleDeletePage],
  );

  // Track page statuses to force FlatList re-render when any status changes
  // (WatermelonDB reuses model references, so FlatList can't detect property changes)
  const pagesFingerprint = pages
    .map(p => `${p.id}:${p.lastStatus}:${p.lastCheckedAt}`)
    .join('|');

  const renderItem = useCallback(
    ({item}: {item: MonitoredPage}) => (
      <PageListItem
        page={item}
        isChecking={isChecking(item.id)}
        onPress={() => navigation.navigate('PageDetail', {pageId: item.id})}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, isChecking, handleLongPress, pagesFingerprint],
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('home.title')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddEditPage', {})}
          activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Page list */}
      {!loading && (
        <FlatList
          data={pages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          extraData={pagesFingerprint}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title={t('home.emptyTitle')}
              subtitle={t('home.emptySubtitle')}
            />
          }
          contentContainerStyle={pages.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
