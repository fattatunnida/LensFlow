import { Image } from 'react-native';

/** Uses the supplied aperture artwork, including its transparent blade seams. */
export function ApertureMark({ gold = false, size = 72 }: { gold?: boolean; size?: number }) {
  return <Image source={require('../../assets/auth/aperture.png')}
    style={{ width: size, height: size, tintColor: gold ? '#D9CCA4' : '#193B32' }}
    resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />;
}
