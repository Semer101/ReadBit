import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Pdf from 'react-native-pdf';
import { StorageService, Book, Goal, Streak } from '../services/storage';
import { AccountabilityService } from '../services/accountability';
import { SupabaseService } from '../services/supabase';
import { useAppTheme } from '@/hooks/use-app-theme';
import { NotificationService } from '../services/notifications';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
  const { colors } = useAppTheme();
  const [booksWithPacing, setBooksWithPacing] = useState<any[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [addBookModalVisible, setAddBookModalVisible] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookTotalPages, setNewBookTotalPages] = useState('150');
  const [newBookFileType, setNewBookFileType] = useState<'epub' | 'pdf'>('epub');
  const [targetDate, setTargetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  // Active Reader states
  const [readerVisible, setReaderVisible] = useState(false);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [readerCurrentPage, setReaderCurrentPage] = useState(1);
  const [readerTotalPages, setReaderTotalPages] = useState(1);
  const [readerFontSize, setReaderFontSize] = useState(16);
  const [readerTheme, setReaderTheme] = useState<'light' | 'dark'>('light');
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  useEffect(() => {
    loadData();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    await NotificationService.registerForPushNotificationsAsync();
    // Default reminder at 8:00 PM (20:00)
    await NotificationService.scheduleDailyReminder(20, 0);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Run streak startup checks
      await AccountabilityService.startupStreakCheck();
      const pacingData = await AccountabilityService.getBooksWithPacing();
      const currentStreak = await StorageService.getStreak();
      setBooksWithPacing(pacingData);
      setStreak(currentStreak);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        
        // Auto-extract metadata (name and extension)
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const parts = nameWithoutExt.split(' - ');
        setNewBookTitle(parts[0] || file.name);
        setNewBookAuthor(parts[1] || 'Unknown Author');
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        setNewBookFileType(isPdf ? 'pdf' : 'epub');
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleCreateBookAndGoal = async () => {
    if (!newBookTitle.trim() || !newBookTotalPages.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Title and Total Pages.');
      return;
    }

    const pages = parseInt(newBookTotalPages);
    if (isNaN(pages) || pages <= 0) {
      Alert.alert('Invalid Input', 'Total pages must be a valid positive number.');
      return;
    }

    try {
      setLoading(true);
      const bookId = Math.random().toString(36).substring(7);
      
      const newBook: Book = {
        id: bookId,
        title: newBookTitle,
        author: newBookAuthor || 'Unknown Author',
        filePath: selectedFile?.uri || 'local-file-placeholder',
        fileType: newBookFileType,
        totalPages: pages,
        currentPage: 0,
        createdAt: new Date().toISOString(),
      };

      const newGoal: Goal = {
        id: Math.random().toString(36).substring(7),
        bookId,
        targetDate: targetDate.toISOString().split('T')[0],
        startPage: 0,
        currentPage: 0,
        totalPages: pages,
        createdAt: new Date().toISOString(),
      };

      // Save locally
      await StorageService.saveBook(newBook);
      await StorageService.saveGoal(newGoal);

      // Reset states
      setAddBookModalVisible(false);
      setNewBookTitle('');
      setNewBookAuthor('');
      setNewBookTotalPages('150');
      setSelectedFile(null);
      setTargetDate('');

      Alert.alert('Success', 'Book imported and completion goal set successfully.');
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to import book.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = (bookId: string) => {
    Alert.alert(
      'Delete Book',
      'Are you sure you want to remove this book and its reading goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteBook(bookId);
            await loadData();
          },
        },
      ]
    );
  };

  const handleOpenReader = (book: Book) => {
    setActiveBook(book);
    setReaderCurrentPage(book.currentPage || 1);
    setSessionStartTime(Date.now());
    setReaderVisible(true);
  };

  const handleCloseReader = async () => {
    if (!activeBook) return;

    const durationMs = Date.now() - sessionStartTime;
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const pagesRead = Math.max(0, readerCurrentPage - activeBook.currentPage);

    try {
      setLoading(true);
      if (pagesRead > 0) {
        await AccountabilityService.recordReadingProgress(
          activeBook.id,
          pagesRead,
          durationMinutes
        );
        Alert.alert(
          'Session Complete',
          `You read ${pagesRead} pages in ${durationMinutes} min! Progress saved successfully.`
        );
      }
      setReaderVisible(false);
      setActiveBook(null);
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save session progress.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Streak Dashboard Card */}
        <View style={[styles.streakCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View style={styles.streakInfo}>
            <Text style={[styles.streakCount, { color: colors.text }]}>
              {streak?.currentStreak || 0} Day Reading Streak
            </Text>
            <Text style={[styles.streakSubtext, { color: colors.textSecondary }]}>
              Longest Streak: {streak?.longestStreak || 0} days | Last Read:{' '}
              {streak?.lastActiveDate || 'Never'}
            </Text>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Digital Library</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              // Set default target completion date to 30 days from now
              const d = new Date();
              d.setDate(d.getDate() + 30);
              setTargetDate(d);
              setAddBookModalVisible(true);
            }}>
            <Text style={styles.addButtonText}>+ Import Book</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 20 }} />}

        {/* Books List */}
        {!loading && booksWithPacing.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Your library is empty.</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Import an EPUB or PDF to start your streak tracking & dynamic pacing!
            </Text>
          </View>
        ) : (
          booksWithPacing.map(({ book, goal, dailyTarget, pagesReadToday, isGoalMetToday, estimatedMinutesRemaining }) => {
            const progressPercent = book.totalPages > 0 
              ? Math.round((book.currentPage / book.totalPages) * 100)
              : 0;

            return (
              <View key={book.id} style={[styles.bookCard, { backgroundColor: colors.backgroundElement }]}>
                <View style={styles.bookDetailsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={1}>
                      {book.title}
                    </Text>
                    <Text style={[styles.bookAuthor, { color: colors.textSecondary }]}>{book.author}</Text>
                  </View>
                  <Text style={[styles.fileBadge, { backgroundColor: book.fileType === 'pdf' ? '#EF4444' : '#10B981' }]}>
                    {book.fileType.toUpperCase()}
                  </Text>
                </View>

                {/* Goals & Dynamic Pacing Section */}
                {goal ? (
                  <View style={[styles.goalSection, { backgroundColor: colors.backgroundSelected }]}>
                    <View style={styles.goalRow}>
                      <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>Completion Goal:</Text>
                      <Text style={[styles.goalValue, { color: colors.text }]}>{goal.targetDate}</Text>
                    </View>
                    <View style={styles.goalRow}>
                      <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>Daily Target Pacing:</Text>
                      <Text style={[styles.goalValue, { fontWeight: '700', color: isGoalMetToday ? '#10B981' : colors.accent }]}>
                        {isGoalMetToday ? 'Goal Met Today!' : `Read ${dailyTarget} pages today`}
                      </Text>
                    </View>
                    <View style={styles.goalRow}>
                      <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>Read Today:</Text>
                      <Text style={[styles.goalValue, { color: colors.text }]}>
                        {pagesReadToday} / {dailyTarget} pages
                      </Text>
                    </View>
                    <View style={styles.goalRow}>
                      <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>Est. Time Remaining:</Text>
                      <Text style={[styles.goalValue, { color: colors.text }]}>
                        {estimatedMinutesRemaining >= 60
                          ? `${Math.floor(estimatedMinutesRemaining / 60)}h ${estimatedMinutesRemaining % 60}m`
                          : `${estimatedMinutesRemaining} min`}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.noGoalText, { color: colors.textSecondary }]}>No active completion goal set.</Text>
                )}

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarBackground, { backgroundColor: colors.backgroundSelected }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, progressPercent)}%`, backgroundColor: '#10B981' },
                      ]}
                    />
                  </View>
                  <View style={styles.progressInfoRow}>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                      Progress: {book.currentPage} / {book.totalPages} pages ({progressPercent}%)
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteBook(book.id)}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={[styles.readButton, { backgroundColor: colors.backgroundSelected, borderColor: colors.backgroundSelected }]}
                  onPress={() => handleOpenReader(book)}>
                  <Text style={[styles.readButtonText, { color: colors.text }]}>Open Reader</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Import Book Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addBookModalVisible}
        onRequestClose={() => setAddBookModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Import Book & Set Goal</Text>

            <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.backgroundElement, borderColor: colors.accent }]} onPress={handlePickDocument}>
              <Text style={[styles.pickerBtnText, { color: colors.accent }]}>
                {selectedFile ? `File: ${selectedFile.name}` : '📁 Select Local EPUB/PDF'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Book Title</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.backgroundSelected, color: colors.text }]}
              placeholder="e.g. Clean Code"
              placeholderTextColor={colors.textSecondary}
              value={newBookTitle}
              onChangeText={setNewBookTitle}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Author</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.backgroundSelected, color: colors.text }]}
              placeholder="e.g. Robert C. Martin"
              placeholderTextColor={colors.textSecondary}
              value={newBookAuthor}
              onChangeText={setNewBookAuthor}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Total Pages</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.backgroundSelected, color: colors.text }]}
              placeholder="e.g. 450"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={newBookTotalPages}
              onChangeText={setNewBookTotalPages}
            />

            <Text style={[styles.fieldLabel, { color: colors.text }]}>Target Completion Date</Text>
            <TouchableOpacity
              style={[styles.input, { borderColor: colors.backgroundSelected, justifyContent: 'center' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: colors.text }}>{targetDate.toDateString()}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={targetDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setTargetDate(selectedDate);
                }}
              />
            )}

            {/* Hidden PDF for automatic page counting */}
            {selectedFile && newBookFileType === 'pdf' && (
              <View style={{ height: 0, width: 0, opacity: 0 }}>
                <Pdf
                  source={{ uri: selectedFile.uri }}
                  onLoadComplete={(numberOfPages) => {
                    setNewBookTotalPages(numberOfPages.toString());
                  }}
                />
              </View>
            )}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setAddBookModalVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={handleCreateBookAndGoal}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Core Reader Simulator Modal */}
      <Modal
        animationType="fade"
        visible={readerVisible}
        onRequestClose={handleCloseReader}>
        <SafeAreaView style={[styles.readerContainer, { backgroundColor: readerTheme === 'light' ? '#F9FAFB' : '#111827' }]}>
          {/* Header */}
          <View style={[styles.readerHeader, { borderBottomColor: readerTheme === 'light' ? '#E5E7EB' : '#374151' }]}>
            <TouchableOpacity onPress={handleCloseReader}>
              <Text style={[styles.readerDoneBtn, { color: colors.accent }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.readerBookTitle, { color: readerTheme === 'light' ? '#111827' : '#F9FAFB' }]} numberOfLines={1}>
              {activeBook?.title}
            </Text>
            <View style={styles.readerControls}>
              <TouchableOpacity
                onPress={async () => {
                  if (activeBook) {
                    const books = await StorageService.getBooks();
                    const bIdx = books.findIndex(b => b.id === activeBook.id);
                    if (bIdx >= 0) {
                      books[bIdx].currentPage = readerCurrentPage;
                      await StorageService.saveBook(books[bIdx]);
                      Alert.alert('Bookmark Saved', `Successfully bookmarked page ${readerCurrentPage}`);
                    }
                  }
                }}
                style={[styles.fontSizeControlBtn, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.controlText, { color: colors.accent }]}>🔖 Bookmark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReaderFontSize(Math.max(12, readerFontSize - 2))}
                style={[styles.fontSizeControlBtn, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.controlText, { color: colors.text }]}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReaderFontSize(Math.min(26, readerFontSize + 2))}
                style={[styles.fontSizeControlBtn, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.controlText, { color: colors.text }]}>A+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReaderTheme(readerTheme === 'light' ? 'dark' : 'light')}
                style={styles.themeToggleBtn}>
                <Text style={styles.controlText}>{readerTheme === 'light' ? '🌙' : '☀️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body content */}
          {activeBook?.fileType === 'pdf' ? (
            <Pdf
              source={{ uri: activeBook.filePath }}
              page={readerCurrentPage}
              onPageChanged={(page, numberOfPages) => {
                setReaderCurrentPage(page);
                setReaderTotalPages(numberOfPages);
              }}
              onError={(error) => {
                console.log(error);
                Alert.alert('Error', 'Failed to load PDF file.');
              }}
              style={{ flex: 1, backgroundColor: readerTheme === 'light' ? '#F9FAFB' : '#111827' }}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.readerScroll}>
              <Text style={[styles.readerContentText, { fontSize: readerFontSize, color: readerTheme === 'light' ? '#374151' : '#D1D5DB' }]}>
                {`Chapter ${Math.ceil(readerCurrentPage / 10)}: Section ${readerCurrentPage}\n\n` +
                  `This is simulated content parsed from your EPUB file: ${activeBook?.title}.\n\n` +
                  `Consistency is the key to building any reading habit. The Accountability Engine is currently monitoring this session, and your daily reading pacing adjusts automatically based on your customized target completion dates.`
                }
              </Text>
            </ScrollView>
          )}

          {/* Footer Controls */}
          <View style={[styles.readerFooter, { borderTopColor: readerTheme === 'light' ? '#E5E7EB' : '#374151' }]}>
            <TouchableOpacity
              style={[styles.navPageBtn, { backgroundColor: colors.accent }]}
              onPress={() => setReaderCurrentPage(Math.max(1, readerCurrentPage - 1))}>
              <Text style={styles.navPageText}>Prev</Text>
            </TouchableOpacity>
            
            <Text style={[styles.readerPageTracker, { color: readerTheme === 'light' ? '#4B5563' : '#9CA3AF' }]}>
              {readerCurrentPage} / {activeBook?.totalPages || 100}
            </Text>

            <TouchableOpacity
              style={[styles.navPageBtn, { backgroundColor: colors.accent }]}
              onPress={() => setReaderCurrentPage(Math.min(activeBook?.totalPages || 100, readerCurrentPage + 1))}>
              <Text style={styles.navPageText}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  streakCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  streakEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  streakSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
  bookCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bookDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  bookAuthor: {
    fontSize: 14,
    marginTop: 2,
  },
  fileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  goalSection: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalLabel: {
    fontSize: 13,
  },
  goalValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  noGoalText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
  },
  deleteLink: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  readButton: {
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  readButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: width - 40,
    maxWidth: 450,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerBtn: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  pickerBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalBtn: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
  },
  cancelBtnText: {
    fontWeight: '600',
  },
  saveBtn: {
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  readerContainer: {
    flex: 1,
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  readerDoneBtn: {
    fontSize: 16,
    fontWeight: '600',
  },
  readerBookTitle: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: width * 0.4,
  },
  readerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontSizeControlBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  themeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  controlText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readerScroll: {
    padding: 24,
  },
  readerContentText: {
    lineHeight: 28,
  },
  readerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  navPageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  navPageText: {
    color: '#FFF',
    fontWeight: '600',
  },
  readerPageTracker: {
    fontSize: 14,
    fontWeight: '600',
  },
});
