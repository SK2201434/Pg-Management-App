import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { Card, Chip, Field, formStyles } from '@/features/properties/addProperty/formParts';
import type { StepProps } from '@/features/properties/addProperty/stepTypes';
import { getCurrentAddress, getCurrentAddressMessage } from '@/features/properties/currentAddress';
import { parseGeo, splitCoordinatePair } from '@/features/properties/propertyLocation';
import { AMENITIES, LIMITS, PROPERTY_TYPES } from '@/features/properties/propertySetup';
import { ErrorText } from '@/components/form-error-scroll';

export function DetailsStep({ form, update, errors, showErrors, locationError }: StepProps) {
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  // The coordinate fields hold text while being typed; the form gets them only once both are valid.
  const [latText, setLatText] = useState(form.geo ? String(form.geo.latitude) : '');
  const [lngText, setLngText] = useState(form.geo ? String(form.geo.longitude) : '');
  const [showTip, setShowTip] = useState(false);
  const parsed = parseGeo(latText, lngText);

  const setCoordinates = (lat: string, lng: string) => {
    setLatText(lat);
    setLngText(lng);
    update({ geo: parseGeo(lat, lng).geo });
  };
  const changeLat = (text: string) => {
    // A "lat, lng" pair copied from Google Maps fills both fields.
    const pair = splitCoordinatePair(text);
    if (pair) setCoordinates(pair[0], pair[1]);
    else setCoordinates(text, lngText);
  };

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
        geo: found.coordinates,
      });
      setLatText(String(found.coordinates.latitude));
      setLngText(String(found.coordinates.longitude));
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
        <View style={{ gap: 6 }}>
          <Text style={styles.coordsTitle}>Property type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {PROPERTY_TYPES.map((type) => (
              <Chip key={type} label={type} selected={form.propertyType === type} onPress={() => update({ propertyType: type })} />
            ))}
          </View>
          {showErrors && errors.propertyType ? (
            <ErrorText style={styles.typeError} accessibilityRole="alert">{errors.propertyType}</ErrorText>
          ) : null}
        </View>
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
        {locationError ? (
          <View style={styles.locationError} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        ) : null}
        <View style={styles.coordsHeader}>
          <Text style={styles.coordsTitle}>Location coordinates <Text style={styles.optional}>(optional)</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="How to get coordinates from Google Maps" hitSlop={10} onPress={() => setShowTip((v) => !v)}>
            <MaterialIcons name="info-outline" size={20} color={BrandColors.accent} />
          </Pressable>
        </View>
        {showTip ? (
          <View style={styles.tip}>
            <Text style={styles.tipText}>
              In Google Maps, press and hold the exact spot of your property. A pin drops and the coordinates (like 12.971599, 77.594566) appear at the top or bottom. Tap them to copy, then paste into Latitude — both fields fill in.
            </Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.google.com/maps')}>
              <Text style={styles.tipLink}>Open Google Maps</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={formStyles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Latitude" value={latText} onChangeText={changeLat} placeholder="e.g. 12.971599" keyboardType="numbers-and-punctuation" autoCorrect={false} error={parsed.latError ?? (locationError ? ' ' : undefined)} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Longitude" value={lngText} onChangeText={(t) => setCoordinates(latText, t)} placeholder="e.g. 77.594566" keyboardType="numbers-and-punctuation" autoCorrect={false} error={parsed.lngError ?? (locationError ? ' ' : undefined)} />
          </View>
        </View>
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
      <Card title="Amenities">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AMENITIES.map((a) => (
            <Chip
              key={a.key}
              label={a.label}
              selected={form.amenities.includes(a.key)}
              onPress={() => update({ amenities: form.amenities.includes(a.key) ? form.amenities.filter((k) => k !== a.key) : [...form.amenities, a.key] })}
            />
          ))}
        </View>
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

const styles = StyleSheet.create({
  locationError: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: BrandColors.error },
  coordsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coordsTitle: { fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  optional: { fontWeight: '400', color: BrandColors.textSecondary },
  tip: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: BrandColors.background },
  tipText: { fontSize: 13, color: BrandColors.textSecondary },
  tipLink: { fontSize: 13, fontWeight: '600', color: BrandColors.accent },
  typeError: { fontSize: 12, color: BrandColors.error },
  locationErrorText: { fontSize: 13, color: BrandColors.error },
});
