import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';

const STEP_OPTIONS = [1, 5, 10, 25, 50];

/** A bottom sheet with manual jog controls, shown only while calibrating. */
export function CalibrationSheet() {
  const open = useUIStore((s) => s.calibrationOpen);
  const toggle = useUIStore((s) => s.toggleCalibration);
  const [stepMm, setStepMm] = useState(10);
  const profile = useProjectStore((s) => s.project.machineProfile);
  const simPenPosition = useProjectStore((s) => s.project.simPenPosition);
  const setSimPenPosition = useProjectStore((s) => s.setSimPenPosition);

  if (!open) return null;

  const clamp = (x: number, y: number) => ({
    x: Math.max(0, Math.min(profile.canvasWidthMm, x)),
    y: Math.max(0, Math.min(profile.canvasHeightMm, y)),
  });

  const nudge = (dx: number, dy: number) => setSimPenPosition(clamp(simPenPosition.x + dx, simPenPosition.y + dy));
  const goHome = () => setSimPenPosition({ ...profile.homePosition });
  const goCorner = (x: number, y: number) => setSimPenPosition(clamp(x, y));

  return (
    <div className="sheet">
      <div className="sheet-handle" onClick={toggle} />
      <div className="sheet-header">
        <h3>Calibrate corners</h3>
        <button className="btn" onClick={toggle} aria-label="Close calibration">
          Done
        </button>
      </div>

      <div className="field-row">
        <label>Step</label>
        <select className="mono" value={stepMm} onChange={(e) => setStepMm(Number(e.target.value))}>
          {STEP_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} mm
            </option>
          ))}
        </select>
      </div>

      <div className="jog-grid">
        <div />
        <button className="btn" onClick={() => nudge(0, -stepMm)} aria-label="Jog up">
          ^
        </button>
        <div />
        <button className="btn" onClick={() => nudge(-stepMm, 0)} aria-label="Jog left">
          {'<'}
        </button>
        <button className="btn" onClick={goHome} aria-label="Jog to home">
          &#8226;
        </button>
        <button className="btn" onClick={() => nudge(stepMm, 0)} aria-label="Jog right">
          {'>'}
        </button>
        <div />
        <button className="btn" onClick={() => nudge(0, stepMm)} aria-label="Jog down">
          v
        </button>
        <div />
      </div>

      <div className="corner-grid">
        <button className="btn" onClick={() => goCorner(0, 0)}>
          Top-left
        </button>
        <button className="btn" onClick={() => goCorner(profile.canvasWidthMm, 0)}>
          Top-right
        </button>
        <button className="btn" onClick={() => goCorner(0, profile.canvasHeightMm)}>
          Bottom-left
        </button>
        <button className="btn" onClick={() => goCorner(profile.canvasWidthMm, profile.canvasHeightMm)}>
          Bottom-right
        </button>
      </div>
    </div>
  );
}
