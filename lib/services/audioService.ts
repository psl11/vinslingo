import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let soundObject: Audio.Sound | null = null;

export async function initAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Error initializing audio:', error);
  }
}

function speakWeb(word: string): void {
  const synth: any = (globalThis as any).speechSynthesis;
  const Utter: any = (globalThis as any).SpeechSynthesisUtterance;
  if (!synth || !Utter) return;
  synth.cancel(); // corta cualquier locución en curso
  const utter = new Utter(word);
  utter.lang = 'en-US';
  utter.rate = 0.9;
  const voices = synth.getVoices?.() || [];
  const en = voices.find((v: any) => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (en) utter.voice = en;
  synth.speak(utter);
}

export async function playPronunciation(word: string): Promise<void> {
  // En web usamos la Web Speech API del navegador (TTS nativo, sin red): el
  // audio remoto de Google queda bloqueado por COEP al ser cross-origin
  // isolated (necesario para SQLite-wasm).
  if (Platform.OS === 'web') {
    try {
      speakWeb(word);
    } catch (error) {
      console.error('Error playing pronunciation (web):', error);
    }
    return;
  }

  try {
    // Unload previous sound if exists
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    // Use Google Text-to-Speech API (free tier)
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word)}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUrl },
      { shouldPlay: true }
    );

    soundObject = sound;

    // Cleanup after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch (error) {
    console.error('Error playing pronunciation:', error);
  }
}

export async function playAudioFromUrl(url: string): Promise<void> {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true }
    );
    
    soundObject = sound;
    
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

export async function stopAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    (globalThis as any).speechSynthesis?.cancel();
    return;
  }
  if (soundObject) {
    try {
      await soundObject.stopAsync();
      await soundObject.unloadAsync();
      soundObject = null;
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }
}
