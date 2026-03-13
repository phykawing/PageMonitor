import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {ScrollView} from 'react-native';
import {useTranslation} from 'react-i18next';
import {format} from 'date-fns';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Change} from 'diff';
import type {RootStackParamList} from '../app/NavigationTypes';
import {DiffRenderer} from '../components/DiffRenderer';
import {LinkChangeList} from '../components/LinkChangeList';
import {ShareService} from '../services/ShareService';
import {getDatabase} from '../database';
import {ChangeRecord} from '../database/models/ChangeRecord';
import {MonitoredPage} from '../database/models/MonitoredPage';
import {Q} from '@nozbe/watermelondb';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'DiffView'>;
type Tab = 'text' | 'links';

export function DiffViewScreen({route, navigation}: Props) {
  const {t} = useTranslation();
  const {changeRecordId} = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [record, setRecord] = useState<ChangeRecord | null>(null);
  const [page, setPage] = useState<MonitoredPage | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [linksAdded, setLinksAdded] = useState<Array<{href: string; text: string}>>([]);
  const [linksRemoved, setLinksRemoved] = useState<Array<{href: string; text: string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase();
    db.get<ChangeRecord>('change_records')
      .query(Q.where('id', changeRecordId))
      .fetch()
      .then(async records => {
        const rec = records[0];
        if (!rec) {
          setLoading(false);
          return;
        }
        setRecord(rec);

        // Parse diff data
        try {
          const parsedChanges: Change[] = JSON.parse(rec.textDiffJson || '[]');
          setChanges(parsedChanges);
          setLinksAdded(JSON.parse(rec.linksAddedJson || '[]'));
          setLinksRemoved(JSON.parse(rec.linksRemovedJson || '[]'));
        } catch (e) {
          console.error('[DiffViewScreen] parse error:', e);
        }

        // Load page info
        const pages = await db
          .get<MonitoredPage>('monitored_pages')
          .query(Q.where('id', rec.pageId))
          .fetch();
        setPage(pages[0] ?? null);
        setLoading(false);
      })
      .catch(err => {
        console.error('[DiffViewScreen]', err);
        setLoading(false);
      });
  }, [changeRecordId]);

  // Update header title
  useEffect(() => {
    if (page) {
      navigation.setOptions({title: page.title || page.url});
    }
  }, [page, navigation]);

  const handleShare = async () => {
    if (!record || !page) return;
    await ShareService.shareChange({
      pageTitle: page.title || page.url,
      url: page.url,
      changeSummary: record.changeSummary,
      detectedAt: record.detectedAt,
      linksAdded,
      linksRemoved,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Change record not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Metadata bar */}
      <View style={styles.metaBar}>
        <Text style={styles.metaSummary} numberOfLines={2}>
          {record.changeSummary}
        </Text>
        <Text style={styles.metaDate}>
          {t('diffView.detectedAt', {
            time: format(new Date(record.detectedAt), 'MMM d, yyyy HH:mm'),
          })}
        </Text>
      </View>

      {/* Tab selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'text' && styles.tabActive]}
          onPress={() => setActiveTab('text')}>
          <Text style={[styles.tabText, activeTab === 'text' && styles.tabTextActive]}>
            {t('diffView.textChanges')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'links' && styles.tabActive]}
          onPress={() => setActiveTab('links')}>
          <Text style={[styles.tabText, activeTab === 'links' && styles.tabTextActive]}>
            {t('diffView.linkChanges')}
            {linksAdded.length + linksRemoved.length > 0
              ? ` (${linksAdded.length + linksRemoved.length})`
              : ''}
          </Text>
        </TouchableOpacity>

        {/* Share button in tab bar */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
          <Text style={styles.shareButtonText}>⬆️</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'text' ? (
        <DiffRenderer changes={changes} />
      ) : (
        <ScrollView style={styles.linksContainer}>
          <LinkChangeList added={linksAdded} removed={linksRemoved} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metaBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metaSummary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metaDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  shareButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    fontSize: 18,
  },
  linksContainer: {
    flex: 1,
  },
});
