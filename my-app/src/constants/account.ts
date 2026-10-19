/**
 * Roles an account can hold. Exactly one at a time. The role in a user profile is authorization
 * and must only ever be assigned by a trusted provisioning workflow, never by the client.
 */
export const AccountRoles = {
  Tenant: 'tenant',
  Owner: 'owner',
} as const;

export type AccountRole = (typeof AccountRoles)[keyof typeof AccountRoles];

/**
 * The kind of account chosen at sign-up. It uses the same values as the role, but a value the
 * user picked on the Create Account screen is only signup intent, not authorization.
 */
export type AccountType = AccountRole;

/** Whether an account may use the app. There is no approval step: new accounts are `active`. */
export const AccountStatuses = {
  Active: 'active',
  Disabled: 'disabled',
} as const;

export type AccountStatus = (typeof AccountStatuses)[keyof typeof AccountStatuses];
