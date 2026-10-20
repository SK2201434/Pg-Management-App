import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Field, formStyles } from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import { getCurrentAddress, getCurrentAddressMessage } from '@/features/properties/currentAddress';
import { LIMITS } from '@/features/properties/propertySetup';

export function DetailsStep({ form, update, errors, showErrors }: StepProps) {
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Fills address, city, state and postal code from the phone's location. Everything stays
  // editable; a part the geocoder could not provide is left as the owner had it.
  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationNotice(null);
    try {
      const found = await getCurrentAddress();
      update({
        location: found.location || form.location,
        city: found.city || form.city,
        state: found.state || form.state,
        postalCode: found.postalCode || form.postalCode,
        // Kept silently; the owner never sees or edits coordinates.
        geo: found.coordinates,
      });
      const missing = [
        !found.location && 'address',
        !found.city && 'city',
        !found.state && 'state',
        !found.postalCode && 'postal code',
      ].filter(Boolean);
      if (missing.length > 0) setLocationNotice(`Please check and enter the ${missing.join(', ')}.`);
    } catch (error) {
      setLocationNotice(getCurrentAddressMessage(error));
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={formStyles.sectionTitle}>Property details</Text>
      <Card>
        <Field
          label="Property name"
          value={form.name}
          onChangeText={(name) => update({ name })}
          placeholder="e.g. Sunrise PG"
          error={showErrors ? errors.name : undefined}
          maxLength={LIMITS.name}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Field
          label="Address / location"
          labelAction={{ label: 'Use current location', onPress: useCurrentLocation, busy: locating }}
          hint={locationNotice ?? undefined}
          value={form.location}
          onChangeText={(location) => update({ location })}
          placeholder="Street, area"
          error={showErrors ? errors.location : undefined}
          maxLength={LIMITS.location}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <View style={formStyles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="City"
              value={form.city}
              onChangeText={(city) => update({ city })}
              error={showErrors ? errors.city : undefined}
              maxLength={LIMITS.city}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="State"
              value={form.state}
              onChangeText={(state) => update({ state })}
              error={showErrors ? errors.state : undefined}
              maxLength={LIMITS.state}
              autoCapitalize="words"
            />
          </View>
        </View>
        <Field
          label="Postal code"
          value={form.postalCode}
          onChangeText={(postalCode) => update({ postalCode })}
          error={showErrors ? errors.postalCode : undefined}
          maxLength={LIMITS.postalCode}
          autoCapitalize="characters"
        />
        <Field
          label="Description"
          optional
          value={form.description}
          onChangeText={(description) => update({ description })}
          placeholder="Facilities, rules, nearby landmarks…"
          maxLength={LIMITS.description}
          multiline
        />
      </Card>
      <Card title="Contact">
        <Field
          label="Contact name"
          value={form.contactName}
          onChangeText={(contactName) => update({ contactName })}
          error={showErrors ? errors.contactName : undefined}
          maxLength={LIMITS.contactName}
          autoCapitalize="words"
          textContentType="name"
        />
        <Field
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={(contactPhone) => update({ contactPhone })}
          error={showErrors ? errors.contactPhone : undefined}
          maxLength={LIMITS.contactPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />
      </Card>
    </View>
  );
}
