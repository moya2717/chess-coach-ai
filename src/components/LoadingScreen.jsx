export default function LoadingScreen({ step, message }) {
  const steps = [
    'Connecting to Chess.com API...',
    'Chess.com games retrieved ✓',
    'Connecting to Lichess API...',
    'Lichess games retrieved ✓',
    'Running Stockfish analysis...',
    'Detecting patterns in your play...',
    'Preparing your coaching report...',
  ];

  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>{message || 'Building your personalized coaching report...'}</p>
      <div className="loading-steps">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`loading-step ${i < step ? 'done' : i === step ? 'active' : ''}`}
          >
            <span className="step-icon">
              {i < step ? '✓' : i === step ? '◉' : '○'}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
