import { formatDuration } from '../../core/simulator/estimate';
import { useSimStore } from '../../store/useSimStore';

export function SimulatorControls() {
  const timeline = useSimStore((s) => s.timeline);
  const currentTimeMs = useSimStore((s) => s.currentTimeMs);
  const playing = useSimStore((s) => s.playing);
  const togglePlaying = useSimStore((s) => s.togglePlaying);
  const setCurrentTimeMs = useSimStore((s) => s.setCurrentTimeMs);

  if (!timeline) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
      <button className="btn primary round" onClick={togglePlaying} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={timeline.totalDurationMs}
        step={1}
        value={currentTimeMs}
        onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span className="mono" style={{ fontSize: 11, minWidth: 76, textAlign: 'right' }}>
        {formatDuration(currentTimeMs)} / {formatDuration(timeline.totalDurationMs)}
      </span>
    </div>
  );
}
