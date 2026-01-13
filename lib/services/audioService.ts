import { Audio } from 'expo-av';
import { useSettingsStore } from '../../stores/useSettingsStore';

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

export async function playPronunciation(word: string): Promise<void> {
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

export async function playCorrectSound(): Promise<void> {
  // Could use a local asset or generate a simple tone
  // For now, we'll skip this or use haptics instead
}

export async function playIncorrectSound(): Promise<void> {
  // Could use a local asset or generate a simple tone
  // For now, we'll skip this or use haptics instead
}
