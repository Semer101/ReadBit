import { createClient } from '@supabase/supabase-js';
import { StorageService, SyncItem } from './storage';

// Replace with actual credentials if available, otherwise fallback to local-only/mock
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// Initialize actual supabase client if credentials are provided
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export class SupabaseService {
  /**
   * Syncs local AsyncStorage queue with Supabase remote DB
   */
  public static async syncOfflineData(): Promise<boolean> {
    if (!supabase) {
      console.log('Supabase not configured. Operating in local-only offline mode.');
      return false;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No user session. Sync skipped.');
        return false;
      }

      const queue = await StorageService.getSyncQueue();
      if (queue.length === 0) {
        return true;
      }

      console.log(`Syncing ${queue.length} items to Supabase...`);

      for (const item of queue) {
        const { table, action, payload } = item;
        // Bind the current user's ID
        const finalPayload = { ...payload, user_id: session.user.id };

        if (table === 'books') {
          if (action === 'insert' || action === 'update') {
            const { error } = await supabase.from('books').upsert(finalPayload);
            if (error) throw error;
          } else if (action === 'delete') {
            const { error } = await supabase.from('books').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (table === 'reading_sessions') {
          if (action === 'insert') {
            const { error } = await supabase.from('reading_sessions').insert(finalPayload);
            if (error) throw error;
          }
        } else if (table === 'goals') {
          if (action === 'insert' || action === 'update') {
            const { error } = await supabase.from('goals').upsert(finalPayload);
            if (error) throw error;
          }
        } else if (table === 'streaks') {
          if (action === 'update') {
            const { error } = await supabase.from('streaks').upsert(finalPayload);
            if (error) throw error;
          }
        }
      }

      await StorageService.clearSyncQueue();
      console.log('Sync completed successfully.');
      return true;
    } catch (error) {
      console.error('Offline sync failed:', error);
      return false;
    }
  }

  /**
   * Pulls all user data from Supabase to local DB (e.g., on login)
   */
  public static async pullRemoteData(): Promise<void> {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Pull Books
      const { data: remoteBooks, error: booksErr } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId);
      
      if (!booksErr && remoteBooks) {
        for (const rBook of remoteBooks) {
          const localBooks = await StorageService.getBooks();
          if (!localBooks.some((b) => b.id === rBook.id)) {
            await StorageService.saveBook({
              id: rBook.id,
              title: rBook.title,
              author: rBook.author,
              filePath: rBook.file_path,
              fileType: rBook.file_type,
              totalPages: rBook.total_pages,
              currentPage: rBook.current_page,
              userId: rBook.user_id,
              createdAt: rBook.created_at,
            });
          }
        }
      }

      // Pull Goals
      const { data: remoteGoals, error: goalsErr } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId);

      if (!goalsErr && remoteGoals) {
        for (const rGoal of remoteGoals) {
          const localGoals = await StorageService.getGoals();
          if (!localGoals.some((g) => g.id === rGoal.id)) {
            await StorageService.saveGoal({
              id: rGoal.id,
              bookId: rGoal.book_id,
              targetDate: rGoal.target_date,
              startPage: rGoal.start_page,
              currentPage: rGoal.current_page,
              totalPages: rGoal.total_pages,
              userId: rGoal.user_id,
              createdAt: rGoal.created_at,
            });
          }
        }
      }

      // Pull Streak
      const { data: remoteStreaks, error: streakErr } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!streakErr && remoteStreaks) {
        await StorageService.saveStreak({
          id: remoteStreaks.id,
          userId: remoteStreaks.user_id,
          currentStreak: remoteStreaks.current_streak,
          longestStreak: remoteStreaks.longest_streak,
          lastActiveDate: remoteStreaks.last_active_date,
        });
      }
    } catch (e) {
      console.error('Failed to pull remote data:', e);
    }
  }
}
