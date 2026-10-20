import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import {
  PropertySaveSession,
  type SaveProgress,
  type SaveResult,
} from '@/features/properties/propertyCreation';
import type { PropertyForm } from '@/features/properties/propertySetup';
import { ownerPropertiesQueryKey } from '@/features/properties/usePropertyQueries';
import { useAppSelector } from '@/store/hooks';

/**
 * Saves the Add Property form. The save session lives as long as the screen, so "Retry" after a
 * failure resumes the same property (same id, rooms and uploaded photos) rather than starting a
 * second one. The list is refreshed whether the save succeeded or stopped half way, because a
 * draft may exist either way.
 */
export function useAddProperty() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const session = useRef<PropertySaveSession | null>(null);
  const [progress, setProgress] = useState<SaveProgress | null>(null);

  const mutation = useMutation<SaveResult, Error, PropertyForm>({
    mutationFn: (form) => {
      if (ownerUid === undefined) throw new Error('Not signed in.');
      session.current ??= new PropertySaveSession(ownerUid);
      return session.current.run(form, setProgress);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });

  return { ...mutation, progress, save: mutation.mutate };
}
