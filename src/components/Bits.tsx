import { useState } from 'react';
import { formatCountdown, nextResetAt } from '../lib/dateKey';
import { useNow } from '../hooks';
import type { Item } from '../types';
import { CopyIcon, CrossIcon, ShareIcon, TickIcon } from './Icons';

export function Countdown({ label = 'Next daily in' }: { label?: string }) {
  const now = useNow();
  const ms = nextResetAt(now).getTime() - now.getTime();
  return (
    <p className="countdown">
      <span>{label}</span>{' '}
      <time className="mono" aria-live="off">
        {formatCountdown(ms)}
      </time>
    </p>
  );
}

/** Coordinates in survey style, e.g. 51.532° N, 0.178° W. */
export function Coords({ item }: { item: Item }) {
  const lat = `${Math.abs(item.lat).toFixed(3)}° ${item.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(item.lon).toFixed(3)}° ${item.lon >= 0 ? 'E' : 'W'}`;
  return (
    <span className="coords mono" aria-hidden="true">
      {lat}, {lon}
    </span>
  );
}

export function ResultMark({ correct, size = 16 }: { correct: boolean; size?: number }) {
  return (
    <span className={`mark ${correct ? 'is-right' : 'is-wrong'}`}>
      {correct ? <TickIcon size={size} /> : <CrossIcon size={size} />}
      <span className="visually-hidden">{correct ? 'correct' : 'wrong'}</span>
    </span>
  );
}

export function UnitToggle({ unit, onChange }: { unit: 'km' | 'mi'; onChange: (u: 'km' | 'mi') => void }) {
  return (
    <div className="segmented small" role="group" aria-label="Distance unit">
      {(['km', 'mi'] as const).map((u) => (
        <button key={u} type="button" aria-pressed={unit === u} onClick={() => onChange(u)}>
          {u}
        </button>
      ))}
    </div>
  );
}

export function ShareButtons({ text }: { text: string }) {
  const [status, setStatus] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard');
    } catch {
      setStatus('Copy failed. Select the text above instead.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      /* user cancelled */
    }
  };
  return (
    <div className="share">
      <pre className="share-preview" aria-label="Share text">
        {text}
      </pre>
      <div className="share-buttons">
        {canShare && (
          <button type="button" className="btn primary" onClick={share}>
            <ShareIcon size={18} /> Share
          </button>
        )}
        <button type="button" className={`btn ${canShare ? '' : 'primary'}`} onClick={copy}>
          <CopyIcon size={18} /> Copy result
        </button>
      </div>
      <p className="share-status" role="status">
        {status}
      </p>
    </div>
  );
}
