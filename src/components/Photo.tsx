import { CREDITS, photoUrl } from '../data';
import type { Item } from '../types';

/** A place photo. Its credit is rendered separately (see <Credit>) so it can sit outside buttons. */
export function Photo({ item, className = '' }: { item: Item; className?: string }) {
  const src = photoUrl(item.id);
  const subject = item.kind === 'artist' ? item.place.split(',')[0] : item.name;
  return (
    <div className={`photo ${className}`}>
      {src ? (
        <img src={src} alt={`Photo of ${subject}`} loading="lazy" decoding="async" />
      ) : (
        <div className="photo-missing" role="img" aria-label={`${item.name}: no photo (demo item)`}>
          <span>demo</span>
        </div>
      )}
    </div>
  );
}

/** Small linked credit: author and licence. */
export function Credit({ item }: { item: Item }) {
  const c = CREDITS[item.id];
  if (!c) return null;
  return (
    <p className="credit">
      <span className="visually-hidden">Photo: </span>
      <a href={c.pageUrl} target="_blank" rel="noopener noreferrer">
        {c.author}
      </a>
      {' · '}
      <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer license">
        {c.licence}
      </a>
    </p>
  );
}
