import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import {
  COMMENT_MAX,
  EXPIRED_MESSAGE,
  countLabel,
  filledStars,
  formatAverage,
  mergeReviewPages,
  reviewerLabel,
  validateReview,
  type Review,
} from '@/features/reviews/reviewsModel';
import { useMyReview, useReviewActions, useReviewEligibility, useReviewList, useReviewSummary } from '@/features/reviews/useReviews';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialIcons key={n} name={n <= value ? 'star' : 'star-border'} size={size} color="#D9A441" />
      ))}
    </View>
  );
}

// Reviews of a listed property. Everyone signed in can read them; only someone who has been a
// resident of the property (a membership) can write one, one per resident, which they can edit or
// delete. The count and average come from Firestore over all reviews, not from the loaded page.
export function ReviewsSection({ propertyId, reviewerName, readOnly = false }: { propertyId: string; reviewerName: string | null; readOnly?: boolean }) {
  const summary = useReviewSummary(propertyId);
  const list = useReviewList(propertyId);
  const mine = useMyReview(propertyId);
  const eligibility = useReviewEligibility(propertyId);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { save, remove } = useReviewActions(propertyId, reviewerName);
  const { confirm, dialog } = useConfirm();

  const reviews = useMemo(() => mergeReviewPages(list.data?.pages ?? []), [list.data]);
  const average = summary.data?.average ?? null;
  const total = summary.data?.count ?? 0;
  const canWrite = eligibility.data === 'open' && reviewerName !== null;

  const removeMine = async () => {
    const ok = await confirm({ title: 'Delete your review?', message: 'It will be removed for everyone.', confirmLabel: 'Delete', destructive: true });
    if (ok) remove.mutate(undefined, { onSuccess: () => setNotice('Your review was deleted.') });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Reviews</Text>
        {summary.data && total > 0 ? (
          <View style={styles.row}>
            <MaterialIcons name="star" size={18} color="#D9A441" />
            <Text style={styles.average}>{formatAverage(average)}</Text>
            <Text style={styles.muted}>· {countLabel(total)}</Text>
          </View>
        ) : null}
      </View>

      {list.isPending ? (
        <ActivityIndicator color={BrandColors.accent} />
      ) : list.isError ? (
        <>
          <Text style={styles.muted}>Couldn’t load reviews.</Text>
          <AppButton label="Retry" variant="secondary" size="sm" onPress={() => list.refetch()} />
        </>
      ) : reviews.length === 0 ? (
        <Text style={styles.muted}>No reviews yet.</Text>
      ) : (
        <>
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} mine={r.id === mine.data?.id} />
          ))}
          {list.hasNextPage ? <AppButton label="Show more reviews" variant="secondary" size="sm" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} /> : null}
          {list.isFetchNextPageError ? <Text style={styles.error}>Couldn’t load more reviews. Try again.</Text> : null}
        </>
      )}

      {readOnly || eligibility.isPending ? null : canWrite ? (
        <View style={styles.actions}>
          <AppButton label={mine.data ? 'Edit your review' : 'Write a review'} icon="rate-review" size="sm" onPress={() => { save.reset(); setEditing(true); }} style={styles.flex} />
          {mine.data ? <AppButton label="Delete" variant="secondary" size="sm" loading={remove.isPending} onPress={removeMine} /> : null}
        </View>
      ) : eligibility.data === 'expired' ? (
        <>
          <Text style={styles.note}>{EXPIRED_MESSAGE}</Text>
          {mine.data ? <AppButton label="Delete your review" variant="secondary" size="sm" loading={remove.isPending} onPress={removeMine} /> : null}
        </>
      ) : (
        <Text style={styles.note}>Only residents who have stayed here can write a review.</Text>
      )}
      {remove.isError ? <Text style={styles.error}>Couldn’t delete your review. Try again.</Text> : null}
      {notice ? <Text style={styles.success} accessibilityRole="alert">{notice}</Text> : null}

      {editing ? (
        <ReviewSheet
          initial={mine.data ?? null}
          busy={save.isPending}
          error={save.isError ? 'Couldn’t save your review. Check your connection and try again.' : null}
          onClose={() => setEditing(false)}
          onSubmit={(input) =>
            save.mutate(
              { input, existing: mine.data != null },
              { onSuccess: () => { setEditing(false); setNotice('Thanks, your review was saved.'); } },
            )
          }
        />
      ) : null}
      {dialog}
    </View>
  );
}

function ReviewCard({ review, mine }: { review: Review; mine: boolean }) {
  const date = review.createdMs === null ? null : new Date(review.createdMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={styles.review}>
      <View style={styles.header}>
        <Text style={styles.name}>{reviewerLabel(review.tenantName)}{mine ? ' (you)' : ''}</Text>
        {date ? <Text style={styles.note}>{date}</Text> : null}
      </View>
      <Stars value={filledStars(review.rating)} />
      {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
    </View>
  );
}

function ReviewSheet({ initial, busy, error, onClose, onSubmit }: { initial: Review | null; busy: boolean; error: string | null; onClose: () => void; onSubmit: (input: { rating: number; comment: string }) => void }) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [shown, setShown] = useState(false);
  const errors = validateReview({ rating, comment });

  const submit = () => {
    if (busy) return;
    setShown(true);
    if (Object.keys(errors).length === 0) onSubmit({ rating, comment });
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.sheetTitle}>{initial ? 'Edit your review' : 'Write a review'}</Text>
          <View style={styles.pick}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`} accessibilityState={{ selected: n === rating }} disabled={busy} onPress={() => setRating(n)} hitSlop={4}>
                <MaterialIcons name={n <= rating ? 'star' : 'star-border'} size={36} color="#D9A441" />
              </Pressable>
            ))}
          </View>
          {shown && errors.rating ? <Text style={styles.error}>{errors.rating}</Text> : null}
          <Field label="Your review" optional value={comment} onChangeText={setComment} maxLength={COMMENT_MAX} multiline numberOfLines={4} textAlignVertical="top" editable={!busy} placeholder="What was it like to stay here?" error={shown ? errors.comment : undefined} />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.row}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.flex} />
            <AppButton variant="submit" label="Save review" loading={busy} onPress={submit} style={styles.flex} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  average: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  note: { fontSize: 12, lineHeight: 17, color: BrandColors.textSecondary },
  name: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  body: { fontSize: 14, lineHeight: 21, color: BrandColors.textPrimary },
  stars: { flexDirection: 'row' },
  review: { gap: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { fontSize: 13, color: BrandColors.error },
  success: { fontSize: 13, fontWeight: '600', color: BrandColors.accent },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { gap: 10, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  pick: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
