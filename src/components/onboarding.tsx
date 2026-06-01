import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useAppTheme } from '@/hooks/use-app-theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Track Your Progress',
    description: 'Import your PDF and EPUB files and let ReadBit track your daily reading consistency automatically.',
    icon: '📚',
  },
  {
    title: 'Stay Accountable',
    description: 'Set target completion dates and our engine will calculate exactly how many pages you need to read daily.',
    icon: '🔥',
  },
  {
    title: 'Join a Pod',
    description: 'Reading is better with friends. Join a pod to see streaks and stay motivated together.',
    icon: '🤝',
  }
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { colors } = useAppTheme();

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.slide}>
        <Text style={styles.icon}>{SLIDES[currentSlide].icon}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{SLIDES[currentSlide].title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {SLIDES[currentSlide].description}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                { backgroundColor: i === currentSlide ? colors.accent : colors.backgroundSelected }
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    fontSize: 100,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  button: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
