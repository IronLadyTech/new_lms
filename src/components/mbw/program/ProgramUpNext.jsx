import MBWProgramLessonRow from './MBWProgramLessonRow';
import { getWeekCode } from '../../../utils/mbwDisplay';

/**
 * The short horizon after the current step — what's coming in this phase.
 * Deliberately capped; the full list lives in Course content below.
 */
export default function ProgramUpNext({
  taskStates,
  nextTaskId,
  getRowState,
  getTypeIcon,
  getDurationHint,
  getKindLabel,
  onSelectLesson,
  limit = 3,
}) {
  const index = taskStates.findIndex((ts) => ts.task.id === nextTaskId);
  if (index < 0) return null;

  const phase = taskStates[index].task.phase;
  const upcoming = taskStates
    .slice(index + 1)
    .filter((ts) => ts.task.phase === phase)
    .slice(0, limit);

  if (!upcoming.length) return null;

  return (
    <section className="program-upnext" aria-labelledby="program-upnext-title">
      <h3 className="program-upnext__title" id="program-upnext-title">
        Coming up
      </h3>
      <ul className="program-upnext__rows">
        {upcoming.map((ts, i) => (
          <li key={ts.task.id}>
            <MBWProgramLessonRow
              weekCode={getWeekCode(ts.task)}
              title={ts.task.title}
              typeIcon={getTypeIcon(ts.task.type)}
              kindLabel={getKindLabel?.(ts.task.type)}
              durationHint={getDurationHint(ts.task)}
              rowState={getRowState(ts)}
              isActive={false}
              spineStart={i === 0}
              spineEnd={i === upcoming.length - 1}
              onSelect={() => onSelectLesson(ts.task.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
