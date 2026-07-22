import { CanvasViewport } from './canvas/CanvasViewport';
import { CalibrationSheet } from './layout/CalibrationSheet';
import { MobileControlBar } from './layout/MobileControlBar';
import { useSimulatorTicker, useSyncTimeline } from './simulator/useSimulatorPlayback';

export default function App() {
  useSyncTimeline();
  useSimulatorTicker();

  return (
    <div className="app-shell">
      <div className="app-canvas-area">
        <CanvasViewport />
      </div>
      <CalibrationSheet />
      <MobileControlBar />
    </div>
  );
}
