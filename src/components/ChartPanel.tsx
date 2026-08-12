import { memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TickMetrics, TOTAL_TICKS } from '../simulation/types';
import { CompletedRun } from '../lib/runs';
import { c, font } from '../theme';

interface Props {
  currentMetrics: TickMetrics[];
  completedRuns: CompletedRun[];
}

// The axis reads in days but the data is indexed in hours, so convert at the
// axis instead of rebuilding every point. Copying the metrics list to bolt a
// `day` field onto each entry meant allocating a fresh 336-object array per
// chart per update, which is a large part of what made playback stutter.
const dayTick = (tick: number) => (tick / 24).toFixed(0);
const dayLabel = (tick: unknown) => `Day ${(Number(tick) / 24).toFixed(1)}`;

const axisTick = { fontSize: 9.5, fill: c.faint, fontFamily: font.mono };

function SmallChart({
  title,
  dataKey,
  currentData,
  completedRuns,
  yDomain,
}: {
  title: string;
  dataKey: keyof TickMetrics;
  currentData: TickMetrics[];
  completedRuns: CompletedRun[];
  yDomain?: [number, number];
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color: c.dim, fontSize: 11, marginBottom: 2 }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height={104}>
        <LineChart margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={c.lineSoft} />
          <XAxis
            dataKey="tick"
            type="number"
            domain={[0, TOTAL_TICKS]}
            tickFormatter={dayTick}
            tick={axisTick}
            tickCount={8}
            stroke={c.line}
          />
          <YAxis
            domain={yDomain || [0, 'auto']}
            tick={axisTick}
            width={34}
            stroke={c.line}
          />
          <Tooltip
            contentStyle={{
              background: c.surfaceHi,
              border: `1px solid ${c.line}`,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: font.mono,
            }}
            labelFormatter={dayLabel}
          />
          {/* Completed runs as dashed lines */}
          {completedRuns.map((run, i) => (
            <Line
              key={`completed-${i}`}
              data={run.metrics}
              dataKey={dataKey as string}
              stroke={run.color}
              strokeDasharray="5 3"
              dot={false}
              strokeWidth={1.5}
              name={run.name}
              isAnimationActive={false}
            />
          ))}
          {/* Current run as solid line */}
          <Line
            data={currentData}
            dataKey={dataKey as string}
            stroke={c.accent}
            dot={false}
            strokeWidth={2}
            name="Current"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const ChartPanel = memo(function ChartPanel({ currentMetrics, completedRuns }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <SmallChart
        title="Wound closure (%)"
        dataKey="woundClosurePct"
        currentData={currentMetrics}
        completedRuns={completedRuns}
        yDomain={[0, 100]}
      />
      <SmallChart
        title="Bacterial load"
        dataKey="avgBacterialLoad"
        currentData={currentMetrics}
        completedRuns={completedRuns}
        yDomain={[0, 1]}
      />
      <SmallChart
        title="Inflammatory ratio (TNF-α / IL-10)"
        dataKey="inflammatoryRatio"
        currentData={currentMetrics}
        completedRuns={completedRuns}
      />
      <SmallChart
        title="Collagen density"
        dataKey="avgCollagen"
        currentData={currentMetrics}
        completedRuns={completedRuns}
        yDomain={[0, 1]}
      />
    </div>
  );
});
