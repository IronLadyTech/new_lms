import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, GraduationCap, ShieldCheck, Shield, Crown } from 'lucide-react';
import { ROLES } from '../../utils/roles';

const ROLE_META = {
  [ROLES.STUDENT]: { label: 'User', Icon: GraduationCap, tone: 'blue' },
  [ROLES.MODERATOR]: { label: 'Moderator', Icon: Shield, tone: 'teal' },
  [ROLES.ADMIN]: { label: 'Admin', Icon: ShieldCheck, tone: 'violet' },
  [ROLES.SUPERADMIN]: { label: 'Super Admin', Icon: Crown, tone: 'amber' },
};

export default function RoleSelect({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = ROLE_META[value] || ROLE_META[ROLES.STUDENT];
  const CurrentIcon = current.Icon;

  const handleSelect = (v) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };

  return (
    <div className={`role-select${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`role-select__trigger role-select__trigger--${current.tone}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="role-select__current">
          <CurrentIcon size={15} strokeWidth={2} />
          {current.label}
        </span>
        <ChevronDown size={15} className="role-select__chevron" />
      </button>

      {open && (
        <ul className="role-select__menu" role="listbox">
          {options.map((o) => {
            const meta = ROLE_META[o.value] || { label: o.label, Icon: GraduationCap, tone: 'blue' };
            const Icon = meta.Icon;
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  className={`role-select__option role-select__option--${meta.tone}${active ? ' is-active' : ''}`}
                  onClick={() => handleSelect(o.value)}
                  role="option"
                  aria-selected={active}
                >
                  <span className="role-select__option-icon">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="role-select__option-label">{o.label}</span>
                  {active && <Check size={15} className="role-select__check" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
