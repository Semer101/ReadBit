import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { StorageService, ReadingSession } from '../services/storage';
import { supabase, SupabaseService, isSupabaseConfigured } from '../services/supabase';
import { StatsService, ReadingStats } from '../services/stats';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppTheme } from '@/constants/theme';

export default function ExploreScreen() {
  const { theme, colors, setTheme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [stats, setStats] = useState({
    totalBooksRead: 0,
    totalDaysRead: 0,
    totalReadingTime: 0,
    avgPagesPerDay: 0,
    avgMinutesPerPage: 0,
  });

  // Auth States
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    checkUserSession();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessionsAndStats();
    }, [])
  );

  const checkUserSession = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadSessionsAndStats = async () => {
    try {
      setLoading(true);
      const allSessions = await StorageService.getSessions();
      setSessions(allSessions);

      const books = await StorageService.getBooks();
      const completedBooks = books.filter((b) => b.currentPage >= b.totalPages && b.totalPages > 0).length;

      const globalStats = await StatsService.getGlobalStats();

      setStats({
        totalBooksRead: completedBooks,
        totalDaysRead: new Set(allSessions.map((s) => s.readDate)).size,
        totalReadingTime: globalStats.totalReadTimeMinutes,
        avgPagesPerDay: Math.round(globalStats.avgPagesPerDay * 10) / 10,
        avgMinutesPerPage: Math.round(globalStats.avgMinutesPerPage * 100) / 100,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!supabase) {
      Alert.alert('Configuration Missing', 'Supabase is not configured yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable cloud sync.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both email and password.');
      return;
    }

    try {
      setLoading(true);
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Success', 'Verification email sent if required. Please check your inbox.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        Alert.alert('Success', 'Logged in successfully.');
        await SupabaseService.pullRemoteData();
        await loadSessionsAndStats();
      }
      setEmail('');
      setPassword('');
    } catch (error: any) {
      Alert.alert('Auth Error', error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      Alert.alert('Logged Out', 'You have been logged out.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Logout failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setLoading(true);
    const success = await SupabaseService.syncOfflineData();
    setLoading(false);
    if (success) {
      Alert.alert('Sync Successful', 'Your offline progress is now backed up securely.');
      await loadSessionsAndStats();
    } else {
      Alert.alert('Sync Skipped', 'Operating locally. Sign in to back up data.');
    }
  };

  // Get last 7 days of reading logs
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayPages = sessions
        .filter((s) => s.readDate === dateStr)
        .reduce((sum, s) => sum + s.pagesRead, 0);

      data.push({ dayName, dayPages });
    }
    return data;
  };

  const last7Days = getLast7DaysData();
  const maxPages = Math.max(...last7Days.map((d) => d.dayPages), 10);

  // Get marked dates for the streak calendar
  const getMarkedDates = () => {
    const marked: any = {};
    sessions.forEach(session => {
      marked[session.readDate] = {
        selected: true,
        selectedColor: colors.accent,
        textColor: '#FFF'
      };
    });
    return marked;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Section: Analytics Title */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reading Analytics</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.totalBooksRead}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Books Read</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.totalDaysRead}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Days</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.totalReadingTime}m</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reading Time</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.avgPagesPerDay}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Pages/Day</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.avgMinutesPerPage}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Min / Page</Text>
          </View>
          <View style={[styles.statBox, { opacity: 0 }]} />
        </View>

        {/* Custom Visual Bar Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Pages Read (Last 7 Days)</Text>
          <View style={styles.chartContainer}>
            {last7Days.map((day, idx) => {
              const barHeightPercent = (day.dayPages / maxPages) * 100;
              return (
                <View key={idx} style={styles.chartCol}>
                  <View style={[styles.chartBarWrapper, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.max(4, barHeightPercent)}%`, backgroundColor: colors.accent },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDayLabel, { color: colors.textSecondary }]}>{day.dayName}</Text>
                  <Text style={[styles.chartPageCount, { color: colors.text }]}>{day.dayPages}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Section: Reading Calendar */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reading Consistency</Text>
        <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, padding: 0, overflow: 'hidden' }]}>
          <Calendar
            theme={{
              backgroundColor: colors.backgroundElement,
              calendarBackground: colors.backgroundElement,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.accent,
              selectedDayTextColor: '#ffffff',
              todayTextColor: colors.accent,
              dayTextColor: colors.text,
              textDisabledColor: colors.backgroundSelected,
              monthTextColor: colors.text,
              indicatorColor: colors.accent,
              arrowColor: colors.accent,
            }}
            markedDates={getMarkedDates()}
          />
        </View>

        {/* Section: Themes */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>App Theme</Text>
        <View style={[styles.accountCard, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.themeGrid}>
            {(['light', 'dark', 'chocolate', 'strawberry', 'mint'] as AppTheme[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: theme === t ? colors.accent : colors.backgroundSelected,
                    borderColor: colors.accent,
                    borderWidth: theme === t ? 2 : 0
                  }
                ]}
                onPress={() => setTheme(t)}
              >
                <Text style={{
                  color: theme === t ? '#FFF' : colors.text,
                  fontWeight: '700',
                  textTransform: 'capitalize'
                }}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section: Accounts & Sync */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account & Synchronization</Text>

        <View style={[styles.accountCard, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.syncStatusHeader, { borderBottomColor: colors.backgroundSelected }]}>
            <TouchableOpacity style={[styles.syncBtn, { backgroundColor: colors.backgroundSelected }]} onPress={handleSyncNow}>
              <Text style={[styles.syncBtnText, { color: colors.accent }]}>🔄 Sync Now</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 10 }} />}

          {user ? (
            <View style={styles.userPanel}>
              <Text style={[styles.userGreeting, { color: colors.textSecondary }]}>Signed in as:</Text>
              <Text style={[styles.userEmail, { color: colors.text }]}>{user.email}</Text>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.authPanel}>
              <Text style={[styles.authInstructions, { color: colors.textSecondary }]}>
                Create an account or login to back up your progress across multiple devices.
              </Text>

              <TextInput
                style={[styles.input, { borderColor: colors.backgroundSelected, color: colors.text }]}
                placeholder="Email Address"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <TextInput
                style={[styles.input, { borderColor: colors.backgroundSelected, color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity style={[styles.authSubmitBtn, { backgroundColor: colors.accent }]} onPress={handleAuth}>
                <Text style={styles.authSubmitBtnText}>
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsRegistering(!isRegistering)}
                style={styles.toggleAuthMode}>
                <Text style={[styles.toggleAuthModeText, { color: colors.accent }]}>
                  {isRegistering
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 0.31,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4F46E5',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
    alignItems: 'flex-end',
    paddingTop: 10,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarWrapper: {
    height: 100,
    justifyContent: 'flex-end',
    width: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 7,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 7,
  },
  chartDayLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '600',
  },
  chartPageCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    marginTop: 2,
  },
  accountCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  syncStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
    marginBottom: 16,
  },
  syncStatusText: {
    fontSize: 12,
    color: '#4B5563',
  },
  syncBtn: {
    backgroundColor: '#EEF2F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  syncBtnText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  userPanel: {
    paddingVertical: 10,
  },
  userGreeting: {
    fontSize: 13,
    color: '#6B7280',
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  authPanel: {
    marginTop: 8,
  },
  authInstructions: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  authSubmitBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  authSubmitBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleAuthMode: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleAuthModeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  themeOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
});
