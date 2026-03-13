import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors} from '../theme/colors';

type Status = 'ok' | 'changed' | 'error' | 'pending';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<Status, string> = {
  ok: colors.statusOk,
  changed: colors.statusChanged,
  error: colors.statusError,
  pending: colors.statusPending,
};

export function StatusBadge({status, size = 'md'}: StatusBadgeProps) {
  const dotSize = size === 'sm' ? 8 : 10;
  return (
    <View
      style={[
        styles.dot,
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: STATUS_COLORS[status] ?? colors.statusPending,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    alignSelf: 'center',
  },
});
