import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { 
  initAudio, 
  playPronunciation, 
  playAudioFromUrl,
  stopAudio 
} from '../lib/services/audioService';

export function useAudio() {
  const { soundEnabled, autoPlayAudio } = useSettingsStore();

  useEffect(() => {
    initAudio();
  }, []);

  const playWord = useCallback(async (word: string) => {
    if (!soundEnabled) return;
    await playPronunciation(word);
  }, [soundEnabled]);

  const playUrl = useCallback(async (url: string) => {
    if (!soundEnabled) return;
    await playAudioFromUrl(url);
  }, [soundEnabled]);

  const stop = useCallback(async () => {
    await stopAudio();
  }, []);

  return {
    playWord,
    playUrl,
    stop,
    autoPlayAudio,
    soundEnabled,
  };
}
