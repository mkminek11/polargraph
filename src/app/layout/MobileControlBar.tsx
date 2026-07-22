import { useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';
import { SimulatorControls } from '../simulator/SimulatorControls';
import { useAutoImageGenerator } from '../tools/image/useAutoImageGenerator';

export function MobileControlBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pickImage, style, setStyle, clear, busy, canSwitchStyle } = useAutoImageGenerator();
  const hasArt = useProjectStore((s) => s.project.art !== null);
  const toggleCalibration = useUIStore((s) => s.toggleCalibration);
  const calibrationOpen = useUIStore((s) => s.calibrationOpen);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await pickImage(file);
  };

  return (
    <div className="control-bar">
      {hasArt && (
        <div className="control-bar-row">
          <SimulatorControls />
        </div>
      )}

      {hasArt && canSwitchStyle && (
        <div className="control-bar-row">
          <div className="segmented">
            <button className={`btn${style === 'outline' ? ' active' : ''}`} onClick={() => setStyle('outline')}>
              Outline
            </button>
            <button className={`btn${style === 'hatching' ? ' active' : ''}`} onClick={() => setStyle('hatching')}>
              Hatching
            </button>
          </div>
          <button className="btn" onClick={clear} aria-label="Remove image">
            Clear
          </button>
        </div>
      )}

      <div className="control-bar-row">
        <button className="btn primary" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? 'Processing…' : hasArt ? 'Change photo' : 'Choose photo'}
        </button>
        <button className={`btn${calibrationOpen ? ' active' : ''}`} style={{ flex: 1 }} onClick={toggleCalibration}>
          Calibrate
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}
