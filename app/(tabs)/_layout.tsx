import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    learn: '📚',
    review: '🔄',
    profile: '👤',
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // La zona de contenido = height - paddingTop - paddingBottom. Antes
        // era 57 - 8 - insets = 49px fijos (el +insets de la altura lo anulaba
        // el paddingBottom), insuficiente para el emoji (24px) + etiqueta (12px)
        // → las etiquetas se recortaban. Ahora la zona de contenido es ~60px.
        // insets.bottom sigue reservando el home indicator en nativo; en web es
        // 0 (el navegador/standalone ya excluye la zona insegura).
        // +14 de paddingBottom para que las etiquetas no queden pegadas al
        // borde inferior (en web insets.bottom es 0). La altura crece igual
        // para mantener la zona de contenido (~56px, sin recorte).
        tabBarStyle: [styles.tabBar, { height: 78 + insets.bottom, paddingBottom: insets.bottom + 14 }],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Aprender',
          tabBarIcon: ({ focused }) => <TabIcon name="learn" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Repasar',
          tabBarIcon: ({ focused }) => <TabIcon name="review" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
    paddingTop: spacing.sm,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: fontSize.xxl,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
