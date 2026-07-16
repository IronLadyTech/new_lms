import { CheckCircle2, ClipboardCheck, PlayCircle, Unlock } from 'lucide-react';

const STEPS = {
  mbw: [
    {
      icon: PlayCircle,
      title: 'Watch the lesson',
      desc: 'Open each module video and watch at least 90% to unlock your assignment.',
    },
    {
      icon: ClipboardCheck,
      title: 'Complete the task',
      desc: 'Submit links, uploads, ERRC grids, or weekly posts — whatever the lesson asks for.',
    },
    {
      icon: CheckCircle2,
      title: 'Get reviewed',
      desc: 'Some tasks go to your CX coach for feedback. Others mark complete instantly.',
    },
    {
      icon: Unlock,
      title: 'Unlock what\u2019s next',
      desc: 'Finish required lessons in order to open the next section of your MBW journey.',
    },
  ],
  default: [
    {
      icon: PlayCircle,
      title: 'Open async materials',
      desc: 'Short videos and downloads you can revisit anytime between live sessions.',
    },
    {
      icon: ClipboardCheck,
      title: 'Apply in your role',
      desc: 'Use templates and tactics from Iron Lady programs in real workplace situations.',
    },
    {
      icon: CheckCircle2,
      title: 'Join live touchpoints',
      desc: 'Cohort calls, workshops, and mentoring sessions scheduled for your batch.',
    },
    {
      icon: Unlock,
      title: 'Track your progress',
      desc: 'Return to this page anytime to see what\u2019s available and pick up where you left off.',
    },
  ],
};

export default function CourseHowItWorks({ variant = 'default' }) {
  const steps = STEPS[variant] || STEPS.default;

  return (
    <section className="course-how-it-works" aria-labelledby="course-how-heading">
      <h2 id="course-how-heading" className="home-section-title">
        How it works
      </h2>
      <p className="page-sub">
        {variant === 'mbw'
          ? 'Your MBW journey is async-first — watch, submit, and advance at your pace between quarterly weekends.'
          : 'Self-paced resources plus live cohort touchpoints — learn on your schedule.'}
      </p>
      <ol className="course-how-it-works__steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="course-how-it-works__step">
              <span className="course-how-it-works__num" aria-hidden>
                {index + 1}
              </span>
              <span className="course-how-it-works__icon" aria-hidden>
                <Icon size={20} strokeWidth={2} />
              </span>
              <div className="course-how-it-works__body">
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
