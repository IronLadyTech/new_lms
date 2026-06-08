import { useState } from 'react';

export default function CourseThumbnail({ course, className = '', size = 'card' }) {
  const [failed, setFailed] = useState(false);
  const src = course?.thumbnail?.trim?.() || '';
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
      className={`course-thumb course-thumb--${size}${className ? ` ${className}` : ''}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
