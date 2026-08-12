import { TOTAL_TICKS } from '../simulation/types';
import { c, font, labelStyle } from '../theme';

interface Props {
  tick: number;
  running: boolean;
  done: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onSeek: (tick: number) => void;
  onSpeedChange: (speed: number) => void;
}

const TOTAL_DAYS = TOTAL_TICKS / 24;

// 1x is one simulated day per second. "Max" is uncapped rather than a named
// multiple, because the solver costs about 10ms per simulated hour and anything
// labelled 4x would be a number this machine cannot actually deliver.
const SPEEDS: { value: number; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 0, label: 'Max' },
];

export function TimelineControls({
  tick, running, done, speed, onPlay, onPause, onStep, onSeek, onSpeedChange,
}: Props) {
  const day = tick / 24;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {running ? (
          <button onClick={onPause} style={primaryBtn}>Pause</button>
        ) : (
          <button onClick={onPlay} disabled={done} style={primaryBtn}>Play</button>
        )}
        {/* Stepping while running is a pause-then-step, not an error. */}
        <button onClick={onStep} disabled={done} style={btn}>Step 1h</button>

        <span style={{ ...labelStyle, marginLeft: 6 }}>Speed</span>
        <div style={{
          display: 'inline-flex',
          border: `1px solid ${c.line}`,
          borderRadius: 5,
          overflow: 'hidden',
        }}>
          {SPEEDS.map((s, i) => {
            const active = s.value === speed;
            return (
              <button
                key={s.label}
                onClick={() => onSpeedChange(s.value)}
                aria-pressed={active}
                style={{
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontFamily: font.mono,
                  background: active ? c.accentFill : 'transparent',
                  color: active ? c.accent : c.dim,
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : `1px solid ${c.line}`,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: font.mono, fontSize: 15, color: c.text }}>
            Day {day.toFixed(1)}
          </span>
          <span style={{ fontFamily: font.mono, fontSize: 11, color: c.faint }}>
            hour {tick} / {TOTAL_TICKS}
          </span>
          {done && (
            <span style={{
              fontFamily: font.mono,
              fontSize: 10,
              color: c.good,
              border: `1px solid ${c.good}55`,
              borderRadius: 3,
              padding: '1px 6px',
            }}>
              complete
            </span>
          )}
        </div>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={TOTAL_TICKS}
          value={tick}
          onChange={e => onSeek(parseInt(e.target.value))}
          style={{ width: '100%', display: 'block' }}
          aria-label="Simulation time"
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 3,
          fontFamily: font.mono,
          fontSize: 9.5,
          color: c.faint,
        }}>
          {Array.from({ length: TOTAL_DAYS / 2 + 1 }, (_, i) => (
            <span key={i}>{i * 2}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '5px 11px',
  background: c.surfaceHi,
  color: c.text,
  border: `1px solid ${c.line}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  minWidth: 66,
  background: c.accentFill,
  borderColor: c.accentDim,
  color: c.accent,
  fontWeight: 600,
};
