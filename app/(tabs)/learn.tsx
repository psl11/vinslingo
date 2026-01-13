import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';

interface LessonCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  totalWords: number;
  completedWords: number;
  cefrLevel: string;
}

const LESSON_CATEGORIES: LessonCategory[] = [
  {
    id: 'ngsl-a1',
    title: 'Vocabulario Básico',
    emoji: '🌱',
    description: 'Las 500 palabras más comunes',
    totalWords: 500,
    completedWords: 0,
    cefrLevel: 'A1',
  },
  {
    id: 'ngsl-a2',
    title: 'Vocabulario Elemental',
    emoji: '🌿',
    description: 'Palabras 501-1000',
    totalWords: 500,
    completedWords: 0,
    cefrLevel: 'A2',
  },
  {
    id: 'ngsl-b1',
    title: 'Vocabulario Intermedio',
    emoji: '🌳',
    description: 'Palabras 1001-2000',
    totalWords: 1000,
    completedWords: 0,
    cefrLevel: 'B1',
  },
  {
    id: 'phave',
    title: 'Phrasal Verbs',
    emoji: '🚀',
    description: '150 verbos compuestos esenciales',
    totalWords: 150,
    completedWords: 0,
    cefrLevel: 'B1-B2',
  },
];

export default function LearnScreen() {
  const router = useRouter();

  const handleStartLesson = (categoryId: string) => {
    router.push(`/study/${categoryId}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Aprender</Text>
        <Text style={styles.subtitle}>Elige una categoría para estudiar</Text>
      </View>

      <View style={styles.categories}>
        {LESSON_CATEGORIES.map((category) => {
          const progress = category.totalWords > 0 
            ? Math.round((category.completedWords / category.totalWords) * 100) 
            : 0;

          return (
            <Pressable
              key={category.id}
              onPress={() => handleStartLesson(category.id)}
            >
              <Card style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categoryDescription}>
                      {category.description}
                    </Text>
                  </View>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{category.cefrLevel}</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${progress}%` }]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {category.completedWords}/{category.totalWords}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  categories: {
    gap: 16,
  },
  categoryCard: {
    padding: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    minWidth: 70,
    textAlign: 'right',
  },
});
