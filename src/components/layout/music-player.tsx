"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "wedding-music-prefs";
const TRACK_SRC = "/music/song.mp3";

type MusicPrefs = {
  volume: number;
  muted: boolean;
};

function loadPrefs(): MusicPrefs {
  if (typeof window === "undefined") return { volume: 0.5, muted: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 0.5, muted: false };
    const parsed = JSON.parse(raw);
    return {
      volume: typeof parsed.volume === "number" ? parsed.volume : 0.5,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: 0.5, muted: false };
  }
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  // Load saved prefs once on mount.
  useEffect(() => {
    const prefs = loadPrefs();
    setVolume(prefs.volume);
    setMuted(prefs.muted);
    setReady(true);
  }, []);

  // Keep the audio element in sync with volume/mute state.
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, muted }));
  }, [volume, muted]);

  // Most browsers block autoplay with sound until the user interacts with
  // the page, so we try once and fall back to showing a paused play button.
  useEffect(() => {
    if (!ready || !audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleMute = () => setMuted((m) => !m);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <audio ref={audioRef} src={TRACK_SRC} loop preload="auto" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause music" : "Play music"}
        title={isPlaying ? "Pause music" : "Play music"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={toggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        title={muted ? "Unmute music" : "Mute music"}
      >
        <VolumeIcon className="h-4 w-4" />
      </Button>
      <input
        type="range"
        className="h-1 w-20 cursor-pointer accent-primary"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVolume(v);
          if (v > 0 && muted) setMuted(false);
        }}
        aria-label="Music volume"
      />
      <Music className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
