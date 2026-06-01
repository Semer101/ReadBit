import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '../services/supabase';

interface PodMember {
  id: string;
  email: string;
  streak: number;
  lastRead: string;
}

export default function PodsScreen() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<PodMember[]>([
    { id: '1', email: 'friend1@example.com', streak: 5, lastRead: 'Today' },
    { id: '2', email: 'reader_pro@gmail.com', streak: 12, lastRead: 'Yesterday' },
    { id: '3', email: 'bookworm@readbit.com', streak: 0, lastRead: '3 days ago' },
  ]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Reading Pods</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Stay habit-consistent with your friends.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Active Pod: Alpha Readers</Text>
          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.id} style={[styles.memberRow, { borderBottomColor: colors.backgroundSelected }]}>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberEmail, { color: colors.text }]}>{member.email}</Text>
                  <Text style={[styles.memberStatus, { color: colors.textSecondary }]}>Last read: {member.lastRead}</Text>
                </View>
                <View style={[styles.streakBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.streakText}>🔥 {member.streak}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.inviteBtn, { borderColor: colors.accent }]}>
            <Text style={[styles.inviteBtnText, { color: colors.accent }]}>+ Invite Friends</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Public Pods</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No public pods available near you.</Text>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.createBtnText}>Create New Pod</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  memberList: {
    marginTop: 10,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  streakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  inviteBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  inviteBtnText: {
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  createBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
