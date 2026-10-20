import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import type { Metric } from '@/features/dashboard/dashboardTypes';

type MetricBoundaryProps<T> = {
  metric: Metric<T>;
  /** Rendered only for a successful result. */
  children: (value: T) => ReactNode;
  /** Height of the loading skeleton, to avoid layout jumps. */
  skeletonHeight?: number;
};

// Renders the right state for a metric: skeleton, error with Retry, "not available yet", or data.
export function MetricBoundary<T>({ metric, children, skeletonHeight = 28 }: MetricBoundaryProps<T>) {
  switch (metric.status) {
    case 'loading':
      return (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading"
          style={[styles.skeleton, { height: skeletonHeight }]}
        />
      );
    case 'error':
      return (
        <View style={styles.row}>
          <Text style={styles.note}>Couldn’t load this.</Text>
          <AppButton variant="ghost" size="sm" label="Retry" onPress={metric.retry} />
        </View>
      );
    case 'unavailable':
      return <Text style={styles.note}>Not available yet</Text>;
    case 'ready':
      return <>{children(metric.value)}</>;
  }
}

const styles = StyleSheet.create({
  skeleton: { borderRadius: 8, backgroundColor: BrandColors.border, width: '60%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  note: { fontSize: 14, color: BrandColors.textSecondary },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
});
