import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import Breadcrumbs from '../ui/Breadcrumbs';
import useMediaQuery from '../../hooks/useMediaQuery';

/** An empty element in the app header that a lesson page can fill. */
export const LESSON_HEADER_SLOT_ID = 'app-header-lesson';

/**
 * Back and the course name, placed in the app header on a wide lesson page.
 *
 * A lesson used to stack two bars before any content: the app header (56px)
 * and its own bar of back link, breadcrumbs and an Outline button (88px). With
 * the course content in a column beside the lesson, the Outline button repeats
 * that column and the breadcrumbs repeat the title, so on a wide screen the two
 * bars become one: back and the course name go into the header, and the lesson
 * keeps the whole page below it. The trail stays for screen readers.
 *
 * Below 1101px the lesson keeps its own bar, as before, so this renders nothing.
 *
 * @param {{ title: string, onBack: () => void, crumbs?: Array<{ label: string, href?: string }> }} props
 */
export default function LessonHeaderBar({ title, onBack, crumbs = [] }) {
  const wide = useMediaQuery('(min-width: 1101px)');
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    setSlot(document.getElementById(LESSON_HEADER_SLOT_ID));
  }, []);

  if (!wide || !slot) return null;

  return createPortal(
    <div className="lesson-header-bar">
      <button
        type="button"
        className="lesson-header-bar__back"
        onClick={onBack}
        aria-label="Back to program"
        title="Back to program"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <p className="lesson-header-bar__title">{title}</p>
      {crumbs.length > 0 && (
        <div className="sr-only">
          <Breadcrumbs items={crumbs} />
        </div>
      )}
    </div>,
    slot
  );
}
