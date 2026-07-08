import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getParticleHint } from '../../lib/vocabulary/particleHints';

interface ParticleHintProps {
  word: string;
  category?: string;
}

// Nota "🧠 Truco de la partícula" para phrasal verbs. Se renderiza solo cuando
// el verbo es un phrasal (category 'phave') y su partícula tiene pista conocida.
export function ParticleHint({ word, category }: ParticleHintProps) {
  if (category !== 'phave') return null;
  const hint = getParticleHint(word);
  if (!hint) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        <Text style={styles.label}>🧠 Truco: </Text>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  text: {
    fontSize: 13,
    color: '#4C1D95',
    lineHeight: 18,
  },
  label: {
    fontWeight: '700',
  },
});
