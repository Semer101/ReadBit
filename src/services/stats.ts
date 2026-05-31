import { StorageService, ReadingSession } from './storage';

export interface ReadingStats {
  totalReadTimeMinutes: number;
  totalReadPages: number;
  avgMinutesPerPage: number;
  avgPagesPerDay: number;
  sessionsCount: number;
  pagesPerSession: number;
}

export class StatsService {
  /**
   * Calculates overall reading statistics based on all recorded sessions.
   */
  public static async getGlobalStats(): Promise<ReadingStats> {
    const sessions = await StorageService.getSessions();

    if (sessions.length === 0) {
      return {
        totalReadTimeMinutes: 0,
        totalReadPages: 0,
        avgMinutesPerPage: 0,
        avgPagesPerDay: 0,
        sessionsCount: 0,
        pagesPerSession: 0,
      };
    }

    const totalReadTimeMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalReadPages = sessions.reduce((sum, s) => sum + s.pagesRead, 0);

    // Calculate unique reading days
    const uniqueDays = new Set(sessions.map(s => s.readDate)).size;

    return {
      totalReadTimeMinutes,
      totalReadPages,
      avgMinutesPerPage: totalReadPages > 0 ? totalReadTimeMinutes / totalReadPages : 0,
      avgPagesPerDay: uniqueDays > 0 ? totalReadPages / uniqueDays : 0,
      sessionsCount: sessions.length,
      pagesPerSession: totalReadPages / sessions.length,
    };
  }

  /**
   * Calculates reading statistics for a specific book.
   */
  public static async getBookStats(bookId: string): Promise<ReadingStats> {
    const allSessions = await StorageService.getSessions();
    const sessions = allSessions.filter(s => s.bookId === bookId);

    if (sessions.length === 0) {
      return {
        totalReadTimeMinutes: 0,
        totalReadPages: 0,
        avgMinutesPerPage: 0,
        avgPagesPerDay: 0,
        sessionsCount: 0,
        pagesPerSession: 0,
      };
    }

    const totalReadTimeMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalReadPages = sessions.reduce((sum, s) => sum + s.pagesRead, 0);
    const uniqueDays = new Set(sessions.map(s => s.readDate)).size;

    return {
      totalReadTimeMinutes,
      totalReadPages,
      avgMinutesPerPage: totalReadPages > 0 ? totalReadTimeMinutes / totalReadPages : 0,
      avgPagesPerDay: uniqueDays > 0 ? totalReadPages / uniqueDays : 0,
      sessionsCount: sessions.length,
      pagesPerSession: totalReadPages / sessions.length,
    };
  }
}
