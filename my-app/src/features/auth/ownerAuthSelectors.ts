import type { RootState } from '@/store/store';

export const selectOwner = (state: RootState) => state.ownerAuth.owner;
export const selectIsAuthenticated = (state: RootState) => state.ownerAuth.isAuthenticated;
export const selectIsInitialized = (state: RootState) => state.ownerAuth.isInitialized;
export const selectAuthLoading = (state: RootState) => state.ownerAuth.loading;
export const selectAuthErrors = (state: RootState) => state.ownerAuth.errors;
export const selectVerificationEmailFailed = (state: RootState) =>
  state.ownerAuth.verificationEmailFailed;
