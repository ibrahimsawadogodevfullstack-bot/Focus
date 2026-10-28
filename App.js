import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const pages = [
  {
    id: 'bonjour',
    label: 'Page 1',
    title: 'Bonjour !',
    message: 'Bienvenue dans ta premiere page Expo.',
  },
  {
    id: 'salut',
    label: 'Page 2',
    title: 'Salut !',
    message: 'Voici la deuxieme page pour tester React Native.',
  },
];

export default function App() {
  const [activePageId, setActivePageId] = useState(pages[0].id);
  const activePage = pages.find((page) => page.id === activePageId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.appTitle}>Test Expo</Text>

        <View style={styles.card}>
          <Text style={styles.greeting}>{activePage.title}</Text>
          <Text style={styles.message}>{activePage.message}</Text>
        </View>

        <View style={styles.navigation}>
          {pages.map((page) => {
            const isActive = page.id === activePageId;

            return (
              <Pressable
                key={page.id}
                onPress={() => setActivePageId(page.id)}
                style={[styles.button, isActive && styles.activeButton]}
              >
                <Text style={[styles.buttonText, isActive && styles.activeButtonText]}>
                  {page.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  appTitle: {
    color: '#1f2937',
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  greeting: {
    color: '#0f766e',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#4b5563',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  navigation: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  activeButton: {
    backgroundColor: '#0f766e',
  },
  buttonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  activeButtonText: {
    color: '#ffffff',
  },
});
