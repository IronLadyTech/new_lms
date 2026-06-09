import { useState } from 'react';

export default function EventImage({ src, alt = 'Event image', className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = src?.trim?.() || '';

  if (!url || failed) return null;

  return (
    <img
      src={url}
      alt={alt}
      className={`event-calendar__event-image${className ? ` ${className}` : ''}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
