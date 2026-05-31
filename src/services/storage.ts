import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback for environments where the native module is missing (like experimental v56)
const memoryStorage: Record<string, string> = {};

const SafeAsyncStorage = {
  getItem: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (e) {
      console.warn(`AsyncStorage.getItem failed for ${key}, using memory fallback`);
      return memoryStorage[key] || null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`AsyncStorage.setItem failed for ${key}, using memory fallback`);
      memoryStorage[key] = value;
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  filePath: string;
  fileType: 'pdf' | 'epub';
  totalPages: number;
  currentPage: number;
  userId?: string;
  createdAt: string;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  pagesRead: number;
  durationMinutes: number;
  readDate: string; // YYYY-MM-DD
  userId?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  bookId: string;
  targetDate: string; // YYYY-MM-DD
  startPage: number;
  currentPage: number;
  totalPages: number;
  userId?: string;
  createdAt: string;
}

export interface Streak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

export interface SyncItem {
  id: string;
  table: 'books' | 'reading_sessions' | 'goals' | 'streaks';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: string;
}

const KEYS = {
  BOOKS: 'readbit_books',
  SESSIONS: 'readbit_sessions',
  GOALS: 'readbit_goals',
  STREAKS: 'readbit_streaks',
  SYNC_QUEUE: 'readbit_sync_queue',
  THEME: 'readbit_theme_preference',
};

export class StorageService {
  // Helper to get item and parse
  private static async getParsed<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const data = await SafeAsyncStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading key ${key}:`, e);
      return defaultValue;
    }
  }

  // Helper to save item
  private static async saveParsed<T>(key: string, data: T): Promise<void> {
    try {
      await SafeAsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving key ${key}:`, e);
    }
  }

  // --- Sync Queue Helpers ---
  private static async addToSyncQueue(
    table: SyncItem['table'],
    action: SyncItem['action'],
    payload: any
  ): Promise<void> {
    const queue = await this.getParsed<SyncItem[]>(KEYS.SYNC_QUEUE, []);
    const syncItem: SyncItem = {
      id: Math.random().toString(36).substring(7),
      table,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };
    queue.push(syncItem);
    await this.saveParsed(KEYS.SYNC_QUEUE, queue);
  }

  public static async getSyncQueue(): Promise<SyncItem[]> {
    return this.getParsed<SyncItem[]>(KEYS.SYNC_QUEUE, []);
  }

  public static async clearSyncQueue(): Promise<void> {
    await SafeAsyncStorage.removeItem(KEYS.SYNC_QUEUE);
  }

  // --- Books CRUD ---
  public static async getBooks(): Promise<Book[]> {
    return this.getParsed<Book[]>(KEYS.BOOKS, []);
  }

  public static async saveBook(book: Book): Promise<void> {
    const books = await this.getBooks();
    const index = books.findIndex((b) => b.id === book.id);
    if (index >= 0) {
      books[index] = book;
      await this.addToSyncQueue('books', 'update', book);
    } else {
      books.push(book);
      await this.addToSyncQueue('books', 'insert', book);
    }
    await this.saveParsed(KEYS.BOOKS, books);
  }

  public static async deleteBook(bookId: string): Promise<void> {
    const books = await this.getBooks();
    const updated = books.filter((b) => b.id !== bookId);
    await this.saveParsed(KEYS.BOOKS, updated);
    await this.addToSyncQueue('books', 'delete', { id: bookId });
    
    // Cleanup linked goals/sessions
    const goals = await this.getGoals();
    await this.saveParsed(KEYS.GOALS, goals.filter((g) => g.bookId !== bookId));
    
    const sessions = await this.getSessions();
    await this.saveParsed(KEYS.SESSIONS, sessions.filter((s) => s.bookId !== bookId));
  }

  // --- Reading Sessions CRUD ---
  public static async getSessions(): Promise<ReadingSession[]> {
    return this.getParsed<ReadingSession[]>(KEYS.SESSIONS, []);
  }

  public static async saveSession(session: ReadingSession): Promise<void> {
    const sessions = await this.getSessions();
    sessions.push(session);
    await this.saveParsed(KEYS.SESSIONS, sessions);
    await this.addToSyncQueue('reading_sessions', 'insert', session);
  }

  // --- Goals CRUD ---
  public static async getGoals(): Promise<Goal[]> {
    return this.getParsed<Goal[]>(KEYS.GOALS, []);
  }

  public static async saveGoal(goal: Goal): Promise<void> {
    const goals = await this.getGoals();
    const index = goals.findIndex((g) => g.id === goal.id || g.bookId === goal.bookId);
    if (index >= 0) {
      goals[index] = { ...goals[index], ...goal };
      await this.addToSyncQueue('goals', 'update', goals[index]);
    } else {
      goals.push(goal);
      await this.addToSyncQueue('goals', 'insert', goal);
    }
    await this.saveParsed(KEYS.GOALS, goals);
  }

  public static async getGoalByBookId(bookId: string): Promise<Goal | null> {
    const goals = await this.getGoals();
    return goals.find((g) => g.bookId === bookId) || null;
  }

  // --- Streak Tracking ---
  public static async getStreak(userId: string = 'guest'): Promise<Streak> {
    const streaks = await this.getParsed<Record<string, Streak>>(KEYS.STREAKS, {});
    if (!streaks[userId]) {
      const defaultStreak: Streak = {
        id: Math.random().toString(36).substring(7),
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      };
      streaks[userId] = defaultStreak;
      await this.saveParsed(KEYS.STREAKS, streaks);
    }
    return streaks[userId];
  }

  public static async saveStreak(streak: Streak): Promise<void> {
    const streaks = await this.getParsed<Record<string, Streak>>(KEYS.STREAKS, {});
    streaks[streak.userId] = streak;
    await this.saveParsed(KEYS.STREAKS, streaks);
    await this.addToSyncQueue('streaks', 'update', streak);
  }

  // --- Settings (Theme) ---
  public static async getThemePreference(): Promise<string> {
    const theme = await SafeAsyncStorage.getItem(KEYS.THEME);
    return theme || 'light';
  }

  public static async setThemePreference(theme: string): Promise<void> {
    await SafeAsyncStorage.setItem(KEYS.THEME, theme);
  }
}

