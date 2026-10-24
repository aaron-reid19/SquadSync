const LABELS = ["About you", "Availability"];

export default function StepProgress({ current }: { current: number }) {
  return (
    <div className="steps">
      <div className="steps__bars" aria-hidden="true">
        {LABELS.map((_, i) => (
          <span key={i} className={i < current ? "steps__bar steps__bar--on" : "steps__bar"} />
        ))}
      </div>
      <p className="steps__label">Step {current} of {LABELS.length}: {LABELS[current - 1]}</p>
    </div>
  );
}
