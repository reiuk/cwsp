import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TickMetrics } from '../simulation/types';

interface CompletedRun {
  name: string;
  metrics: TickMetrics[];
  color: string;
}

interface Props {
  currentMetrics: TickMetrics[];
  completedRuns: CompletedRun[];
}


function tickToDay(tick: number): number {
  return tick / 24;
}

function formatMetrics(metrics: TickMetrics[]) {
  return metrics.map(m => ({
    ...m,
    day: tickToDay(m.tick),
  }));
}

function SmallChart({
  title,
  dataKey,
  currentData,
  completedRuns,
  yDomain,
}: {
  title: string;
  dataKey: keyof TickMetrics;
  currentData: ReturnType<typeof formatMetrics>;
  completedRuns: CompletedRun[];
  yDomain?: [number, number];
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ color: '#aaa', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, 14]}
            tick={{ fontSize: 10, fill: '#888' }}
            tickCount={8}
          />
          <YAxis
            domain={yDomain || [0, 'auto']}
            tick={{ fontSize: 10, fill: '#888' }}
            width={35}
          />
          <Tooltip
            contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }}
            labelFormatter={v => `Day ${Number(v).toFixed(1)}`}
          />
          {/* Completed runs as dashed lines */}
          {completedRuns.map((run, i) => (
            <Line
              key={`completed-${i}`}
              data={formatMetrics(run.metrics)}
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
            stroke="#4a90d9"
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

export function ChartPanel({ currentMetrics, completedRuns }: Props) {
  const data = formatMetrics(currentMetrics);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SmallChart
        title="Wound Closure (%)"
        dataKey="woundClosurePct"
        currentData={data}
        completedRuns={completedRuns}
        yDomain={[0, 100]}
      />
      <SmallChart
        title="Bacterial Load"
        dataKey="avgBacterialLoad"
        currentData={data}
        completedRuns={completedRuns}
        yDomain={[0, 1]}
      />
      <SmallChart
        title="Inflammatory Ratio (TNF-α / IL-10)"
        dataKey="inflammatoryRatio"
        currentData={data}
        completedRuns={completedRuns}
      />
      <SmallChart
        title="Collagen Density"
        dataKey="avgCollagen"
        currentData={data}
        completedRuns={completedRuns}
        yDomain={[0, 1]}
      />
    </div>
  );
}
