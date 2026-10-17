import { Image } from 'react-native';

/** The aperture artwork supplied with the login reference. */
export function ApertureMark({ gold = false }: { gold?: boolean }) {
  return <Image source={require('../../assets/auth/aperture.png')}
    style={{ width: 72, height: 72, tintColor: gold ? '#D9CCA4' : '#193D32' }}
    resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />;
}
