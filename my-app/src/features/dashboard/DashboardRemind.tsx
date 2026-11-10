import { useMemo } from 'react';
import { Alert, Linking } from 'react-native';

import { missedMonthRows, type PropertyData } from '@/features/dashboard/dashboardModel';
import type { AttentionRow } from '@/features/dashboard/dashboardTypes';
import { RemindDialog } from '@/features/rent/RemindDialog';
import { buildRentReminder, withMessage } from '@/features/rent/reminderModel';
import { AlreadyRemindedError } from '@/features/rent/reminderService';
import { buildLedger } from '@/features/rent/rentModel';
import { useSendRentReminder } from '@/features/rent/useRentReminders';
import { telUrl, whatsAppUrl } from '@/features/tenants/tenantDetailsModel';
import { useResidentDetail } from '@/features/tenants/useAddResident';

type Props = { row: AttentionRow | null; data: readonly PropertyData[]; nowMs: number; onClose: () => void };

/** The Remind dialog for a Needs Attention row: the same reminder the tenant's own screen sends. */
export function DashboardRemind({ row, data, nowMs, onClose }: Props) {
  return row ? <Inner key={row.key} row={row} data={data} nowMs={nowMs} onClose={onClose} /> : null;
}

function Inner({ row, data, nowMs, onClose }: { row: AttentionRow; data: readonly PropertyData[]; nowMs: number; onClose: () => void }) {
  const property = data.find((p) => p.id === row.propertyId);
  const tenant = property?.tenants?.find((t) => t.tenantUid === row.tenantUid) ?? null;
  const sendReminder = useSendRentReminder(row.propertyId);
  const resident = useResidentDetail(row.propertyId, row.tenantUid, tenant?.source === 'added');
  const phone = resident.data?.phone ?? null;

  const reminder = useMemo(() => {
    if (!property || !tenant || !property.charges || !property.payments) return null;
    const ledger = buildLedger(property.charges, property.payments, new Map([[tenant.tenantUid, tenant.name]]), nowMs).filter((r) => r.charge.tenantUid === tenant.tenantUid);
    // Months that fell due since the property was added but were never recorded count too, so the message totals them.
    const missed = missedMonthRows(property, nowMs).filter((m) => m.tenant.tenantUid === tenant.tenantUid).map((m) => m.row);
    const schedule = tenant.status === 'active' && tenant.source === 'added' && tenant.joinedAtMs !== null && tenant.rentInr !== null ? { moveInMs: tenant.joinedAtMs, rentInr: tenant.rentInr } : null;
    return buildRentReminder({ tenantName: tenant.name, propertyName: property.name, rows: [...ledger, ...missed], nowMs, schedule });
  }, [property, tenant, nowMs]);

  const error = sendReminder.isError
    ? sendReminder.error instanceof AlreadyRemindedError
      ? 'You already sent this tenant a reminder for this month today.'
      : 'Could not send the reminder. Check your connection and try again.'
    : null;

  const notify = () => {
    if (!reminder || !tenant?.accountUid) return;
    sendReminder.mutate(
      { tenantUid: tenant.accountUid, reminder },
      {
        onSuccess: () => {
          onClose();
          Alert.alert('Reminder sent', `${tenant.name} has been notified.`);
        },
      },
    );
  };

  return (
    <RemindDialog
      visible
      tenantName={row.name}
      reminder={reminder}
      canNotify={!!tenant?.accountUid}
      busy={sendReminder.isPending}
      error={error}
      callUrl={telUrl(phone)}
      whatsAppUrl={reminder && whatsAppUrl(phone) ? withMessage(whatsAppUrl(phone) as string, reminder.message) : whatsAppUrl(phone)}
      onNotify={notify}
      onOpen={(url) => {
        onClose();
        void Linking.openURL(url).catch(() => Alert.alert('Could not open', 'This device could not open that app.'));
      }}
      onClose={onClose}
    />
  );
}
