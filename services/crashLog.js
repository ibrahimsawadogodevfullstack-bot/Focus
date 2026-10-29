import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'focus.lastCrash.v1';

export async function saveCrash(error, context = 'render') {
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        message: String(error?.message ?? error ?? 'Erreur inconnue'),
        stack: String(error?.stack ?? '').slice(0, 4000),
        context,
        at: Date.now(),
      }),
    );
  } catch {
    // Le journal ne doit jamais provoquer une seconde erreur.
  }
}

export async function readCrash() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCrash() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
