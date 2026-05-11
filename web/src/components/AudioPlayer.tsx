import { useCallback, useEffect, useRef, useState } from 'react';

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onMeta = () => { setDuration(audio.duration || 0); setReady(true); };
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.src = src;

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    if (playing) {
      const tick = () => {
        if (audioRef.current) setCurrent(audioRef.current.currentTime);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); }
    else { a.play().catch(() => {}); }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * duration;
    setCurrent(a.currentTime);
  }, [duration]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audio-player">
      <button type="button" className="audio-play-btn" onClick={toggle} disabled={!ready}>
        {playing ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>}
      </button>
      <div className="audio-track" onClick={seek}>
        <div className="audio-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="audio-time">{ready ? fmt(current) : '…'}</span>
    </div>
  );
}
