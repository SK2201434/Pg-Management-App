import { Image, StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/constants/brand';

const HOSTELL_LOGO = require('../../../assets/images/assets/Hostell_Logo.png');

// The logo file is a square canvas with the wordmark in the middle band, so the frame crops
// it to the wordmark's ~4:1 shape and the image is shifted to line the text up inside.
export function HostellLogo() {
  return (
    <View style={styles.frame} accessible accessibilityLabel={APP_NAME}>
      <Image source={HOSTELL_LOGO} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 160, height: 40, overflow: 'hidden' },
  image: { width: 168, height: 168, marginLeft: -4, marginTop: -61 },
});
