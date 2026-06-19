import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, GraduationCap, ShieldCheck, Shield, Crown } from 'lucide-react';
import { ROLES } from '../../utils/roles';

const ROLE_META = {
  [ROLES.STUDENT]: { label: 'User', Icon: GraduationCap, tone: 'blue' },
  [ROLES.MODERATOR]: { label: 'Moderator', Icon: Shield, tone: 'teal' },
  [ROLES.ADMIN]: { label: 'Admin', Icon: ShieldCheck, tone: 'violet' },
  [ROLES.SUPERADMIN]: { label: 'Super Admin', Icon: Crown, tone: 'amber' },
};

function useMenuPosition(triggerRef, open) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null);
      return undefined;
    }

    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 6;
      const estimatedHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: openUp ? rect.top - gap : rect.bottom + gap,
        transform: openUp ? 'translateY(-100%)' : undefined,
        zIndex: 9999,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, triggerRef]);

  return style;
}

export default function RoleSelect({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuStyle = useMenuPosition(triggerRef, open);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      const inTrigger = ref.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
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

  const menu = open && menuStyle && (
    <ul
      ref={menuRef}
      className="role-select__menu role-select__menu--portal"
      role="listbox"
      style={menuStyle}
    >
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
  );

  return (
    <div className={`role-select${open ? ' is-open' : ''}`} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`role-select__trigger role-select__trigger--${current.tone}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="role-select__current">
          <CurrentIcon size={15} strokeWidth={2} />
          {current.label}
        </span>
        <ChevronDown size={15} className="role-select__chevron" />
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
