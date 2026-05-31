import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { AppThemeProvider } from '@/hooks/use-app-theme';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  return (
    <AppThemeProvider>
      <AnimatedSplashOverlay />
      <AppTabs />
    </AppThemeProvider>
  );
}
