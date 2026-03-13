import React, {useState, useCallback, useLayoutEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../app/NavigationTypes';
import {isValidUrl, normalizeUrl} from '../utils/urlValidator';
import {useSettings} from '../store/useSettings';
import {getDatabase} from '../database';
import {MonitoredPage} from '../database/models/MonitoredPage';
import {checkPage} from '../services/BackgroundMonitor';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {CHECK_INTERVALS, CHANGE_RECORD_LIMITS, MAX_CHANGE_RECORDS_PER_PAGE} from '../utils/constants';
import {Q} from '@nozbe/watermelondb';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditPage'>;

export function AddEditPageScreen({route, navigation}: Props) {
  const {t} = useTranslation();
  const pageId = route.params?.pageId;
  const isEdit = !!pageId;

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [checkIntervalMs, setCheckIntervalMs] = useState(useSettings.defaultCheckIntervalMs);
  const [maxChangeRecords, setMaxChangeRecords] = useState<number>(MAX_CHANGE_RECORDS_PER_PAGE);
  const [urlError, setUrlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  // Load existing page data for edit mode
  React.useEffect(() => {
    if (!pageId) return;
    const db = getDatabase();
    db.get<MonitoredPage>('monitored_pages')
      .query(Q.where('id', pageId))
      .fetch()
      .then(pages => {
        if (pages[0]) {
          const p = pages[0];
          setUrl(p.url);
          setTitle(p.title);
          setIsActive(p.isActive);
          setCheckIntervalMs(p.checkIntervalMs);
          setMaxChangeRecords(p.maxChangeRecords == null ? 0 : p.maxChangeRecords);
        }
        setLoaded(true);
      });
  }, [pageId]);

  const handleSave = useCallback(async () => {
    const normalizedUrl = normalizeUrl(url.trim());
    if (!isValidUrl(normalizedUrl)) {
      setUrlError(t('addEdit.urlError'));
      return;
    }
    setUrlError('');
    setSaving(true);

    try {
      const db = getDatabase();

      if (isEdit && pageId) {
        // Update existing
        const pages = await db
          .get<MonitoredPage>('monitored_pages')
          .query(Q.where('id', pageId))
          .fetch();
        if (pages[0]) {
          await db.write(async () => {
            await pages[0].update(p => {
              p.url = normalizedUrl;
              p.title = title.trim();
              p.isActive = isActive;
              p.checkIntervalMs = checkIntervalMs;
              p.maxChangeRecords = maxChangeRecords === 0 ? null : maxChangeRecords;
            });
          });
        }
      } else {
        // Create new
        let newPageId: string = '';
        await db.write(async () => {
          const newPage = await db
            .get<MonitoredPage>('monitored_pages')
            .create(p => {
              p.url = normalizedUrl;
              p.title = title.trim();
              p.isActive = isActive;
              p.checkIntervalMs = checkIntervalMs;
              p.maxChangeRecords = maxChangeRecords === 0 ? null : maxChangeRecords;
              p.lastStatus = 'pending';
              // createdAt and updatedAt are managed automatically by @readonly @date decorators
            });
          newPageId = newPage.id;
        });

        // Initial fetch in background (don't await to avoid blocking navigation)
        if (newPageId && isActive) {
          checkPage(newPageId).catch(console.error);
        }
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('common.unknownError'));
    } finally {
      setSaving(false);
    }
  }, [url, title, isActive, checkIntervalMs, maxChangeRecords, isEdit, pageId, navigation, t]);

  const handleDelete = useCallback(() => {
    if (!pageId) return;
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
            const pages = await db
              .get<MonitoredPage>('monitored_pages')
              .query(Q.where('id', pageId))
              .fetch();
            if (pages[0]) {
              await db.write(async () => {
                await pages[0].markAsDeleted();
              });
            }
            navigation.popToTop();
          },
        },
      ],
    );
  }, [pageId, navigation, t]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* URL Field */}
      <Text style={styles.label}>{t('addEdit.urlLabel')}</Text>
      <TextInput
        style={[styles.input, urlError ? styles.inputError : null]}
        value={url}
        onChangeText={v => {
          setUrl(v);
          setUrlError('');
        }}
        placeholder={t('addEdit.urlPlaceholder')}
        placeholderTextColor={colors.textDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!isEdit}
      />
      {urlError ? <Text style={styles.errorText}>{urlError}</Text> : null}

      {/* Title Field */}
      <Text style={styles.label}>{t('addEdit.titleLabel')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('addEdit.titlePlaceholder')}
        placeholderTextColor={colors.textDisabled}
      />

      {/* Active Toggle */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('addEdit.activeLabel')}</Text>
        <Switch
          value={isActive}
          onValueChange={setIsActive}
          trackColor={{true: colors.primary, false: colors.border}}
          thumbColor={colors.surface}
        />
      </View>

      {/* Check Interval */}
      <Text style={styles.label}>{t('addEdit.intervalLabel')}</Text>
      <View style={styles.intervalGrid}>
        {CHECK_INTERVALS.map(interval => (
          <TouchableOpacity
            key={interval.value}
            style={[
              styles.intervalButton,
              checkIntervalMs === interval.value && styles.intervalButtonSelected,
            ]}
            onPress={() => setCheckIntervalMs(interval.value)}>
            <Text
              style={[
                styles.intervalButtonText,
                checkIntervalMs === interval.value && styles.intervalButtonTextSelected,
              ]}>
              {interval.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Max Change Records */}
      <Text style={styles.label}>{t('addEdit.maxChangesLabel')}</Text>
      <View style={styles.intervalGrid}>
        {CHANGE_RECORD_LIMITS.map(limit => (
          <TouchableOpacity
            key={limit.value}
            style={[
              styles.intervalButton,
              maxChangeRecords === limit.value && styles.intervalButtonSelected,
            ]}
            onPress={() => setMaxChangeRecords(limit.value)}>
            <Text
              style={[
                styles.intervalButtonText,
                maxChangeRecords === limit.value && styles.intervalButtonTextSelected,
              ]}>
              {limit.value === 0 ? t('addEdit.unlimited') : limit.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}>
        {saving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.saveButtonText}>{t('addEdit.save')}</Text>
        )}
      </TouchableOpacity>

      {/* Delete Button (edit mode only) */}
      {isEdit && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.deleteButtonText}>{t('addEdit.delete')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  intervalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  intervalButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  intervalButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  intervalButtonTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '500',
  },
});
