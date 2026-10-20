import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { getPropertyErrorMessage, PropertyRequestError } from '@/features/properties/propertyService';
import type { PropertyDetail } from '@/features/properties/propertyTypes';
import { usePropertyDetail } from '@/features/properties/usePropertyQueries';

const goToProperties = () => router.replace('/owner/properties');

// Loads the property for a nested property page and handles every way that can fail: invalid id,
// not found, not the signed-in owner's, network error. Children render only for the owner's own
// property, with the property name as the header's second line.
export function PropertyGate({
  propertyId,
  title,
  children,
}: {
  propertyId: string | null;
  title: string;
  children: (property: PropertyDetail) => ReactNode;
}) {
  const property = usePropertyDetail(propertyId);
  const header = <Stack.Screen options={{ title, headerTitle: property.data?.name ?? '' }} />;

  if (propertyId === null) {
    return (
      <Shell>
        {header}
        <StateCard icon="search-off" title="Property not found" message="This link does not point to a property." actionLabel="Back to properties" onAction={goToProperties} />
      </Shell>
    );
  }
  if (property.isPending) {
    return (
      <Shell>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={BrandColors.accent} />
          <Text style={styles.muted}>Loading property…</Text>
        </View>
      </Shell>
    );
  }
  if (property.isError) {
    const kind = property.error instanceof PropertyRequestError ? property.error.kind : 'unknown';
    const blocked = kind === 'not-found' || kind === 'permission-denied';
    return (
      <Shell>
        {header}
        <StateCard
          icon={kind === 'permission-denied' ? 'lock-outline' : blocked ? 'search-off' : 'error-outline'}
          title={kind === 'permission-denied' ? 'No access to this property' : kind === 'not-found' ? 'Property not found' : 'Couldn’t load property'}
          message={blocked ? 'This property is not available to your account.' : getPropertyErrorMessage(property.error)}
          actionLabel={blocked ? 'Back to properties' : 'Retry'}
          onAction={blocked ? goToProperties : () => property.refetch()}
        />
      </Shell>
    );
  }
  return (
    <>
      {header}
      {children(property.data)}
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
});
