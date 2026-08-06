import MBWProgramLessonRow from './MBWProgramLessonRow';
import { buildLessonGroups } from '../../../utils/programOutline';
import { getWeekCode } from '../../../utils/mbwDisplay';

/**
 * Timeline outline for a program section — shared by 100BM and MBW.
 *
 * Program-specific behaviour (row state, type icon, duration hint) is injected,
 * so this component stays agnostic of which task engine produced `taskStates`.
 */
export default function ProgramLessonList({
  taskStates,
  activeTaskId,
  getRowState,
  getTypeIcon,
  getDurationHint,
  getKindLabel,
  onSelectLesson,
}) {
  const groups = buildLessonGroups(taskStates);
  const rowStates = new Map(taskStates.map((ts) => [ts.task.id, getRowState(ts)]));

  const firstLockedId =
    taskStates.find((ts) => rowStates.get(ts.task.id)?.visual === 'locked')?.task.id || null;
  const lastTaskId = taskStates[taskStates.length - 1]?.task.id || null;
  const hasGroupLabels = groups.some((group) => group.label);

  return (
    <ul className="mbw-section-card__lessons">
      {groups.map((group, groupIndex) => {
        const done = group.taskStates.filter(
          (ts) => rowStates.get(ts.task.id)?.visual === 'done'
        ).length;

        return (
          <li key={group.id} className="mbw-lesson-group">
            {group.label && (
              <div
                className={`mbw-lesson-group__head${groupIndex === 0 ? ' is-spine-start' : ''}`}
              >
                <span className="mbw-lesson-group__node" aria-hidden>
                  <span className="mbw-lesson-group__ring" />
                </span>
                <h4 className="mbw-lesson-group__label">{group.label}</h4>
                <span className="mbw-lesson-group__count">
                  {done}/{group.taskStates.length}
                </span>
              </div>
            )}

            <ul className="mbw-lesson-group__rows">
              {group.taskStates.map((ts, rowIndex) => (
                <li key={ts.task.id}>
                  <MBWProgramLessonRow
                    weekCode={getWeekCode(ts.task)}
                    title={ts.task.title}
                    typeIcon={getTypeIcon(ts.task.type)}
                    kindLabel={getKindLabel?.(ts.task.type)}
                    durationHint={getDurationHint(ts.task)}
                    rowState={rowStates.get(ts.task.id)}
                    isActive={ts.task.id === activeTaskId}
                    showLockReason={ts.task.id === firstLockedId}
                    spineStart={!hasGroupLabels && groupIndex === 0 && rowIndex === 0}
                    spineEnd={ts.task.id === lastTaskId}
                    onSelect={() => onSelectLesson(ts.task.id)}
                  />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
