import type { FormErrors, PropertyForm } from '@/features/properties/propertySetup';

export type StepProps = {
  form: PropertyForm;
  update: (patch: Partial<PropertyForm>) => void;
  errors: FormErrors;
  /** Show required-field messages (after the owner tried to continue). */
  showErrors: boolean;
  /** Set when the location is already registered to another property; shown above the coordinates. */
  locationError?: string;
};
