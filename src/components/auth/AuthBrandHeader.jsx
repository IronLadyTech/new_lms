/** Centered logo and tagline for auth screens. */
export default function AuthBrandHeader() {
  return (
    <div className="auth-card__brand">
      <img
        src="/logo.png"
        alt=""
        className="auth-card__brand-logo"
        width={88}
        height={88}
      />
      <p className="auth-card__tagline">Elevating a million women to the top</p>
    </div>
  );
}
