import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMoney } from '../../shared/money';
import { chartTheme } from '../../shared/theme';

interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarDatum[];
  /** How a value reads in the tooltip and on the axis. */
  kind: 'money' | 'count';
  /** What one bar is, for the accessible name. */
  title: string;
  height?: number;
}

const fmt = (kind: Props['kind']) => (v: number) =>
  kind === 'money' ? formatMoney(v).replace(/\.00$/, '') : String(v);

/**
 * One single-series bar chart (dataviz: one series needs no legend; the title
 * names it). Rounded data ends, recessive grid, token colours, a hover tooltip.
 * Each chart on the page also has a table with the same numbers.
 */
export function BarChartCard({ data, kind, title, height = 240 }: Props) {
  const format = fmt(kind);
  return (
    <figure aria-label={title} className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="18%"
        >
          <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={{ fill: chartTheme.axis, fontSize: 11 }}
            axisLine={{ stroke: chartTheme.grid }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fill: chartTheme.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={kind === 'money' ? 64 : 36}
            tickFormatter={format}
          />
          <Tooltip
            cursor={{ fill: chartTheme.surfaceRaised }}
            contentStyle={{
              background: chartTheme.surface,
              border: `1px solid ${chartTheme.grid}`,
              borderRadius: 12,
              color: chartTheme.text,
            }}
            labelStyle={{ color: chartTheme.axis }}
            itemStyle={{ color: chartTheme.text }}
            formatter={(v: number) => [format(v), kind === 'money' ? 'Net sales' : 'Orders']}
          />
          <Bar
            dataKey="value"
            fill={chartTheme.series}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            activeBar={{ fill: chartTheme.seriesHover }}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
