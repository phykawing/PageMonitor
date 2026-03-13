import React from 'react';
import {ScrollView, View, Text, StyleSheet} from 'react-native';
import type {Change} from 'diff';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';

interface DiffRendererProps {
  changes: Change[];
}

export function DiffRenderer({changes}: DiffRendererProps) {
  if (!changes || changes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No text changes</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {changes.map((change, index) => {
        if (!change.added && !change.removed) {
          // Unchanged context: show a truncated preview
          const lines = change.value.split('\n').filter(l => l.trim());
          if (lines.length === 0) return null;
          const preview = lines.slice(0, 3).join('\n');
          const hasMore = lines.length > 3;
          return (
            <View key={index} style={styles.unchangedBlock}>
              <Text style={styles.unchangedText}>{preview}</Text>
              {hasMore && (
                <Text style={styles.ellipsis}>
                  … {lines.length - 3} more line{lines.length - 3 > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          );
        }

        const bgColor = change.added ? colors.diffAdded : colors.diffRemoved;
        const textColor = change.added ? colors.diffAddedText : colors.diffRemovedText;
        const prefix = change.added ? '+' : '−';

        return (
          <View key={index} style={[styles.changeLine, {backgroundColor: bgColor}]}>
            <Text style={[styles.prefix, {color: textColor}]}>{prefix}</Text>
            <Text style={[styles.changeText, {color: textColor}]}>{change.value}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.sm,
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
  unchangedBlock: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginVertical: 1,
  },
  unchangedText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ellipsis: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textDisabled,
    fontStyle: 'italic',
  },
  changeLine: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: 1,
    borderRadius: 3,
  },
  prefix: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    marginRight: spacing.sm,
    width: 14,
  },
  changeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
