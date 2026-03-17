import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {formatDistanceToNow} from 'date-fns';
import {useTranslation} from 'react-i18next';
import {StatusBadge} from './StatusBadge';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {getIntervalLabel} from '../utils/constants';
import type {MonitoredPage} from '../database/models/MonitoredPage';

interface PageListItemProps {
  page: MonitoredPage;
  onPress: () => void;
  onLongPress?: () => void;
  isChecking?: boolean;
}

export function PageListItem({page, onPress, onLongPress, isChecking = false}: PageListItemProps) {
  const {t} = useTranslation();

  const lastCheckedText = isChecking
    ? t('pageDetail.checking')
    : page.lastCheckedAt
    ? t('home.lastChecked', {
        time: formatDistanceToNow(new Date(page.lastCheckedAt), {addSuffix: true}),
      })
    : t('home.neverChecked');

  const intervalText = t('home.interval', {interval: getIntervalLabel(page.checkIntervalMs)});

  const displayTitle = page.title || page.url;
  const showUrl = !!page.title;
  const errorText =
    page.lastStatus === 'error'
      ? page.lastError || t('home.checkFailed')
      : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={styles.statusContainer}>
        <StatusBadge status={page.lastStatus as any || 'pending'} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>
        {showUrl && (
          <Text style={styles.url} numberOfLines={1}>
            {page.url}
          </Text>
        )}
        <Text style={styles.lastChecked}>{lastCheckedText} · {intervalText}</Text>
        {errorText && (
          <Text style={styles.errorText} numberOfLines={2}>
            {errorText}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusContainer: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  url: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  lastChecked: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: colors.textDisabled,
  },
});
