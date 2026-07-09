import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { analyzeTranslation } from '../../lib/vocabulary/translationParser';

interface TranslationBodyProps {
  translation: string;
  // 'center' en la ficha de estudio; 'left' en listas como el buscador.
  align?: 'center' | 'left';
}

// Render coherente del campo `translation` en toda la app: pares confusos,
// acepciones numeradas (tipo diccionario), término + explicación, o texto simple.
export function TranslationBody({ translation, align = 'left' }: TranslationBodyProps) {
  const a = useMemo(() => analyzeTranslation(translation), [translation]);
  const textAlign = align;

  if (a.kind === 'comparison') {
    return (
      <View style={styles.block}>
        {a.items.map((item, i) => (
          <View key={i} style={[styles.item, i > 0 && styles.itemDivider]}>
            <Text style={styles.cpTerm}>{item.term}</Text>
            {item.def ? <Text style={styles.cpDef}>{item.def}</Text> : null}
          </View>
        ))}
      </View>
    );
  }

  if (a.kind === 'senses') {
    // Las acepciones numeradas se maquetan siempre alineadas a la izquierda
    // (lista tipo diccionario), idéntico en la ficha y en el buscador, para que
    // la UI sea coherente. El prop `align` solo afecta a término/texto simple.
    return (
      <View style={styles.block}>
        {a.header ? (
          <Text style={styles.sensesHeader}>{a.header}</Text>
        ) : null}
        {a.senses.map((s, i) => (
          <View key={s.n} style={[styles.item, i > 0 && styles.itemDivider]}>
            <View style={styles.senseRow}>
              <View style={styles.senseNumber}>
                <Text style={styles.senseNumberText}>{s.n}</Text>
              </View>
              <Text style={styles.senseDesc}>{s.desc}</Text>
            </View>
            {s.examples.map((ex, j) => (
              <View key={j} style={styles.senseExample}>
                <Text style={styles.senseExampleEn}>"{ex.en}"</Text>
                {ex.es ? <Text style={styles.senseExampleEs}>{ex.es}</Text> : null}
              </View>
            ))}
          </View>
        ))}
        {a.note ? <Text style={styles.senseNote}>{a.note}</Text> : null}
      </View>
    );
  }

  if (a.kind === 'term') {
    return (
      <View style={[styles.termBlock, align === 'center' && styles.termBlockCenter]}>
        <Text style={[styles.term, { textAlign }]}>{a.term}</Text>
        <Text style={[styles.explanation, { textAlign }]}>{a.explanation}</Text>
      </View>
    );
  }

  return (
    <Text style={[styles.raw, { textAlign }, a.text.length > 50 && styles.rawSmall]}>
      {a.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
    alignItems: 'stretch',
  },
  item: {
    width: '100%',
    paddingVertical: 8,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  // Término + explicación (phrasal monosémico)
  termBlock: {
    width: '100%',
    alignItems: 'flex-start',
  },
  termBlockCenter: {
    alignItems: 'center',
  },
  term: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  explanation: {
    fontSize: 15,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 21,
    marginTop: 8,
  },
  // Texto simple
  raw: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  rawSmall: {
    fontSize: 18,
  },
  // Acepciones numeradas
  sensesHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  senseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  senseNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  senseNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  senseDesc: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  senseExample: {
    marginLeft: 30,
    marginTop: 5,
  },
  senseExampleEn: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 18,
  },
  senseExampleEs: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 1,
  },
  senseNote: {
    marginTop: 10,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#94A3B8',
    lineHeight: 16,
  },
  // Pares confusos
  cpTerm: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  cpDef: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 20,
    marginTop: 2,
  },
});
