import {
  LayoutGrid,
  BookOpen,
  Folder,
  Calendar,
  ChartColumn,
  Settings,
  Headset,
  LogOut,
  PanelLeft,
  X,
} from 'lucide-react';

const ICONS = {
  'layout-grid': LayoutGrid,
  'book-open': BookOpen,
  folder: Folder,
  calendar: Calendar,
  'chart-column': ChartColumn,
  settings: Settings,
  headset: Headset,
  'log-out': LogOut,
};

function NavButton({ item, active, onSelect }) {
  const Icon = ICONS[item.icon] || LayoutGrid;
  return (
    <button
      type="button"
      className={`sh-nav-item${item.danger ? ' sh-nav-item--logout' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(item)}
    >
      <Icon className="sh-nav-icon" size={16} strokeWidth={2} aria-hidden />
      <span className="sh-nav-label">{item.label}</span>
    </button>
  );
}

export default function StitchSidebar({
  nav,
  activeId,
  collapsed,
  drawerOpen,
  onSelect,
  onToggleCollapse,
  onCloseDrawer,
}) {
  return (
    <aside
      className={`sh-aside${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-open' : ''}`}
      aria-label="Stitch navigation"
    >
      <div className="sh-navwrap">
        <div className="sh-brand">
          <div className="sh-brand__row">
            <img alt="Iron Lady" className="sh-brand__logo" src="/logo.png" />
            <span className="sh-wordmark">Iron Lady</span>
            <button
              type="button"
              className="sh-toggle"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
            >
              <PanelLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <button type="button" className="sh-close" aria-label="Close menu" onClick={onCloseDrawer}>
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <p className="sh-caption">Elevating a million women to the top</p>
        </div>

        <nav className="sh-nav-list" aria-label="Main navigation">
          {nav.primary.map((item) => (
            <NavButton key={item.id} item={item} active={activeId === item.id} onSelect={onSelect} />
          ))}
        </nav>
      </div>

      <div className="sh-nav-footer">
        {nav.footer.map((item) => (
          <NavButton key={item.id} item={item} active={activeId === item.id} onSelect={onSelect} />
        ))}
      </div>
    </aside>
  );
}
