import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { BrandColors } from '@/constants/theme';
import { cleanPolicy, NOTICE_CHOICES, policySummary, samePolicy, type MoveOutPolicy } from '@/features/moveOut/moveOutModel';
import { cleanRules, MAX_RULES, RULE_MAX, sameRules } from '@/features/properties/houseRulesModel';
import { parsePropertyId } from '@/features/properties/propertyDetailsModel';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { useHouseRules, useSaveHouseRules } from '@/features/properties/useHouseRules';

type Row = { key: number; text: string; focus: boolean };

let lastKey = 0;
const makeRow = (text: string, focus: boolean): Row => ({ key: ++lastKey, text, focus });

// Property rules: a numbered list. It opens with "1." ready to type; pressing Enter starts the
// next number ("2.", "3." ...). Empty lines are dropped when saved.
export function HouseRulesScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const rules = useHouseRules(propertyId);
  const header = <Stack.Screen options={{ title: 'Property rules' }} />;

  if (propertyId === null) return <Message header={header} icon="search-off" title="Property not found" body="This link does not point to a property." />;
  if (rules.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (rules.isError) return <Message header={header} icon="error-outline" title="Couldn’t load the rules" body={getPropertyErrorMessage(rules.error)} onRetry={() => rules.refetch()} />;
  return <RulesEditor propertyId={propertyId} initial={rules.data.rules} initialPolicy={rules.data.policy} header={header} />;
}

function RulesEditor({ propertyId, initial, initialPolicy, header }: { propertyId: string; initial: string[]; initialPolicy: MoveOutPolicy; header: React.ReactNode }) {
  const [rows, setRows] = useState<Row[]>(() => (initial.length > 0 ? initial.map((t) => makeRow(t, false)) : [makeRow('', true)]));
  const [policy, setPolicy] = useState<MoveOutPolicy>(initialPolicy);
  const save = useSaveHouseRules(propertyId);

  const cleaned = cleanRules(rows.map((r) => r.text));
  const changed = !sameRules(cleaned, initial) || !samePolicy(cleanPolicy(policy), initialPolicy);

  const setText = (key: number, text: string) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, text } : r)));
  // Enter: a new numbered line right after this one, focused. Nothing is added after an empty line.
  const addAfter = (key: number) =>
    setRows((cur) => {
      const i = cur.findIndex((r) => r.key === key);
      if (i < 0 || cur[i].text.trim() === '' || cur.length >= MAX_RULES) return cur;
      const unfocused = cur.map((r) => ({ ...r, focus: false }));
      return [...unfocused.slice(0, i + 1), makeRow('', true), ...unfocused.slice(i + 1)];
    });
  const remove = (key: number) => setRows((cur) => (cur.length > 1 ? cur.filter((r) => r.key !== key) : cur.map((r) => ({ ...r, text: '' }))));

  const submit = () => {
    save.mutate({ rules: cleaned, policy: cleanPolicy(policy) }, { onSuccess: () => router.back() });
  };

  return (
    <View style={styles.screen}>
      {header}
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Write the rules tenants should follow. Press Enter after each rule to add the next one.</Text>
        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.number}>{i + 1}.</Text>
              <TextInput
                value={row.text}
                onChangeText={(t) => setText(row.key, t)}
                onSubmitEditing={() => addAfter(row.key)}
                autoFocus={row.focus}
                submitBehavior="submit"
                returnKeyType="next"
                placeholder={i === 0 ? 'e.g. Gate closes at 10 PM' : 'Next rule'}
                placeholderTextColor={BrandColors.textSecondary}
                maxLength={RULE_MAX}
                accessibilityLabel={`Rule ${i + 1}`}
                style={styles.input}
              />
              {rows.length > 1 || row.text !== '' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove rule ${i + 1}`} hitSlop={8} onPress={() => remove(row.key)}>
                  <MaterialIcons name="close" size={20} color={BrandColors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Move-out options</Text>
        <Text style={styles.intro}>Choose how tenants may move out. They pick one of these when they request to move out, and you approve it.</Text>
        <View style={styles.card}>
          <View style={styles.policyRow}>
            <Text style={styles.policyLabel}>Allow moving out right away</Text>
            <Switch value={policy.instant} onValueChange={(instant) => setPolicy((p) => ({ ...p, instant }))} trackColor={{ true: BrandColors.accent }} accessibilityLabel="Allow moving out right away" />
          </View>
          <Text style={styles.policyLabel}>Notice periods offered</Text>
          <View style={styles.chips}>
            {NOTICE_CHOICES.map((m) => {
              const on = policy.noticeMonths.includes(m);
              return (
                <Pressable
                  key={m}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setPolicy((p) => ({ ...p, noticeMonths: on ? p.noticeMonths.filter((x) => x !== m) : [...p.noticeMonths, m] }))}
                  style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{m} {m === 1 ? 'month' : 'months'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.muted}>{policySummary(cleanPolicy(policy))}</Text>
        </View>
        {rows.length >= MAX_RULES ? <Text style={styles.muted}>You have reached the limit of {MAX_RULES} rules.</Text> : null}
        {save.isError ? <Text style={styles.error} accessibilityRole="alert">{getPropertyErrorMessage(save.error)}</Text> : null}
      </AppScrollView>
      <View style={styles.footer}>
        <AppButton label="Save rules" variant="submit" loading={save.isPending} disabled={!changed} onPress={submit} />
      </View>
    </View>
  );
}

function Message({ header, icon, title, body, onRetry }: { header: React.ReactNode; icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string; body: string; onRetry?: () => void }) {
  return (
    <View style={[styles.screen, styles.center]}>
      {header}
      <MaterialIcons name={icon} size={28} color={BrandColors.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.mutedCenter}>{body}</Text>
      {onRetry ? <AppButton label="Retry" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  sectionTitle: { marginTop: 8, fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  policyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  policyLabel: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  chipOn: { borderColor: BrandColors.accent, backgroundColor: '#E8F0EE' },
  chipText: { fontSize: 13, fontWeight: '600', color: BrandColors.textSecondary },
  chipTextOn: { color: BrandColors.accent },
  intro: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  card: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46 },
  number: { width: 28, fontSize: 15, fontWeight: '700', color: BrandColors.accent },
  input: { flex: 1, minHeight: 44, fontSize: 15, color: BrandColors.textPrimary },
  footer: { padding: 16, backgroundColor: BrandColors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  title: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  mutedCenter: { fontSize: 13, textAlign: 'center', color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  retry: { alignSelf: 'stretch', marginTop: 8 },
});
