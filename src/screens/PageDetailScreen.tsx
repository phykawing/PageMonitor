import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {format, formatDistanceToNow} from 'date-fns';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../app/NavigationTypes';
import {useChangeRecords} from '../hooks/useChangeRecords';
import {useAppStore} from '../store/useAppStore';
import {EmptyState} from '../components/EmptyState';
import {StatusBadge} from '../components/StatusBadge';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {checkPage} from '../services/BackgroundMonitor';
import type {CheckResult} from '../services/BackgroundMonitor';
import {ShareService} from '../services/ShareService';
import {getIntervalLabel} from '../utils/constants';
import {getDatabase} from '../database';
import {MonitoredPage} from '../database/models/MonitoredPage';
import {Snapshot} from '../database/models/Snapshot';
import {ChangeRecord} from '../database/models/ChangeRecord';
import {Q} from '@nozbe/watermelondb';

type Props = NativeStackScreenProps<RootStackParamList, 'PageDetail'>;

export function PageDetailScreen({route, navigation}: Props) {
  const {t} = useTranslation();
  const {pageId} = route.params;
  const insets = useSafeAreaInsets();
  const {records, loading} = useChangeRecords(pageId);
  const {setChecking, isChecking} = useAppStore();

  const [page, setPage] = useState<MonitoredPage | null>(null);
  const [, setTick] = useState(0); // Force re-render for relative time
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Observe page record for live updates
  useEffect(() => {
    const db = getDatabase();
    const subscription = db
      .get<MonitoredPage>('monitored_pages')
      .query(Q.where('id', pageId))
      .observe()
      .subscribe({
        next: pages => setPage(pages[0] ?? null),
        error: console.error,
      });

    return () => subscription.unsubscribe();
  }, [pageId]);

  // Mark page as read (green dot) when user views the detail screen
  useEffect(() => {
    if (page && page.lastStatus === 'changed') {
      const db = getDatabase();
      db.write(async () => {
        await page.update(p => {
          p.lastStatus = 'ok';
        });
      }).catch(err => console.warn('[PageDetail] Failed to mark as read:', err));
    }
  }, [page?.lastStatus]); // Only run when lastStatus changes

  // Periodic tick to update relative time display
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleCheckNow = useCallback(async () => {
    if (isChecking(pageId)) return;
    setChecking(pageId, true);
    try {
      const result: CheckResult = await checkPage(pageId);
      // Show feedback to user
      switch (result.status) {
        case 'changed':
          Alert.alert(
            t('pageDetail.checkComplete'),
            t('pageDetail.changesFound', {summary: result.summary}),
          );
          break;
        case 'unchanged':
          Alert.alert(
            t('pageDetail.checkComplete'),
            t('pageDetail.noChangesFound'),
          );
          break;
        case 'first_snapshot':
          Alert.alert(
            t('pageDetail.checkComplete'),
            t('pageDetail.baselineSaved'),
          );
          break;
        case 'error':
          Alert.alert(t('common.error'), result.error ?? t('common.unknownError'));
          break;
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('common.unknownError'));
    } finally {
      setChecking(pageId, false);
    }
  }, [pageId, isChecking, setChecking, t]);

  const handleShare = useCallback(async () => {
    if (!page || records.length === 0) return;
    const latest = records[0];
    await ShareService.shareChange({
      pageTitle: page.title || page.url,
      url: page.url,
      changeSummary: latest.changeSummary,
      detectedAt: latest.detectedAt,
      linksAdded: JSON.parse(latest.linksAddedJson || '[]'),
      linksRemoved: JSON.parse(latest.linksRemovedJson || '[]'),
    });
  }, [page, records]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  }, [records, selectedIds.size]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t('pageDetail.deleteConfirmTitle'),
      t('pageDetail.deleteConfirmMessage', {count: selectedIds.size}),
      [
        {text: t('pageDetail.deleteCancel'), style: 'cancel'},
        {
          text: t('pageDetail.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase();
              const toDelete = records.filter(r => selectedIds.has(r.id));
              const keptRecords = records.filter(r => !selectedIds.has(r.id));

              // Collect snapshot IDs referenced by kept records
              const keptSnapshotIds = new Set<string>();
              for (const r of keptRecords) {
                keptSnapshotIds.add(r.oldSnapshotId);
                keptSnapshotIds.add(r.newSnapshotId);
              }

              // Find orphaned snapshots
              const orphanSnapshotIds = new Set<string>();
              for (const r of toDelete) {
                if (!keptSnapshotIds.has(r.oldSnapshotId)) orphanSnapshotIds.add(r.oldSnapshotId);
                if (!keptSnapshotIds.has(r.newSnapshotId)) orphanSnapshotIds.add(r.newSnapshotId);
              }

              await db.write(async () => {
                for (const record of toDelete) {
                  await record.destroyPermanently();
                }
                for (const snapshotId of orphanSnapshotIds) {
                  try {
                    const snapshot = await db.get<Snapshot>('snapshots').find(snapshotId);
                    await snapshot.destroyPermanently();
                  } catch {
                    // Already deleted or not found
                  }
                }
              });

              setSelectedIds(new Set());
              setSelectionMode(false);
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message ?? t('common.unknownError'));
            }
          },
        },
      ],
    );
  }, [selectedIds, records, t]);

  const renderRecord = useCallback(
    ({item}: {item: ChangeRecord}) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <TouchableOpacity
          style={styles.recordItem}
          onPress={() => {
            if (selectionMode) {
              handleToggleSelect(item.id);
            } else {
              navigation.navigate('DiffView', {changeRecordId: item.id});
            }
          }}
          activeOpacity={0.7}>
          {selectionMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          )}
          <View style={styles.recordLeft}>
            <Text style={styles.recordDate}>
              {format(new Date(item.detectedAt), 'MMM d, HH:mm')}
            </Text>
            <Text style={styles.recordSummary} numberOfLines={2}>
              {item.changeSummary}
            </Text>
          </View>
          {!selectionMode && <Text style={styles.chevron}>›</Text>}
        </TouchableOpacity>
      );
    },
    [navigation, selectionMode, selectedIds, handleToggleSelect],
  );

  const checking = isChecking(pageId);
  const lastCheckedText = checking
    ? t('pageDetail.checking')
    : page?.lastCheckedAt
    ? formatDistanceToNow(new Date(page.lastCheckedAt), {addSuffix: true})
    : t('home.neverChecked');

  return (
    <View style={[styles.container, {paddingBottom: insets.bottom}]}>
      {/* Page info bar */}
      {page && (
        <View style={styles.pageBar}>
          <View style={styles.pageBarLeft}>
            <StatusBadge status={(page.lastStatus as any) || 'pending'} />
            <View style={styles.pageBarText}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {page.title || page.url}
              </Text>
              <TouchableOpacity onPress={() => Linking.openURL(page.url)}>
                <Text style={styles.pageUrl} numberOfLines={1}>
                  {page.url}
                </Text>
              </TouchableOpacity>
              <Text style={styles.lastChecked}>
                {t('pageDetail.lastChecked', {time: lastCheckedText})}
              </Text>
              <Text style={styles.lastChecked}>
                {t('pageDetail.checkInterval', {interval: getIntervalLabel(page.checkIntervalMs)})}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Action buttons */}
      {selectionMode ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleSelectAll}
            activeOpacity={0.8}>
            <Text style={[styles.actionButtonText, styles.shareButtonText]}>
              {selectedIds.size === records.length
                ? t('pageDetail.deselectAll')
                : t('pageDetail.selectAll')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
            activeOpacity={0.8}>
            <Text style={[styles.actionButtonText, styles.shareButtonText]}>
              {t('pageDetail.done')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.checkButton, checking && styles.actionDisabled]}
            onPress={handleCheckNow}
            disabled={checking}
            activeOpacity={0.8}>
            {checking ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Text style={styles.actionButtonText}>{t('pageDetail.checkNow')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton, records.length === 0 && styles.actionDisabled]}
            onPress={handleShare}
            disabled={records.length === 0}
            activeOpacity={0.8}>
            <Text style={[styles.actionButtonText, styles.shareButtonText]}>
              {t('pageDetail.share')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton, records.length === 0 && styles.actionDisabled]}
            onPress={() => setSelectionMode(true)}
            disabled={records.length === 0}
            activeOpacity={0.8}>
            <Text style={[styles.actionButtonText, styles.shareButtonText]}>
              {t('pageDetail.manage')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Change records list */}
      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderRecord}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyState
              icon="✅"
              title={t('pageDetail.noChanges')}
              subtitle={t('pageDetail.noChangesSubtitle')}
            />
          )
        }
        contentContainerStyle={records.length === 0 ? {flexGrow: 1} : undefined}
        extraData={selectionMode ? selectedIds : undefined}
      />

      {selectionMode && selectedIds.size > 0 && (
        <View style={styles.deleteBar}>
          <TouchableOpacity
            style={styles.deleteSelectedButton}
            onPress={handleDeleteSelected}
            activeOpacity={0.8}>
            <Text style={styles.deleteSelectedText}>
              {t('pageDetail.deleteSelected', {count: selectedIds.size})}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pageBarText: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pageUrl: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  lastChecked: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  checkButton: {
    backgroundColor: colors.primary,
  },
  shareButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  shareButtonText: {
    color: colors.textPrimary,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recordLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  recordDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  recordSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 20,
    color: colors.textDisabled,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBar: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteSelectedButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  deleteSelectedText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
