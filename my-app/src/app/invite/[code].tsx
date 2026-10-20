import { Redirect } from 'expo-router';

// The invite link resolves to this route so it is never "unmatched". The code itself is captured by
// InviteLinkCapture in the root layout; this screen just continues into the app.
export default function InviteRoute() {
  return <Redirect href="/" />;
}
