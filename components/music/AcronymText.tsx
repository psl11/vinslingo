import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { lookupAcronym } from '../../lib/vocabulary/acronyms';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Renderiza un texto subrayando las siglas conocidas (AAVE, B.Y.O.B., CREAM…).
// Al pulsar una, muestra un globito con su significado; al pulsarla de nuevo se
// oculta. En vez de gastar texto repitiendo la expansión. Ver acronyms.ts.
type Part = { t: string; exp?: string };

// Candidato: secuencia de letras con puntos opcionales (AAVE, B.Y.O.B.). Solo se
// trata como sigla si NO tiene minúsculas (así "not"/"con" nunca se marcan).
const CAND = /[A-Za-z](?:\.?[A-Za-z]){1,7}\.?/g;

export function AcronymText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = useMemo<Part[]>(() => {
    const out: Part[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    CAND.lastIndex = 0;
    while ((m = CAND.exec(text))) {
      const cand = m[0];
      if (/[a-z]/.test(cand)) continue;
      const exp = lookupAcronym(cand);
      if (!exp) continue;
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      out.push({ t: cand, exp });
      last = m.index + cand.length;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out.length ? out : [{ t: text }];
  }, [text]);

  const [active, setActive] = useState<{ i: number; exp: string } | null>(null);

  return (
    <View>
      <Text style={style}>
        {parts.map((p, i) =>
          p.exp ? (
            <Text
              key={i}
              onPress={() => setActive((a) => (a?.i === i ? null : { i, exp: p.exp! }))}
              style={styles.acr}
            >
              {p.t}
            </Text>
          ) : (
            <Text key={i}>{p.t}</Text>
          )
        )}
      </Text>
      {active && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{active.exp}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  acr: {
    color: colors.primary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    fontWeight: fontWeight.medium,
  },
  bubble: {
    marginTop: spacing.sm,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  bubbleText: { color: colors.onPrimary, fontSize: fontSize.sm, lineHeight: 18 },
});
