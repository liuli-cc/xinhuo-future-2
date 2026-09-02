"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CSSProperties, useMemo, useRef, useState } from "react";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";

gsap.registerPlugin(useGSAP);

export type VizDatum = {
  label: string;
  value: number;
  detail?: string;
  color?: string;
};

const chartPalette = [
  "var(--chart-blue-1)",
  "var(--chart-blue-2)",
  "var(--chart-blue-3)",
  "var(--chart-blue-4)",
  "var(--chart-blue-5)",
  "var(--chart-blue-6)",
];

type ReplayKey = string | number;
type MotionState = "idle" | "running" | "complete" | "reduced" | "empty";

function colorFor(item: VizDatum, index: number) {
  return item.color || chartPalette[index % chartPalette.length];
}

function dataSignature(data: VizDatum[]) {
  return JSON.stringify(data.map(item => [item.label, item.value, item.detail ?? "", item.color ?? ""]));
}

function playWhenVisible(root: HTMLElement, timeline: gsap.core.Timeline, onPlay: () => void) {
  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    onPlay();
    timeline.play(0);
  };

  if (typeof IntersectionObserver === "undefined") {
    play();
    return () => timeline.kill();
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    play();
  }, { threshold: 0.28 });
  observer.observe(root);

  return () => {
    observer.disconnect();
    timeline.kill();
  };
}

function VizEmptyState() {
  return <div className="viz-empty-state" role="status">
    <strong>暂无可绘制数据</strong>
    <span>数据更新后，图表将在进入可见区域时重新绘制。</span>
  </div>;
}

export function VizSkeleton({ label = "正在生成数据视图" }: { label?: string }) {
  return <div className="viz-skeleton" role="status" aria-label={label}>
    <div className="viz-skeleton-head" />
    <div className="viz-skeleton-bars"><i /><i /><i /><i /><i /></div>
  </div>;
}

export function AnimatedBarChart({
  data,
  title,
  description,
  max,
  depth = false,
  unit = "",
  replayKey,
}: {
  data: VizDatum[];
  title: string;
  description?: string;
  max?: number;
  depth?: boolean;
  unit?: string;
  replayKey?: ReplayKey;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [motionRun, setMotionRun] = useState(0);
  const { reducedMotion } = useMotionPreference();
  const ceiling = Math.max(1, max ?? Math.max(...data.map(item => item.value), 1));
  const hasRenderableData = data.some(item => Number.isFinite(item.value) && item.value > 0);
  const signature = `${dataSignature(data)}|ceiling:${ceiling}`;

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!hasRenderableData) {
      setMotionState("empty");
      return;
    }
    if (reducedMotion) {
      setMotionState("reduced");
      return;
    }

    setMotionState("idle");
    const rises = gsap.utils.toArray<HTMLElement>(".viz-bar-rise");
    const values = gsap.utils.toArray<HTMLElement>(".viz-bar-value");
    const labels = gsap.utils.toArray<HTMLElement>(".viz-bar-label");
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        gsap.set(rises, { clearProps: "transform,opacity,visibility,willChange" });
        gsap.set([...values, ...labels], { clearProps: "transform,opacity,visibility,willChange" });
        setMotionState("complete");
      },
    });

    timeline
      .set(rises, { willChange: "transform,opacity" }, 0)
      .set([...values, ...labels], { willChange: "transform,opacity" }, 0)
      .fromTo(rises, {
        scaleY: 0,
        autoAlpha: 0,
        transformOrigin: "50% 100%",
      }, {
        scaleY: 1,
        autoAlpha: 1,
        duration: 0.82,
        stagger: 0.065,
        ease: "power3.out",
      }, 0)
      .fromTo(labels, { y: 8, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.38,
        stagger: 0.04,
        ease: "power2.out",
      }, 0.1)
      .fromTo(values, { y: 6, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.36,
        stagger: 0.04,
        ease: "power2.out",
      }, 0.16);

    return playWhenVisible(root, timeline, () => {
      setMotionRun(current => current + 1);
      setMotionState("running");
    });
  }, { dependencies: [signature, replayKey, reducedMotion], scope: rootRef, revertOnUpdate: true });

  return <section
    className={`data-viz data-viz-bars ${depth ? "data-viz-depth" : ""}`}
    ref={rootRef}
    aria-label={title}
    data-motion-state={motionState}
    data-motion-run={motionRun}
  >
    <header className="data-viz-head"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><span>更新后自动重绘</span></header>
    {!hasRenderableData ? <VizEmptyState /> : <div className="viz-bar-plot" style={{ "--viz-count": Math.max(data.length, 1) } as CSSProperties}>
      {data.map((item, index) => {
        const height = Math.max(item.value > 0 ? 4 : 0, Math.min(100, item.value / ceiling * 100));
        const color = colorFor(item, index);
        return <button
          type="button"
          className="viz-bar"
          key={item.label}
          onMouseEnter={() => setActive(index)}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(index)}
          onBlur={() => setActive(null)}
          aria-label={`${item.label} ${item.value}${unit}。${item.detail ?? ""}`}
        >
          <span className="viz-bar-value">{item.value}{unit}</span>
          <span className="viz-bar-rail">
            <i
              className="viz-bar-rise"
              style={{ position: "absolute", inset: "auto 0 0", display: "block", height: `${height}%`, transformOrigin: "50% 100%" }}
            >
              <span className="viz-bar-fill" style={{ height: "100%", background: color, color }} />
            </i>
          </span>
          <span className="viz-bar-label">{item.label}</span>
          {active === index && <span className="viz-tooltip"><b>{item.label}</b><em>{item.value}{unit}</em><small>{item.detail || "当前数据值"}</small></span>}
        </button>;
      })}
    </div>}
  </section>;
}

export function AnimatedDonutChart({
  data,
  title,
  description,
  centerLabel = "总计",
  unit = "",
  replayKey,
}: {
  data: VizDatum[];
  title: string;
  description?: string;
  centerLabel?: string;
  unit?: string;
  replayKey?: ReplayKey;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [motionRun, setMotionRun] = useState(0);
  const { reducedMotion } = useMotionPreference();
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const circumference = 2 * Math.PI * 46;
  const segments = useMemo(() => data.map((item, index) => {
    const lengthFor = (candidate: VizDatum) => total ? Math.max(0, candidate.value) / total * circumference : 0;
    const offset = data.slice(0, index).reduce((sum, candidate) => sum + lengthFor(candidate), 0);
    return { ...item, length: lengthFor(item), offset, color: colorFor(item, index) };
  }), [data, total, circumference]);
  const signature = dataSignature(data);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;
    if (total <= 0) {
      setMotionState("empty");
      return;
    }
    if (reducedMotion) {
      setMotionState("reduced");
      return;
    }

    setMotionState("idle");
    const circles = gsap.utils.toArray<SVGCircleElement>(".viz-donut-segment");
    const center = root.querySelector<HTMLElement>(".viz-donut-center");
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        gsap.set(circles, { clearProps: "strokeDasharray,transform,opacity,visibility,willChange" });
        if (center) gsap.set(center, { clearProps: "transform,opacity,visibility,willChange" });
        setMotionState("complete");
      },
    });

    timeline.set(circles, { willChange: "transform,opacity" }, 0);
    circles.forEach((circle, index) => {
      const segment = segments[index];
      timeline.fromTo(circle, {
        strokeDasharray: `0 ${circumference}`,
        scale: 0.35,
        rotation: -52,
        autoAlpha: 0,
        svgOrigin: "60 60",
      }, {
        strokeDasharray: `${segment.length} ${circumference - segment.length}`,
        scale: 1,
        rotation: 0,
        autoAlpha: 1,
        duration: 0.88,
        ease: "power3.out",
      }, index * 0.07);
    });
    if (center) {
      timeline
        .set(center, { willChange: "transform,opacity" }, 0)
        .fromTo(center, { scale: 0.84, autoAlpha: 0 }, {
          scale: 1,
          autoAlpha: 1,
          duration: 0.5,
          ease: "power3.out",
        }, 0.14);
    }

    return playWhenVisible(root, timeline, () => {
      setMotionRun(current => current + 1);
      setMotionState("running");
    });
  }, { dependencies: [signature, replayKey, reducedMotion], scope: rootRef, revertOnUpdate: true });

  return <section
    className="data-viz data-viz-donut"
    ref={rootRef}
    aria-label={title}
    data-motion-state={motionState}
    data-motion-run={motionRun}
  >
    <header className="data-viz-head"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><span>悬停查看明细</span></header>
    {total <= 0 ? <VizEmptyState /> : <div className="viz-donut-layout">
      <div className="viz-donut-canvas">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${title}，共 ${total}${unit}`}>
          <circle className="viz-donut-track" cx="60" cy="60" r="46" />
          <g className="viz-donut-orientation" transform="rotate(-90 60 60)">
            {segments.map((item, index) => <circle
              key={item.label}
              className={`viz-donut-segment ${active === index ? "active" : ""}`}
              cx="60"
              cy="60"
              r="46"
              pathLength={circumference}
              stroke={item.color}
              strokeDasharray={`${item.length} ${circumference - item.length}`}
              strokeDashoffset={-item.offset}
              tabIndex={0}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            ><title>{`${item.label}：${item.value}${unit}。${item.detail ?? ""}`}</title></circle>)}
          </g>
        </svg>
        <div className="viz-donut-center"><strong>{active == null ? total : data[active]?.value ?? total}{unit}</strong><span>{active == null ? centerLabel : data[active]?.label}</span></div>
      </div>
      <div className="viz-legend">
        {data.map((item, index) => <button type="button" key={item.label} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <i style={{ background: colorFor(item, index) }} /><span><b>{item.label}</b><small>{item.detail || "数据分类"}</small></span><strong>{item.value}{unit}</strong>
        </button>)}
      </div>
    </div>}
  </section>;
}

export function AnimatedLineChart({
  data,
  title,
  description,
  max,
  unit = "",
  replayKey,
}: {
  data: VizDatum[];
  title: string;
  description?: string;
  max?: number;
  unit?: string;
  replayKey?: ReplayKey;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [motionRun, setMotionRun] = useState(0);
  const { reducedMotion } = useMotionPreference();
  const width = 520;
  const height = 210;
  const padX = 34;
  const padY = 24;
  const ceiling = Math.max(1, max ?? Math.max(...data.map(item => item.value), 1));
  const points = data.map((item, index) => ({
    x: data.length <= 1 ? width / 2 : padX + index * (width - padX * 2) / (data.length - 1),
    y: height - padY - Math.min(1, Math.max(0, item.value / ceiling)) * (height - padY * 2),
  }));
  const path = points.length ? `M ${points.map(point => `${point.x} ${point.y}`).join(" L ")}` : "";
  const area = points.length ? `${path} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z` : "";
  const hasRenderableData = data.some(item => Number.isFinite(item.value) && item.value > 0);
  const signature = `${dataSignature(data)}|ceiling:${ceiling}`;

  useGSAP(() => {
    const root = rootRef.current;
    const pathElement = pathRef.current;
    if (!root) return;
    if (!hasRenderableData) {
      setMotionState("empty");
      return;
    }
    if (reducedMotion) {
      setMotionState("reduced");
      return;
    }
    if (!pathElement) return;

    setMotionState("idle");
    const areaElement = root.querySelector<SVGPathElement>(".viz-line-area");
    const pointElements = gsap.utils.toArray<SVGGElement>(".viz-line-point");
    const length = pathElement.getTotalLength();
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        gsap.set(pathElement, { clearProps: "strokeDasharray,strokeDashoffset,willChange" });
        if (areaElement) gsap.set(areaElement, { clearProps: "opacity,visibility,willChange" });
        gsap.set(pointElements, { clearProps: "transform,willChange" });
        setMotionState("complete");
      },
    });

    timeline.set(pathElement, { willChange: "stroke-dashoffset" }, 0);
    if (length > 0) {
      timeline.fromTo(pathElement, {
        strokeDasharray: length,
        strokeDashoffset: length,
      }, {
        strokeDashoffset: 0,
        duration: 0.95,
        ease: "power3.out",
      }, 0);
    }
    if (areaElement) {
      timeline
        .set(areaElement, { willChange: "opacity" }, 0)
        .fromTo(areaElement, { autoAlpha: 0 }, {
          autoAlpha: 0.13,
          duration: 0.55,
          ease: "power2.out",
        }, 0.22);
    }
    timeline
      .set(pointElements, { willChange: "transform" }, 0)
      .fromTo(pointElements, { scale: 0, transformOrigin: "center" }, {
        scale: 1,
        duration: 0.4,
        stagger: 0.055,
        ease: "power3.out",
      }, 0.18);

    return playWhenVisible(root, timeline, () => {
      setMotionRun(current => current + 1);
      setMotionState("running");
    });
  }, { dependencies: [signature, replayKey, reducedMotion], scope: rootRef, revertOnUpdate: true });

  return <section
    className="data-viz data-viz-line"
    ref={rootRef}
    aria-label={title}
    data-motion-state={motionState}
    data-motion-run={motionRun}
  >
    <header className="data-viz-head"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><span>折线随数据重绘</span></header>
    {!hasRenderableData ? <VizEmptyState /> : <div className="viz-line-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0.25, 0.5, 0.75].map(value => <line key={value} className="viz-grid-line" x1={padX} x2={width - padX} y1={padY + (height - padY * 2) * value} y2={padY + (height - padY * 2) * value} />)}
        <path className="viz-line-area" d={area} />
        <path ref={pathRef} className="viz-line-path" d={path} />
        {points.map((point, index) => <g className="viz-line-point" key={data[index].label} tabIndex={0} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
          <circle className="viz-line-hit" cx={point.x} cy={point.y} r="16" />
          <circle className="viz-line-dot" cx={point.x} cy={point.y} r="5" />
          <title>{`${data[index].label}：${data[index].value}${unit}。${data[index].detail ?? ""}`}</title>
        </g>)}
      </svg>
      {active != null && <div className="viz-line-tooltip" style={{ left: `${points[active].x / width * 100}%`, top: `${points[active].y / height * 100}%` }}><b>{data[active].label}</b><strong>{data[active].value}{unit}</strong><small>{data[active].detail || "当前节点"}</small></div>}
      <div className="viz-line-labels">{data.map(item => <span key={item.label}>{item.label}</span>)}</div>
    </div>}
  </section>;
}
