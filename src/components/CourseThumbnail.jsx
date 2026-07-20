import { useState } from 'react';
import { getProgramCoverSrc } from '../utils/courseDisplay';

/**
 * For LEP / 100BM / MBW, always use Iron Lady brand covers on cards.
 * Custom Firestore thumbnails are ignored for those codes so old art cannot linger.
 */
export default function CourseThumbnail({ course, className = '', size = 'card' }) {
  const [failed, setFailed] = useState(false);
  const programCover = getProgramCoverSrc(course?.code);
  const custom = course?.thumbnail?.trim?.() || '';
  const src = programCover || custom;
  const usingBrand = Boolean(programCover);
  const label = course?.code || course?.title?.slice(0, 3)?.toUpperCase() || '?';

  if (!src || failed) {
    return (
      <div
        className={`course-thumb course-thumb--placeholder course-thumb--${size}${className ? ` ${className}` : ''}`}
        aria-hidden
      >
        {label}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={course?.title ? `${course.title} thumbnail` : 'Course thumbnail'}
      className={`course-thumb course-thumb--${size}${className ? ` ${className}` : ''}${
        usingBrand ? ' course-thumb--brand' : ''
      }`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
