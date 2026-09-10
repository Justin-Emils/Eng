import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Uses useSyncExternalStore so the server/static snapshot returns 'light' (no hydration of
 * 'dark' during SSR) while the client snapshot reflects the real color scheme, and re-renders
 * once mounted without calling setState synchronously inside an effect.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!isClient) {
    return 'light';
  }
  return colorScheme === 'dark' ? 'dark' : 'light';
}
