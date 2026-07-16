# Page Override: Video Lesson (Participant)

> Behance + ui-ux-pro-max: video-first hero, progress visible, unlock gate at 90%.

## Layout
1. **Header bar** — video icon, lesson title, `% watched` pill
2. **16:9 player** — poster with play button, then native/HLS/YouTube embed
3. **Progress bar** — red→gold gradient fill
4. **Hint** — unlock submission at 90%
5. **Submission form** — below video (gated until watched)
6. **Curriculum sidebar** (desktop) — sticky journey panel; mobile stacks below lesson

## Behance lesson pattern
- Video + homework in main column
- Module/lesson list in sidebar with check/play icons and per-lesson %
- Sticky sidebar on desktop (`mbw-program-layout--lesson` at 1024px+)

## UX rules (ui-ux-pro-max)
- No layout shift on play
- Progress feedback always visible
- Lucide icons only
- Captions/accessibility: use YouTube captions when embed

## Component
`WatchGatedVideo.jsx` — `.lesson-video` wrapper
