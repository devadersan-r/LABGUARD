import React, { useState, useMemo } from 'react';
import { Activity, Pause, Play, CheckCircle2, TrendingUp } from 'lucide-react';

export interface TelemetryPoint {
  id: number;
  time: string;
  viability: number; // e.g. 99.70 to 100.00 (%)
  throughput: number; // e.g. 40 to 65 (records/sec verified)
  hmac: string;
}

interface TelemetryGraphProps {
  data: TelemetryPoint[];
  isLive: boolean;
  onToggleLive: () => void;
}

export const TelemetryGraph: React.FC<TelemetryGraphProps> = ({
  data,
  isLive,
  onToggleLive,
}) => {
  const [activeMetric, setActiveMetric] = useState<'both' | 'viability' | 'throughput'>('both');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG Chart Dimensions
  const svgWidth = 840;
  const svgHeight = 260;
  const padding = { top: 25, right: 45, bottom: 35, left: 55 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Scales
  const viabilityMin = 98.0;
  const viabilityMax = 100.0;
  const throughputMin = 0;
  const throughputMax = 100;

  const pointsCount = Math.max(data.length, 2);

  const getX = (index: number) => {
    return padding.left + (index / (pointsCount - 1)) * graphWidth;
  };

  const getYViability = (val: number) => {
    const clamped = Math.max(viabilityMin, Math.min(viabilityMax, val));
    const ratio = (clamped - viabilityMin) / (viabilityMax - viabilityMin);
    return padding.top + (1 - ratio) * graphHeight;
  };

  const getYThroughput = (val: number) => {
    const clamped = Math.max(throughputMin, Math.min(throughputMax, val));
    const ratio = (clamped - throughputMin) / (throughputMax - throughputMin);
    return padding.top + (1 - ratio) * graphHeight;
  };

  // Generate SVG path for viability curve
  const viabilityPath = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map((d, i) => {
        const x = getX(i);
        const y = getYViability(d.viability);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data]);

  const viabilityAreaPath = useMemo(() => {
    if (data.length === 0) return '';
    const startX = getX(0);
    const endX = getX(data.length - 1);
    const bottomY = padding.top + graphHeight;
    return `${viabilityPath} L ${endX.toFixed(1)} ${bottomY} L ${startX.toFixed(1)} ${bottomY} Z`;
  }, [viabilityPath, data.length]);

  // Generate SVG path for throughput
  const throughputPath = useMemo(() => {
    if (data.length === 0) return '';
    return data
      .map((d, i) => {
        const x = getX(i);
        const y = getYThroughput(d.throughput);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data]);

  const throughputAreaPath = useMemo(() => {
    if (data.length === 0) return '';
    const startX = getX(0);
    const endX = getX(data.length - 1);
    const bottomY = padding.top + graphHeight;
    return `${throughputPath} L ${endX.toFixed(1)} ${bottomY} L ${startX.toFixed(1)} ${bottomY} Z`;
  }, [throughputPath, data.length]);

  // Summary Metrics
  const latestPoint = data[data.length - 1] || { viability: 99.98, throughput: 55, hmac: '0000' };
  const avgViability = (
    data.reduce((acc, p) => acc + p.viability, 0) / (data.length || 1)
  ).toFixed(2);
  const avgThroughput = Math.round(
    data.reduce((acc, p) => acc + p.throughput, 0) / (data.length || 1)
  );

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-4">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#C9EAF7]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] text-[#087EE8] border border-[#A5E3FA] flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#082F61] flex items-center gap-2">
                Live Record Viability & Ingest Telemetry
                {isLive && (
                  <span className="flex items-center gap-1 text-[14px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    100% VIABLE STREAM
                  </span>
                )}
              </h3>
            </div>
            <p className="text-xs text-[#58758D]">
              Continuous real-time verification of HMAC-SHA256 signature health and ledger retention
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Segmented Filter */}
          <div className="flex items-center bg-[#F4FBFF] border border-[#C9EAF7] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveMetric('both')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === 'both'
                  ? 'bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA] shadow-xs font-bold'
                  : 'text-[#58758D] hover:text-[#082F61]'
              }`}
            >
              Dual View
            </button>
            <button
              onClick={() => setActiveMetric('viability')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === 'viability'
                  ? 'bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA] shadow-xs font-bold'
                  : 'text-[#58758D] hover:text-[#082F61]'
              }`}
            >
              Record Viability (%)
            </button>
            <button
              onClick={() => setActiveMetric('throughput')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === 'throughput'
                  ? 'bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA] shadow-xs font-bold'
                  : 'text-[#58758D] hover:text-[#082F61]'
              }`}
            >
              Verified Rate (rec/s)
            </button>
          </div>

          {/* Pause / Play Live Toggle */}
          <button
            onClick={onToggleLive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C9EAF7] bg-[#F4FBFF] hover:bg-[#BDEDFD]/40 text-xs font-semibold text-[#082F61] transition-colors cursor-pointer shadow-xs"
          >
            {isLive ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-600" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#087EE8]" />
                <span>Resume</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-[#C9EAF7] text-xs">
        <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7]">
          <span className="text-[14px] text-[#58758D] block font-medium">CURRENT RECORD VIABILITY</span>
          <span className="text-base font-bold font-mono-telemetry text-[#087EE8]">{latestPoint.viability.toFixed(2)} %</span>
          <span className="text-[13px] text-emerald-700 block flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Zero Bitrot / Optimal
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7]">
          <span className="text-[14px] text-[#58758D] block font-medium">AVERAGE VIABILITY (1H)</span>
          <span className="text-base font-bold font-mono-telemetry text-[#082F61]">{avgViability} %</span>
          <span className="text-[13px] text-[#58758D] block">Target: &gt;99.95%</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7]">
          <span className="text-[14px] text-[#58758D] block font-medium">VERIFIED INGEST RATE</span>
          <span className="text-base font-bold font-mono-telemetry text-[#082F61]">{latestPoint.throughput} rec/s</span>
          <span className="text-[13px] text-[#58758D] block">Mean: {avgThroughput} rec/s</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7]">
          <span className="text-[14px] text-[#58758D] block font-medium">CRYPTOGRAPHIC INTEGRITY</span>
          <span className="text-base font-bold text-emerald-700">100% INTACT</span>
          <span className="text-[13px] text-[#58758D] block font-mono-telemetry">HMAC-SHA256 Valid</span>
        </div>
      </div>

      {/* Main SVG Graph */}
      <div className="relative pt-2 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 sm:h-64 select-none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="viabilityGradLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#087EE8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#BDEDFD" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="throughputGradLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#27C5FF" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#BDEDFD" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + pct * graphHeight;
              const viabilityVal = (viabilityMax - pct * (viabilityMax - viabilityMin)).toFixed(1);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#C9EAF7"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    fill="#58758D"
                    fontSize="13"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {viabilityVal}%
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines & timestamps */}
            {data.map((d, i) => {
              if (i % 3 !== 0 && i !== data.length - 1) return null;
              const x = getX(i);
              return (
                <g key={`x-${i}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + graphHeight}
                    stroke="#C9EAF7"
                    strokeDasharray="2 4"
                    strokeWidth="1"
                    strokeOpacity="0.8"
                  />
                  <text
                    x={x}
                    y={padding.top + graphHeight + 20}
                    fill="#58758D"
                    fontSize="13"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {d.time}
                  </text>
                </g>
              );
            })}

            {/* Throughput Area & Line */}
            {(activeMetric === 'both' || activeMetric === 'throughput') && (
              <>
                <path d={throughputAreaPath} fill="url(#throughputGradLight)" />
                <path
                  d={throughputPath}
                  fill="none"
                  stroke="#27C5FF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Viability Area & Line */}
            {(activeMetric === 'both' || activeMetric === 'viability') && (
              <>
                <path d={viabilityAreaPath} fill="url(#viabilityGradLight)" />
                <path
                  d={viabilityPath}
                  fill="none"
                  stroke="#087EE8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Interactive Data Dots & Hover Detection */}
            {data.map((d, i) => {
              const x = getX(i);
              const yViab = getYViability(d.viability);
              const isHovered = hoveredIndex === i;

              return (
                <g key={`dot-${i}`}>
                  {/* Invisible hit target */}
                  <rect
                    x={x - 14}
                    y={padding.top}
                    width={28}
                    height={graphHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                  />

                  {/* Viability Dot */}
                  {(activeMetric === 'both' || activeMetric === 'viability') && (
                    <circle
                      cx={x}
                      cy={yViab}
                      r={isHovered ? 6 : 3.5}
                      fill={isHovered ? '#087EE8' : '#FFFFFF'}
                      stroke="#087EE8"
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all"
                    />
                  )}
                </g>
              );
            })}

            {/* Hover Tooltip Overlay */}
            {hoveredIndex !== null && data[hoveredIndex] && (
              <g
                transform={`translate(${Math.min(
                  svgWidth - 190,
                  Math.max(padding.left, getX(hoveredIndex) - 85)
                )}, ${Math.max(10, getYViability(data[hoveredIndex].viability) - 75)})`}
              >
                <rect
                  width="180"
                  height="64"
                  rx="10"
                  fill="#082F61"
                  stroke="#BDEDFD"
                  strokeWidth="1.2"
                  filter="drop-shadow(0 4px 10px rgba(8, 47, 97, 0.25))"
                />
                <text x="14" y="20" fill="#BDEDFD" fontSize="13" fontWeight="bold" fontFamily="monospace">
                  TIME: {data[hoveredIndex].time}
                </text>
                <text x="14" y="38" fill="#FFFFFF" fontSize="14" fontWeight="bold">
                  Viability: {data[hoveredIndex].viability.toFixed(2)}%
                </text>
                <text x="14" y="54" fill="#27C5FF" fontSize="13" fontFamily="monospace">
                  Rate: {data[hoveredIndex].throughput} rec/s · HMAC OK
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer Legend Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#C9EAF7] text-xs text-[#58758D]">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#087EE8]" />
            <span className="font-semibold text-[#082F61]">Record Viability</span>
            <span className="text-[14px] text-[#58758D] font-mono-telemetry">(98.0% – 100.0%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#27C5FF]" />
            <span className="font-semibold text-[#082F61]">Throughput Rate</span>
            <span className="text-[14px] text-[#58758D] font-mono-telemetry">(0 – 100 rec/s)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[14px] text-[#087EE8] bg-[#BDEDFD]/40 px-3 py-1 rounded-lg border border-[#C9EAF7]">
          <TrendingUp className="w-4 h-4 text-[#087EE8]" />
          <span>Telemetry Sample Interval: 4.0s</span>
        </div>
      </div>
    </div>
  );
};
