import { AppButton } from '@/components/app-button';

type AuthButtonProps = { label: string; onPress: () => void; isLoading?: boolean };

// Kept for compatibility: a blue submit button. New code should use AppButton directly.
export function AuthButton({ label, onPress, isLoading = false }: AuthButtonProps) {
  return <AppButton variant="submit" label={label} onPress={onPress} loading={isLoading} />;
}
