import React from 'react';
import {View, Text, TouchableOpacity, Linking, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';

interface Link {
  href: string;
  text: string;
}

interface LinkChangeListProps {
  added: Link[];
  removed: Link[];
}

function LinkItem({link, type}: {link: Link; type: 'added' | 'removed'}) {
  const isAdded = type === 'added';
  const bgColor = isAdded ? colors.diffAdded : colors.diffRemoved;
  const textColor = isAdded ? colors.diffAddedText : colors.diffRemovedText;
  const prefix = isAdded ? '+ ' : '− ';

  const openLink = () => {
    Linking.openURL(link.href).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[styles.linkItem, {backgroundColor: bgColor}]}
      onPress={openLink}
      activeOpacity={0.7}>
      <Text style={[styles.linkPrefix, {color: textColor}]}>{prefix}</Text>
      <View style={styles.linkContent}>
        {link.text ? (
          <Text style={[styles.linkText, {color: textColor}]} numberOfLines={1}>
            {link.text}
          </Text>
        ) : null}
        <Text style={[styles.linkHref, {color: textColor}]} numberOfLines={1}>
          {link.href}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function LinkChangeList({added, removed}: LinkChangeListProps) {
  const {t} = useTranslation();

  if (added.length === 0 && removed.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('diffView.noLinkChanges')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {added.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('diffView.addedLinks')} ({added.length})</Text>
          {added.map((link, i) => (
            <LinkItem key={i} link={link} type="added" />
          ))}
        </View>
      )}
      {removed.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('diffView.removedLinks')} ({removed.length})</Text>
          {removed.map((link, i) => (
            <LinkItem key={i} link={link} type="removed" />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: 6,
    marginBottom: 4,
  },
  linkPrefix: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: spacing.xs,
    lineHeight: 20,
  },
  linkContent: {
    flex: 1,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 2,
  },
  linkHref: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
