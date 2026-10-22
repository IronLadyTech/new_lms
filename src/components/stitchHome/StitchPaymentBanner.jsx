import { Link } from 'react-router-dom';

export default function StitchPaymentBanner({ banner }) {
  if (!banner?.show) return null;

  return (
    <section className="sh-payment">
      <div className="sh-payment__row">
        <span>
          <span className="sh-payment__title">{banner.title}</span>
          <span className="sh-payment__sub">{banner.subtitle}</span>
        </span>
        <Link className="sh-btn-payment" to={banner.href || '/app/support'}>
          {banner.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
