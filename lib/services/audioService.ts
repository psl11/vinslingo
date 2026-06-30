import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

// Player reused for URL-based audio (e.g. a vocabulary item's audio_url).
let urlPlayer: AudioPlayer | null = null;

export async function initAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  } catch (error) {
    console.error('Error initializing audio:', error);
  }
}

function releaseUrlPlayer(): void {
  if (urlPlayer) {
    try {
      urlPlayer.remove();
    } catch {
      // already released
    }
    urlPlayer = null;
  }
}

// Pronounce a word using the device's native text-to-speech engine.
// Reliable and works offline — replaces the old unofficial Google Translate
// TTS endpoint, which required no API key and was prone to 403s / rate limits.
export async function playPronunciation(word: string): Promise<void> {
  try {
    releaseUrlPlayer();
    Speech.stop();
    Speech.speak(word, { language: 'en-US', rate: 0.95 });
  } catch (error) {
    console.error('Error playing pronunciation:', error);
  }
}

// Play an audio file from a URL (used when a vocabulary item has a real audio_url).
export async function playAudioFromUrl(url: string): Promise<void> {
  try {
    Speech.stop();
    releaseUrlPlayer();

    const player = createAudioPlayer({ uri: url });
    urlPlayer = player;

    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        releaseUrlPlayer();
      }
    });

    player.play();
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

export async function stopAudio(): Promise<void> {
  try {
    Speech.stop();
    releaseUrlPlayer();
  } catch (error) {
    console.error('Error stopping audio:', error);
  }
}

export async function playCorrectSound(): Promise<void> {
  // Reserved for a future success cue; haptics are used for feedback today.
}

export async function playIncorrectSound(): Promise<void> {
  // Reserved for a future error cue; haptics are used for feedback today.
}
