import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { buildShareMessage, REFERRAL_CREDITS, referralStats, type ReferralRecord } from '@/features/referral/inviteModel';
import { buildInviteUrl } from '@/features/referral/referralService';
import { useAccountProfile } from '@/features/profile/useProfile';
import { useInviteCode, useReferrals } from '@/features/referral/useReferral';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const date = (ms: number | null) =>
  ms === null ? null : new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'send', title: 'Share your link', text: 'Invite another hostel or PG owner using your referral link.' },
  { icon: 'corporate-fare', title: 'They join HOSTELL', text: 'They create an account through your link, and the sign-up is recorded against your code.' },
  { icon: 'insights', title: 'Track referral progress', text: 'See when each person has signed up and when they register a property.' },
];

// Refer & Earn. The user's own code and their own referral records only. Registered (account created
// from the link) and completed (a property registered) are kept apart. Opening or sharing a link is
// not tracked. A completed referral credits the owner (see completeInviteReferral). "Your Referrals"
// starts collapsed; the data is fetched once by the screen, not on each toggle.
export function ReferTab() {
  const code = useInviteCode();
  const referrals = useReferrals();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const url = code.data ? buildInviteUrl(code.data) : null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };
  const share = async () => {
    if (!url) return;
    try {
      await Share.share({ message: buildShareMessage(url) });
    } catch {
      setMessage('Could not open the share sheet.');
    }
  };
  const copy = async (value: string | null, done: string) => {
    if (!value) return;
    try {
      setMessage((await Clipboard.setStringAsync(value)) ? done : 'Could not copy.');
    } catch {
      setMessage('Could not copy.');
    }
  };

  const summary = referrals.isPending
    ? 'Loading…'
    : referrals.isError
      ? 'Unavailable'
      : `${referrals.data.length} ${referrals.data.length === 1 ? 'referral' : 'referrals'}`;

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              Bring another owner to HOSTELL.
            </Text>
            <Text style={styles.body}>
              Share your personal link with hostel and PG owners, and see here when they sign up and register their property. Earn {REFERRAL_CREDITS} credits for every owner who registers a property.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialIcons name="ios-share" size={24} color={BrandColors.accent} />
          </View>
        </View>
        <View style={styles.perks}>
          <Perk icon="link" label="Your link" value="Personal and stable" />
          <Perk icon="verified-user" label="Progress" value="Registered vs completed" />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.spread}>
          <Text style={styles.sectionLabel}>Your referral code</Text>
        </View>
        {code.isPending ? (
          <View style={styles.inlineCenter}>
            <ActivityIndicator color={BrandColors.accent} />
            <Text style={styles.muted}>Preparing your link…</Text>
          </View>
        ) : code.isError ? (
          <View style={styles.gap}>
            <Text style={styles.error}>Couldn’t prepare your invite link. This needs the invite rules to be deployed and a connection.</Text>
            <AppButton variant="secondary" size="sm" label="Retry" onPress={() => code.refetch()} style={styles.selfStart} />
          </View>
        ) : (
          <>
            <View style={styles.codeBox}>
              <Text selectable style={styles.code} accessibilityLabel={`Your referral code ${code.data}`}>
                {code.data}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Copy referral code" onPress={() => copy(code.data, 'Code copied.')} style={styles.copy}>
                <MaterialIcons name="content-copy" size={16} color={BrandColors.accent} />
                <Text style={styles.copyText}>Copy</Text>
              </Pressable>
            </View>
            <AppButton icon="share" label="Share Referral Link" onPress={share} />
            <Pressable accessibilityRole="button" accessibilityLabel="Copy referral link" onPress={() => copy(url, 'Link copied.')} style={styles.linkRow}>
              <MaterialIcons name="link" size={14} color={BrandColors.textSecondary} />
              <Text numberOfLines={1} style={styles.linkText}>
                {url}
              </Text>
            </Pressable>
            {message ? (
              <Text style={styles.muted} accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}
            <Text style={styles.footnote}>
              The link carries your code and opens the HOSTELL app on a phone that has it installed. A web address for it has not been set up yet.
            </Text>
          </>
        )}
      </View>

      <View style={styles.gap}>
        <View style={styles.spread}>
          <Text style={styles.heading}>How it works</Text>
          <Text style={styles.sectionLabel}>3 simple steps</Text>
        </View>
        <View style={styles.card}>
          {STEPS.map((s, i) => (
            <View key={s.title}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.step}>
                <View style={[styles.stepNumber, i === STEPS.length - 1 && styles.stepNumberOn]}>
                  <Text style={[styles.stepNumberText, i === STEPS.length - 1 && { color: BrandColors.surface }]}>{i + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <View style={styles.stepTitleRow}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <MaterialIcons name={s.icon} size={16} color={BrandColors.accent} />
                  </View>
                  <Text style={styles.muted}>{s.text}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Your referrals, ${summary}. ${open ? 'Collapse' : 'Expand'}`}
          onPress={toggle}
          style={styles.accordionHeader}>
          <View style={styles.flex}>
            <Text style={styles.heading}>Your Referrals</Text>
            <Text style={styles.muted}>{summary}</Text>
          </View>
          <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={26} color={BrandColors.textSecondary} />
        </Pressable>
        {open ? (
          referrals.isPending ? (
            <View style={styles.inlineCenter}>
              <ActivityIndicator color={BrandColors.accent} />
            </View>
          ) : referrals.isError ? (
            <View style={styles.gap}>
              <Text style={styles.error}>Couldn’t load your referrals.</Text>
              <AppButton variant="secondary" size="sm" label="Retry" onPress={() => referrals.refetch()} style={styles.selfStart} />
            </View>
          ) : (
            <Referrals records={referrals.data} />
          )
        ) : null}
      </View>
    </View>
  );
}

function Perk({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.perk}>
      <MaterialIcons name={icon} size={18} color={BrandColors.accent} />
      <View style={styles.flex}>
        <Text style={styles.perkLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.perkValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type Filter = 'all' | 'qualified' | 'pending';

// Expanded "Your Referrals". Qualified = the referred account is registered AND completed (registered a
// property). Pending = registered, no property yet. The referred person's name and contact details are never shown to the referrer.
function Referrals({ records }: { records: ReferralRecord[] }) {
  const credits = useAccountProfile().data?.credits ?? 0;
  const [filter, setFilter] = useState<Filter>('all');

  if (records.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <MaterialIcons name="group" size={26} color={BrandColors.textSecondary} />
        </View>
        <Text style={styles.heading}>No referrals yet</Text>
        <Text style={styles.emptyText}>Share your link to invite your first property owner and track their status here.</Text>
      </View>
    );
  }

  const stats = referralStats(records);
  const progress = stats.registered > 0 ? stats.completed / stats.registered : null;
  // Newest first. The number is the order of sign-up (1 = first), so it does not change with a filter.
  const numbered = records.map((r, i) => ({ record: r, number: records.length - i }));
  const shown = numbered.filter(({ record }) => filter === 'all' || (filter === 'qualified' ? record.status === 'completed' : record.status !== 'completed'));
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: stats.registered },
    { key: 'qualified', label: 'Qualified', count: stats.completed },
    { key: 'pending', label: 'Pending', count: stats.pending },
  ];

  return (
    <View style={styles.gap}>
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <View style={styles.spread}>
            <Text style={styles.metricLabel}>Total referrals</Text>
            <View style={styles.metricIcon}>
              <MaterialIcons name="send" size={14} color={BrandColors.accent} />
            </View>
          </View>
          <Text style={styles.metricValue}>{stats.registered}</Text>
          <Text style={styles.muted}>Signed up from your link</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={styles.spread}>
            <Text style={styles.metricLabel}>Qualified</Text>
            <View style={styles.metricIcon}>
              <MaterialIcons name="workspace-premium" size={14} color={BrandColors.accent} />
            </View>
          </View>
          <Text style={styles.metricValue}>{stats.completed}</Text>
          <Text style={styles.muted}>{credits} credits balance</Text>
        </View>
      </View>

      <View style={styles.overview}>
        <View style={styles.titleRow}>
          <MaterialIcons name="card-giftcard" size={18} color={BrandColors.accent} />
          <Text style={styles.sectionLabel}>Referral status overview</Text>
        </View>
        {progress !== null ? (
          <View style={styles.progressTrack} accessibilityLabel={`${stats.completed} of ${stats.registered} referrals have registered a property`}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}
        <View style={styles.tiles}>
          <Tile label="Registered" value={stats.registered} note="Account created" />
          <Tile label="Completed" value={stats.completed} note="Property registered" accent />
          <Tile label="Pending" value={stats.pending} note="Awaiting property" />
        </View>
        <View style={styles.noteRow}>
          <MaterialIcons name="verified" size={16} color={BrandColors.accent} />
          <Text style={styles.noteText}>
            Registered means an account was created from your link. Completed means that owner has registered a property, and earns you {REFERRAL_CREDITS} credits.
          </Text>
        </View>
      </View>

      <View style={styles.chips} accessibilityRole="tablist">
        {chips.map((c) => (
          <Pressable
            key={c.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === c.key }}
            onPress={() => setFilter(c.key)}
            style={[styles.chip, filter === c.key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === c.key && styles.chipTextOn]}>
              {c.label} ({c.count})
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.spread}>
        <Text style={styles.sectionLabel}>Your referrals</Text>
        <Text style={styles.sortLabel}>Sorted by Recent</Text>
      </View>
      {shown.length === 0 ? (
        <Text style={styles.muted}>{filter === 'qualified' ? 'No qualified referrals yet.' : 'No pending referrals.'}</Text>
      ) : (
        shown.map(({ record, number }) => <ReferralCard key={record.id} record={record} number={number} />)
      )}
    </View>
  );
}

function ReferralCard({ record, number }: { record: ReferralRecord; number: number }) {
  const done = record.status === 'completed';
  return (
    <View style={styles.referralCard}>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text style={styles.stepTitle}>Referral {number}</Text>
          <View style={[styles.dot, { backgroundColor: done ? BrandColors.accent : BrandColors.textSecondary }]} />
        </View>
        <Text style={styles.muted}>Signed up from your link</Text>
        <View style={styles.dateRow}>
          <MaterialIcons name="calendar-today" size={13} color={BrandColors.textSecondary} />
          <Text style={styles.muted}>Registered {date(record.registeredMs) ?? 'recently'}</Text>
        </View>
        {done && record.completedMs !== null ? (
          <View style={styles.dateRow}>
            <MaterialIcons name="verified" size={13} color={BrandColors.accent} />
            <Text style={styles.muted}>Qualified {date(record.completedMs)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.badge, done ? styles.badgeOn : styles.badgeOff]}>
          {done ? <MaterialIcons name="check-circle" size={13} color={BrandColors.accent} /> : <View style={styles.badgeDot} />}
          <Text style={[styles.badgeText, done && { color: BrandColors.accent }]}>{done ? 'Qualified' : 'Pending'}</Text>
        </View>
        <Text style={styles.muted}>{done ? 'Property registered' : 'Awaiting property'}</Text>
      </View>
    </View>
  );
}

function Tile({ label, value, note, accent }: { label: string; value: number; note: string; accent?: boolean }) {
  return (
    <View style={[styles.tile, accent && styles.tileAccent]}>
      <Text style={[styles.metricLabel, accent && { color: BrandColors.accent }]}>{label}</Text>
      <Text style={[styles.tileValue, accent && { color: BrandColors.accent }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.muted}>
        {note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: 10 },
  selfStart: { alignSelf: 'flex-start' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inlineCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  hero: { gap: 14, padding: 18, borderRadius: 20, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: BrandColors.textPrimary },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  body: { marginTop: 6, fontSize: 14, lineHeight: 20, color: BrandColors.textSecondary },
  perks: { flexDirection: 'row', gap: 10 },
  perk: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#EEF3F1' },
  perkLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  perkValue: { fontSize: 12, fontWeight: '700', color: BrandColors.textPrimary },
  card: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  heading: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  footnote: { fontSize: 11, color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: BrandColors.canvas },
  code: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: 2, color: BrandColors.textPrimary },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: BrandColors.surface },
  copyText: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  linkText: { flexShrink: 1, fontSize: 11, color: BrandColors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12, marginLeft: 44, backgroundColor: BrandColors.border },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  stepNumberOn: { backgroundColor: BrandColors.accent },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: BrandColors.accent },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  accordionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: BrandColors.canvas },
  emptyText: { maxWidth: 280, textAlign: 'center', fontSize: 13, color: BrandColors.textSecondary },
  metrics: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, gap: 6, padding: 14, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  metricLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  metricIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  metricValue: { fontSize: 28, fontWeight: '800', color: BrandColors.textPrimary },
  overview: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: BrandColors.border },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: BrandColors.accent },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, gap: 2, padding: 10, borderRadius: 12, backgroundColor: BrandColors.canvas },
  tileAccent: { backgroundColor: '#E8F0EE' },
  tileValue: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: BrandColors.textSecondary },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  chipOn: { backgroundColor: BrandColors.textPrimary, borderColor: BrandColors.textPrimary },
  chipText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  chipTextOn: { color: BrandColors.surface },
  sortLabel: { fontSize: 11, fontWeight: '700', color: BrandColors.accent },
  referralCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeOn: { backgroundColor: '#E8F0EE' },
  badgeOff: { backgroundColor: BrandColors.canvas },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.textSecondary },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
});
