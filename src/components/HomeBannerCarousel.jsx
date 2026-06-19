import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HOME_BANNERS, HOME_BANNER_AUTO_MS } from '../data/homeBanners';

export default function HomeBannerCarousel({ banners = HOME_BANNERS, autoMs = HOME_BANNER_AUTO_MS }) {
  const count = banners.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  const goTo = useCallback(
    (next) => {
      if (count < 2) return;
      setIndex((i) => (next < 0 ? (i + count - 1) % count : (i + 1) % count));
    },
    [count]
  );

  const goPrev = useCallback(() => goTo(-1), [goTo]);
  const goNext = useCallback(() => goTo(1), [goTo]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = window.setInterval(goNext, autoMs);
    return () => window.clearInterval(timer);
  }, [count, paused, autoMs, goNext, index]);

  if (count === 0) return null;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 48) {
      if (delta > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  return (
    <section
      className="home-banner-carousel"
      style={{ '--banner-slides': count }}
      aria-roledescription="carousel"
      aria-label="Program highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="home-banner-carousel__viewport">
        <div
          className="home-banner-carousel__track"
          style={{ transform: `translate3d(calc(-100% * ${index} / ${count}), 0, 0)` }}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className="home-banner-carousel__slide"
              aria-hidden={i !== index}
              aria-label={`Slide ${i + 1} of ${count}`}
            >
              <img
                src={banner.src}
                alt={banner.alt}
                className="home-banner-carousel__img"
                width={1600}
                height={559}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="home-banner-carousel__arrow home-banner-carousel__arrow--prev"
              onClick={goPrev}
              aria-label="Previous banner"
            >
              <ChevronLeft size={28} strokeWidth={2.75} aria-hidden />
            </button>
            <button
              type="button"
              className="home-banner-carousel__arrow home-banner-carousel__arrow--next"
              onClick={goNext}
              aria-label="Next banner"
            >
              <ChevronRight size={28} strokeWidth={2.75} aria-hidden />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="home-banner-carousel__dots" role="tablist" aria-label="Choose banner">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Banner ${i + 1} of ${count}`}
              className={`home-banner-carousel__dot${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
