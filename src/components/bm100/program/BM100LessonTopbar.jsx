import { ListTree, ChevronLeft } from 'lucide-react';
import { BM100_PROGRAM_META, BM100_PROGRAM_SECTIONS } from '../../../data/bm100ProgramStructure';
import Breadcrumbs from '../../ui/Breadcrumbs';

function getSectionTitle(phase) {
  return BM100_PROGRAM_SECTIONS.find((s) => s.id === phase)?.title ?? '100BM';
}

/**
 * Compact lesson chrome — no red hero. Back + crumbs only so the task stays primary.
 */
export default function BM100LessonTopbar({
  lessonTitle,
  sectionPhase,
  onBack,
  onOpenOutline,
  showOutlineButton = false,
}) {
  const sectionTitle = sectionPhase ? getSectionTitle(sectionPhase) : null;

  return (
    <header className="mbw-lesson-topbar mbw-lesson-topbar--compact">
      <div className="mbw-lesson-topbar__row">
        <button type="button" className="mbw-lesson-topbar__back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" />
          Back to program
        </button>
        {showOutlineButton && (
          <button
            type="button"
            className="mbw-lesson-topbar__outline btn btn-outline btn-sm"
            onClick={onOpenOutline}
            aria-label="Open course outline"
          >
            <ListTree size={16} aria-hidden />
            Outline
          </button>
        )}
      </div>
      <Breadcrumbs
        className="mbw-lesson-topbar__crumbs"
        items={[
          { label: 'Programs', href: '/app/home' },
          { label: BM100_PROGRAM_META.title, href: '/app/100bm' },
          ...(sectionTitle ? [{ label: sectionTitle }] : []),
          { label: lessonTitle || 'Lesson' },
        ]}
      />
    </header>
  );
}
