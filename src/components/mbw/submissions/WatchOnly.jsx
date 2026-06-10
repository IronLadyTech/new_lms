export default function WatchOnly({ task, submission }) {
  if (submission?.status === 'completed' || submission?.watchCompleted) {
    return (
      <div className="mbw-submission mbw-submission--saved">
        <p className="success-text">You completed this session.</p>
      </div>
    );
  }
  return (
    <div className="mbw-submission">
      <p className="muted">Watch the video above to at least 90% to complete this task.</p>
    </div>
  );
}
