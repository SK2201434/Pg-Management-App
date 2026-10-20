# HOSTELL

Your Stay Simplified. HOSTELL is a mobile app for hostel and PG owners and their tenants, built with
React Native, Expo Router, Firebase (Authentication and Firestore), Redux Toolkit and TanStack Query.

## Getting started

```bash
npm install
npx expo start
```

Copy your Firebase settings into the `EXPO_PUBLIC_FIREBASE_*` environment variables (see
`src/config/firebase.ts`).

## Structure

- `src/app/`: routes. `owner/` and `tenant/` each hold one role's tab screens.
- `src/features/auth/`: sign-in, registration, session and profile (role) resolution.
- `src/features/navigation/`: the role-based bottom navigation.
- `src/constants/`: brand, account and theme constants.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```
