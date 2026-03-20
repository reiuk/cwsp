import { TOTAL_TICKS } from '../simulation/types';

interface Props {
  tick: number;
  running: boolean;
  done: boolean;
  onPlay: (speed?: number) => void;
  onPause: () => void;
  onStep: () => void;
  onSeek: (tick: number) => void;
}

export function TimelineControls({
  tick, running, done, onPlay, onPause, onStep, onSeek,
}: Props) {
  const day = (tick / 24).toFixed(1);
  const hour = tick;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {running ? (
          <button onClick={onPause} style={btnStyle}>⏸ Pause</button>
        ) : (
          <button
            onClick={() => onPlay(1)}
            disabled={done}
            style={btnStyle}
          >
            ▶ Play
          </button>
        )}
        <button
          onClick={() => onPlay(4)}
          disabled={running || done}
          style={btnStyle}
        >
          ⏩ Fast
        </button>
        <button
          onClick={onStep}
          disabled={running || done}
          style={btnStyle}
        >
          ⏭ Step
        </button>
        <span style={{ color: '#ccc', fontSize: 14, marginLeft: 8 }}>
          Day {day} (hour {hour}/{TOTAL_TICKS})
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={TOTAL_TICKS}
        value={tick}
        onChange={e => onSeek(parseInt(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#333',
  color: '#eee',
  border: '1px solid #555',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};
