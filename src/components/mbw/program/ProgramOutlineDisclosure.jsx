import { ChevronDown, ListTree } from 'lucide-react';

/**
 * The full program outline, collapsed by default.
 *
 * Progressive disclosure: the outline is reference material, not the learner's
 * default surface — ProgramNextStep is. Keep it one tap away, never in the way.
 */
export default function ProgramOutlineDisclosure({ open, onToggle, lessonCount, children }) {
  return (
    <section className="program-outline">
      <button
        type="button"
        className="program-outline__toggle"
        aria-expanded={open}
        aria-controls="program-outline-panel"
        onClick={onToggle}
      >
        <ListTree size={18} aria-hidden />
        <span className="program-outline__label">Full program outline</span>
        {lessonCount > 0 && <span className="program-outline__count">{lessonCount} lessons</span>}
        <ChevronDown
          size={18}
          className={`program-outline__chevron${open ? ' is-open' : ''}`}
          aria-hidden
        />
      </button>

      <div id="program-outline-panel" className="program-outline__panel" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
