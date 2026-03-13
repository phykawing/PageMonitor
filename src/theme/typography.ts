import {StyleSheet} from 'react-native';

export const typography = StyleSheet.create({
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});
