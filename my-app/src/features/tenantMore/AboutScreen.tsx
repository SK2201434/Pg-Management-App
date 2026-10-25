import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { BrandColors } from '@/constants/theme';
import { HostellLogo } from '@/features/auth/HostellLogo';

// The HOSTELL brand story. The product facts in it are limited to what exists: residents of a
// property (people who joined it with the owner's invite) can review it, while they stay and for 30
// days after they leave. Nothing here is a statistic, testimonial or claim of adoption.
export function AboutScreen() {
  const version = Constants.expoConfig?.version;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `About ${APP_NAME}` }} />

      <View style={styles.hero}>
        <HostellLogo />
        <Text accessibilityRole="header" style={styles.headline}>
          Real hostellers.{'\n'}Real experiences.{'\n'}Better stays.
        </Text>
        <View style={styles.pill}>
          <MaterialIcons name="groups" size={16} color={BrandColors.accent} />
          <Text style={styles.pillText}>Hostellers helping hostellers.</Text>
        </View>
      </View>

      <View style={styles.story}>
        <Text style={styles.lead}>HOSTELL was born from a frustration many hostellers know too well — finding a decent place to stay shouldn’t be this difficult.</Text>
        <Text style={styles.body}>
          A hostel is more than a room or a bed. It’s where we live, rest, study, work, and build a part of our lives. Everyone deserves a place where they feel comfortable, respected, and at home.
        </Text>
        <Text style={styles.body}>We believe the people who know a hostel best are the people living there.</Text>
        <Text style={styles.body}>
          That’s why we’re building HOSTELL around a simple idea: <Text style={styles.strong}>hostellers helping hostellers.</Text>
        </Text>
      </View>

      <View style={styles.callout} accessible accessibilityLabel="Why residents’ reviews matter">
        <View style={styles.calloutIcon}>
          <MaterialIcons name="verified-user" size={22} color={BrandColors.surface} />
        </View>
        <View style={styles.calloutText}>
          <Text style={styles.calloutTitle}>Reviews from the people who live there</Text>
          <Text style={styles.calloutBody}>
            By bringing together property discovery and genuine experiences from verified current residents, we want to help people look beyond pictures and promises and make more informed decisions about where they stay.
          </Text>
          <Text style={styles.calloutNote}>
            On HOSTELL, a review can be written only by someone who joined that property through its owner’s invite, while they stay and for 30 days after they leave.
          </Text>
        </View>
      </View>

      <View style={styles.story}>
        <Text style={styles.body}>
          Every honest experience has the potential to help someone make a better choice. Every hosteller deserves a voice. And every person searching for a place to stay deserves more transparency.
        </Text>
        <Text style={styles.body}>We’re building this movement together, one experience and one better stay at a time.</Text>
      </View>

      <View style={styles.closing}>
        <Text style={styles.closingLine}>Real hostellers. Honest experiences. A community that cares.</Text>
        <Text style={styles.welcome}>Welcome to HOSTELL.</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        {version ? <Text style={styles.meta}>Version {version}</Text> : null}
        <Text style={styles.meta}>Terms and privacy documents have not been published yet.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  hero: { gap: 16, paddingHorizontal: 4, paddingVertical: 8 },
  headline: { fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5, color: BrandColors.textPrimary },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E8F0EE' },
  pillText: { fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  story: { gap: 14, paddingHorizontal: 4 },
  lead: { fontSize: 18, lineHeight: 28, fontWeight: '700', color: BrandColors.textPrimary },
  body: { fontSize: 15, lineHeight: 24, color: BrandColors.textPrimary },
  strong: { fontWeight: '800', color: BrandColors.accent },
  callout: { flexDirection: 'row', gap: 14, padding: 18, borderRadius: 18, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.accent },
  calloutIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.accent },
  calloutText: { flex: 1, minWidth: 0, gap: 8 },
  calloutTitle: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  calloutBody: { fontSize: 14, lineHeight: 22, color: BrandColors.textPrimary },
  calloutNote: { fontSize: 12, lineHeight: 18, color: BrandColors.textSecondary },
  closing: { gap: 6, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  closingLine: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: BrandColors.textPrimary },
  welcome: { fontSize: 15, fontWeight: '700', color: BrandColors.accent },
  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  tagline: { fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BrandColors.textSecondary },
  meta: { fontSize: 12, textAlign: 'center', color: BrandColors.textSecondary },
});
