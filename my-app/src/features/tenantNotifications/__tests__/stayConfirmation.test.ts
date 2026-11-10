import { buildStayConfirmationNotifications } from '@/features/tenantNotifications/tenantNotificationsModel';

describe('buildStayConfirmationNotifications', () => {
  it('says nothing unless an owner has to confirm the tenant', () => {
    expect(buildStayConfirmationNotifications(false)).toEqual([]);
  });

  it('gives one stable notice that reveals no property, room or bed', () => {
    const [n, ...rest] = buildStayConfirmationNotifications(true);
    expect(rest).toEqual([]);
    expect(n).toMatchObject({ id: 'stay-confirmation_pending', kind: 'stay-confirmation', target: 'stay', atMs: null, propertyId: '', propertyName: '' });
    expect(n.body).toMatch(/owner has been sent a notification/i);
    expect(n.body).not.toMatch(/room|bed|\d/i);
  });
});
