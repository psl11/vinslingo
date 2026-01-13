import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { useVocabularyStats } from '../../hooks/useVocabulary';

interface LessonCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  totalWords: number;
  completedWords: number;
  cefrLevel: string;
}

export default function LearnScreen() {
  const router = useRouter();
  const { stats, isLoading } = useVocabularyStats();
  
  const categories: LessonCategory[] = [
    {
      id: 'ngsl',
      title: 'Vocabulario NGSL',
      emoji: '📖',
      description: 'Palabras más frecuentes del inglés',
      totalWords: stats?.byCategory.find(c => c.category === 'ngsl')?.count ?? 0,
      completedWords: 0,
      cefrLevel: 'A1-B2',
    },
    {
      id: 'phave',
      title: 'Phrasal Verbs',
      emoji: '🚀',
      description: 'Verbos compuestos esenciales',
      totalWords: stats?.byCategory.find(c => c.category === 'phave')?.count ?? 0,
      completedWords: 0,
      cefrLevel: 'B1-B2',
    },
  ];

  const handleStartLesson = (categoryId: string) => {
    router.push(`/study/${categoryId}`);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Cargando categorías...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Aprender</Text>
        <Text style={styles.subtitle}>
          {stats?.total ?? 0} palabras disponibles
        </Text>
      </View>

      <View style={styles.categories}>
        {categories.map((category) => {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
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
