import { useWindowDimensions } from 'react-native';

/** Re-evaluates on rotation, split view and window resizing. */
export function useAdaptiveLayout() {
  const { width, height } = useWindowDimensions();
  const tablet = width >= 768 && Math.min(width, height) >= 600;
  const contentWidth = Math.min(width, 1200);
  const gutter = tablet ? 32 : 20;
  const columns = tablet ? (width >= 1180 ? 4 : width >= 1000 ? 3 : 2) : 1;
  return { width, tablet, contentWidth, gutter, columns };
}
