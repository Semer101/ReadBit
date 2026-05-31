import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, AppTheme } from '@/constants/theme';
import { StorageService } from '@/services/storage';

type ThemeContextType = {
  theme: AppTheme;
  colors: typeof Colors.light;
  setTheme: (theme: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const savedTheme = await StorageService.getThemePreference() as AppTheme;
    if (savedTheme && Colors[savedTheme]) {
      setThemeState(savedTheme);
    } else {
      setThemeState(systemScheme === 'dark' ? 'dark' : 'light');
    }
  };

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    await StorageService.setThemePreference(newTheme);
  };

  const colors = Colors[theme] || Colors.light;

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
