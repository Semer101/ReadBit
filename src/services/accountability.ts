import { StorageService, Book, Goal, ReadingSession, Streak } from './storage';
import { SupabaseService } from './supabase';
import { StatsService } from './stats';

export interface BookPacing {
  book: Book;
  goal: Goal | null;
  dailyTarget: number;
  pagesReadToday: number;
  isGoalMetToday: boolean;
  estimatedMinutesRemaining: number;
}

export class AccountabilityService {
  /**
   * Calculates required pages per day to meet the deadline.
   * Formula: (Total Remaining Pages) / (Days Remaining)
   */
  public static calculateDailyTarget(book: Book, goal: Goal): number {
    const remainingPages = book.totalPages - book.currentPage;
    if (remainingPages <= 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(goal.targetDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      // If deadline is today or in the past, user must read all remaining pages today
      return remainingPages;
    }

    return Math.ceil(remainingPages / diffDays);
  }

  /**
   * Estimates remaining reading time in minutes based on user's average speed.
   */
  public static async estimateRemainingTime(book: Book): Promise<number> {
    const stats = await StatsService.getGlobalStats();
    const remainingPages = book.totalPages - book.currentPage;
    if (remainingPages <= 0) return 0;

    // Default to 2 minutes per page if no stats available
    const speed = stats.avgMinutesPerPage > 0 ? stats.avgMinutesPerPage : 2;
    return Math.round(remainingPages * speed);
  }

  /**
   * Gets list of books with their dynamically calculated daily goals and remaining progress
   */
  public static async getBooksWithPacing(): Promise<BookPacing[]> {
    const books = await StorageService.getBooks();
    const goals = await StorageService.getGoals();
    const sessions = await StorageService.getSessions();
    const globalStats = await StatsService.getGlobalStats();

    const todayStr = new Date().toISOString().split('T')[0];

    const pacingData: BookPacing[] = books.map((book) => {
      const goal = goals.find((g) => g.bookId === book.id) || null;
      let dailyTarget = 0;
      if (goal) {
        dailyTarget = this.calculateDailyTarget(book, goal);
      }

      // Calculate pages read today for this book
      const pagesReadToday = sessions
        .filter((s) => s.bookId === book.id && s.readDate === todayStr)
        .reduce((sum, s) => sum + s.pagesRead, 0);

      const isGoalMetToday = dailyTarget > 0 ? pagesReadToday >= dailyTarget : false;

      // Estimate remaining time
      const remainingPages = book.totalPages - book.currentPage;
      const speed = globalStats.avgMinutesPerPage > 0 ? globalStats.avgMinutesPerPage : 2;
      const estimatedMinutesRemaining = Math.round(remainingPages * speed);

      return {
        book,
        goal,
        dailyTarget,
        pagesReadToday,
        isGoalMetToday,
        estimatedMinutesRemaining,
      };
    });

    return pacingData;
  }

  /**
   * Record pages read in a session, updates book state, saves reading session, and triggers streak evaluation
   */
  public static async recordReadingProgress(
    bookId: string,
    pagesRead: number,
    durationMinutes: number,
    userId: string = 'guest'
  ): Promise<void> {
    const books = await StorageService.getBooks();
    const book = books.find((b) => b.id === bookId);
    if (!book) throw new Error('Book not found');

    const prevPage = book.currentPage;
    book.currentPage = Math.min(book.totalPages, book.currentPage + pagesRead);
    await StorageService.saveBook(book);

    // Save reading session
    const todayStr = new Date().toISOString().split('T')[0];
    const session: ReadingSession = {
      id: Math.random().toString(36).substring(7),
      bookId,
      pagesRead,
      durationMinutes,
      readDate: todayStr,
      userId,
      createdAt: new Date().toISOString(),
    };
    await StorageService.saveSession(session);

    // Update goal current page
    const goal = await StorageService.getGoalByBookId(bookId);
    if (goal) {
      goal.currentPage = book.currentPage;
      await StorageService.saveGoal(goal);
    }

    // Check if daily target was met after this progress
    await this.evaluateStreakAndUpdate(userId);

    // Attempt sync
    await SupabaseService.syncOfflineData();
  }

  /**
   * Evaluates streak count on reading actions or app starts.
   * Streaks increment if target met, reset to 0 if missed at midnight.
   */
  public static async evaluateStreakAndUpdate(userId: string = 'guest'): Promise<Streak> {
    const streak = await StorageService.getStreak(userId);
    const booksWithPacing = await this.getBooksWithPacing();

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if any active book goal was met today
    const anyGoalMetToday = booksWithPacing.some((b) => b.isGoalMetToday);

    // Handle Streak state
    if (streak.lastActiveDate === todayStr) {
      // Streak already counted/handled today. Return current streak.
      return streak;
    }

    if (anyGoalMetToday) {
      if (streak.lastActiveDate === yesterdayStr) {
        // Consecutive reading day! Increment streak
        streak.currentStreak += 1;
      } else if (streak.lastActiveDate === null || streak.currentStreak === 0) {
        // First streak day
        streak.currentStreak = 1;
      } else {
        // Last active date was before yesterday. Streak broke but restarts today.
        streak.currentStreak = 1;
      }
      streak.lastActiveDate = todayStr;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      await StorageService.saveStreak(streak);
    } else {
      // If we haven't met any goals today, check if yesterday was missed to reset
      if (
        streak.lastActiveDate !== todayStr &&
        streak.lastActiveDate !== yesterdayStr &&
        streak.lastActiveDate !== null
      ) {
        // Missed yesterday! Streak resets
        streak.currentStreak = 0;
        await StorageService.saveStreak(streak);
      }
    }

    return streak;
  }

  /**
   * Checks at app startup if the streak is broken due to inactivity yesterday
   */
  public static async startupStreakCheck(userId: string = 'guest'): Promise<Streak> {
    const streak = await StorageService.getStreak(userId);
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (
      streak.lastActiveDate !== todayStr &&
      streak.lastActiveDate !== yesterdayStr &&
      streak.lastActiveDate !== null
    ) {
      // Reset streak if last active day was before yesterday
      streak.currentStreak = 0;
      await StorageService.saveStreak(streak);
    }
    return streak;
  }
}
