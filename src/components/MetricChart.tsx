import { useState, useRef, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import { formatMonth, type CarrierMetric } from "@/lib/lto-parser";

interface Props {
  title: string;
  subtitle: string;
  data: CarrierMetric[];
  dataKey: keyof CarrierMetric;
  months: string[];
  selectedCarriers: string[];
  carriers: string[];
  unit?: string;
  color?: string;
  formatValue?: (v: number) => string;
}

function RotatedTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={8} textAnchor="end" fill="hsl(220, 10%, 45%)" fontSize={10} transform="rotate(-90)">
        {payload.value}
      </text>
    </g>
  );
}

type SortMode = "none" | "desc" | "asc" | "name";

export function MetricChart({
  title,
  subtitle,
  data,
  dataKey,
  months,
  selectedCarriers,
  carriers,
  unit = "",
  color = "hsl(220, 70%, 50%)",
  formatValue,
}: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("none");
  const chartRef = useRef<HTMLDivElement>(null);

  const isAllCarriers = selectedCarriers.length === 0 || selectedCarriers.length === carriers.length;
  const activeCarriers = selectedCarriers.length > 0 && selectedCarriers.length < carriers.length
    ? selectedCarriers
    : carriers;

  const isMultiCarrier = isAllCarriers || activeCarriers.length > 1;

  const chartData = useMemo(() => {
    let result: { carrier?: string; month?: string; value: number }[];

    if (isMultiCarrier) {
      result = activeCarriers
        .map((c) => {
          const rows = data.filter((d) => d.carrier === c && months.includes(d.month));
          const avg = rows.length > 0
            ? rows.reduce((s, r) => s + Number(r[dataKey]), 0) / rows.length
            : 0;
          return { carrier: c, value: Math.round(avg * 100) / 100 };
        })
        .filter((d) => d.value > 0);
    } else {
      result = months.map((m) => {
        const row = data.find((d) => d.month === m && d.carrier === activeCarriers[0]);
        return { month: formatMonth(m), value: row ? Math.round(Number(row[dataKey]) * 100) / 100 : 0 };
      });
    }

    if (sortMode === "desc") result.sort((a, b) => b.value - a.value);
    else if (sortMode === "asc") result.sort((a, b) => a.value - b.value);
    else if (sortMode === "name" && isMultiCarrier)
      result.sort((a, b) => (a.carrier || "").localeCompare(b.carrier || ""));

    return result;
  }, [data, dataKey, months, activeCarriers, isMultiCarrier, sortMode]);

  const fmt = formatValue || ((v: number) => `${v}`);

  const maxLabelLen = isMultiCarrier ? Math.max(...activeCarriers.map((c) => c.length), 10) : 5;
  const bottomMargin = isMultiCarrier ? Math.min(maxLabelLen * 5.5, 200) : 5;
  const chartHeight = isMultiCarrier ? Math.max(400, chartData.length * 28 + 100) + bottomMargin : 360;

  const savePNG = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = title.replace(/[^a-zA-Z0-9 ]/g, "_") + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div ref={chartRef} className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            onClick={savePNG}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent transition-colors"
            title="Zapisz jako PNG"
          >
            🖼 PNG
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {isMultiCarrier && (
          <div className="flex gap-1 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Sortuj:</span>
            {(["desc", "asc", "name"] as const).map((mode) => (
              <button
                key={mode}
                className={`text-xs px-2 py-1 rounded border transition-colors ${sortMode === mode ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                onClick={() => setSortMode(sortMode === mode ? "none" : mode)}
              >
                {mode === "desc" ? "▼ Malejąco" : mode === "asc" ? "▲ Rosnąco" : "🔤 Nazwa"}
              </button>
            ))}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          margin={{ top: 30, right: 10, left: 0, bottom: bottomMargin }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
          <XAxis
            dataKey={isMultiCarrier ? "carrier" : "month"}
            tick={isMultiCarrier ? <RotatedTick /> : { fontSize: 12, fill: "hsl(220, 10%, 45%)" }}
            axisLine={{ stroke: "hsl(220, 15%, 88%)" }}
            interval={0}
            height={isMultiCarrier ? (bottomMargin + 10) : undefined}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(220, 10%, 45%)" }}
            axisLine={{ stroke: "hsl(220, 15%, 88%)" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid hsl(220, 15%, 88%)",
              boxShadow: "0 4px 12px rgba(0,0,0,.08)",
            }}
            formatter={(v: number) => [fmt(v), ""]}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[4, 4, 0, 0]}
            label={{
              position: "top",
              fontSize: 11,
              fill: "hsl(220, 10%, 35%)",
              formatter: (v: number) => fmt(v),
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
