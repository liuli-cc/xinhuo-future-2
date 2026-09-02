"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CheckCircle, FlagBanner, Waves } from "@phosphor-icons/react";
import { CSSProperties, KeyboardEvent, useRef } from "react";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";

gsap.registerPlugin(useGSAP);

type SemesterJourney = {
  label: string;
  theme: string;
  progress: number;
};

const riverPath = "M 54 52 C 142 12 232 16 306 63 C 397 121 500 107 583 52 C 671 -6 770 15 836 68 C 902 121 970 86 1010 42";
const stopY = [31, 82, 34, 75];

export default function FourYearJourney({
  semesters,
  currentIndex,
  selectedIndex,
  onSelect,
}: {
  semesters: SemesterJourney[];
  currentIndex: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const entryPlayedRef = useRef(false);
  const previousProgressRef = useRef(0);
  const selectedReadyRef = useRef(false);
  const { reducedMotion } = useMotionPreference();

  const years = [0, 1, 2, 3].map(yearIndex => {
    const semesterIndexes = [yearIndex * 2, yearIndex * 2 + 1];
    const progress = Math.round(semesterIndexes.reduce((sum, index) => sum + (semesters[index]?.progress ?? 0), 0) / 2);
    return { yearIndex, semesterIndexes, progress };
  });
  const routeProgress = Math.min(100, Math.max(5, currentIndex / 7 * 100));

  useGSAP(() => {
    const root = rootRef.current;
    const canvas = root?.querySelector<HTMLElement>(".journey-river-shell");
    const progressPath = root?.querySelector<SVGPathElement>(".journey-river-progress");
    if (!root || !canvas || !progressPath) return;

    const endOffset = 100 - routeProgress;
    if (reducedMotion) {
      gsap.set(canvas, { x: 0, autoAlpha: 1, clearProps: "transform,opacity,visibility,will-change" });
      gsap.set(progressPath, { strokeDashoffset: endOffset });
      previousProgressRef.current = routeProgress;
      entryPlayedRef.current = true;
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const fromScreenLeft = -Math.max(bounds.right + 28, window.innerWidth * 0.72);
    const timeline = gsap.timeline({ defaults: { ease: "expo.out" } });
    gsap.set(canvas, { willChange: "transform,opacity" });
    timeline
      .fromTo(canvas, { x: fromScreenLeft, autoAlpha: 0.2 }, {
        x: 0,
        autoAlpha: 1,
        duration: 1.04,
        clearProps: "transform,opacity,visibility,will-change",
      }, 0)
      .fromTo(".journey-river-bank, .journey-river-body", {
        strokeDasharray: 100,
        strokeDashoffset: 100,
      }, {
        strokeDashoffset: 0,
        duration: 1.1,
        stagger: 0.05,
        clearProps: "strokeDasharray,strokeDashoffset",
      }, 0.08)
      .fromTo(progressPath, {
        strokeDasharray: 100,
        strokeDashoffset: 100,
      }, {
        strokeDashoffset: endOffset,
        duration: 1.15,
      }, 0.16)
      .fromTo(".journey-river-highlight", {
        strokeDashoffset: 36,
        autoAlpha: 0,
      }, {
        strokeDashoffset: 0,
        autoAlpha: 0.78,
        duration: 0.92,
      }, 0.32)
      .fromTo(".journey-year-stop", {
        x: -34,
        scale: 0.82,
        autoAlpha: 0,
      }, {
        x: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.42,
        stagger: 0.085,
      }, 0.38)
      .fromTo(".journey-semester", {
        y: 18,
        autoAlpha: 0,
      }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.42,
        stagger: 0.045,
      }, 0.48);
    entryPlayedRef.current = true;
    previousProgressRef.current = routeProgress;
  }, {
    dependencies: [reducedMotion],
    scope: rootRef,
    revertOnUpdate: true,
  });

  useGSAP(() => {
    const progressPath = rootRef.current?.querySelector<SVGPathElement>(".journey-river-progress");
    if (!progressPath || !entryPlayedRef.current || previousProgressRef.current === routeProgress) return;
    const endOffset = 100 - routeProgress;
    if (reducedMotion) {
      gsap.killTweensOf(progressPath);
      gsap.set(progressPath, { strokeDashoffset: endOffset });
    } else {
      gsap.to(progressPath, {
        strokeDashoffset: endOffset,
        duration: 0.72,
        ease: "expo.out",
        overwrite: "auto",
      });
    }
    previousProgressRef.current = routeProgress;
  }, { dependencies: [routeProgress, reducedMotion], scope: rootRef, revertOnUpdate: true });

  useGSAP(() => {
    if (!selectedReadyRef.current) {
      selectedReadyRef.current = true;
      return;
    }
    const button = rootRef.current?.querySelector<HTMLButtonElement>(`[data-semester-index="${selectedIndex}"]`);
    if (!button) return;
    button.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
    if (reducedMotion) return;
    gsap.fromTo(button, { y: 4, scale: 0.97 }, { y: 0, scale: 1, duration: 0.2, ease: "expo.out", clearProps: "transform" });
  }, { dependencies: [selectedIndex, reducedMotion], scope: rootRef, revertOnUpdate: true });

  const chooseFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = Math.max(0, semesters.length - 1);
    const target = event.key === "ArrowRight"
      ? Math.min(lastIndex, index + 1)
      : event.key === "ArrowLeft"
        ? Math.max(0, index - 1)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? lastIndex
            : null;
    if (target == null) return;
    event.preventDefault();
    onSelect(target);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-semester-index="${target}"]`)?.focus());
  };

  return <section className="four-year-journey" ref={rootRef} aria-label="大学四年成长路径">
    <header>
      <div><span className="journey-icon"><Waves size={20} weight="duotone" /></span><div><h2>大学四年成长河流</h2><p>路径从屏幕左侧汇入，沿河查看八个学期的行动与佐证。</p></div></div>
      <span className="journey-current">当前位于第 {currentIndex + 1} 学期</span>
    </header>
    <div className="journey-scroll">
      <div className="journey-canvas">
        <div className="journey-river-shell" aria-hidden="true">
          <svg className="journey-river" viewBox="0 0 1060 130" preserveAspectRatio="none">
            <defs>
              <linearGradient id="journey-river-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="var(--river-start)" />
                <stop offset="0.5" stopColor="var(--river-middle)" />
                <stop offset="1" stopColor="var(--river-end)" />
              </linearGradient>
            </defs>
            <path className="journey-river-bank" pathLength="100" d={riverPath} />
            <path className="journey-river-body" pathLength="100" d={riverPath} />
            <path className="journey-river-progress" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - routeProgress} d={riverPath} />
            <path className="journey-river-highlight" pathLength="100" strokeDasharray="2 7" d={riverPath} />
          </svg>
          <div className="journey-year-stops">
            {years.map(({ yearIndex, semesterIndexes, progress }) => {
              const isPast = semesterIndexes[1] < currentIndex;
              const isCurrent = semesterIndexes.includes(currentIndex);
              return <div
                className={`journey-year-stop ${isPast ? "past" : ""} ${isCurrent ? "current" : ""}`}
                key={yearIndex}
                style={{ "--river-y": `${stopY[yearIndex]}px` } as CSSProperties}
              >
                <span className="journey-year-node">{isPast ? <CheckCircle size={21} weight="fill" /> : yearIndex === 3 ? <FlagBanner size={20} weight="duotone" /> : yearIndex + 1}</span>
                <span className="journey-year-copy"><b>大学第 {yearIndex + 1} 年</b><strong>{progress}%</strong></span>
              </div>;
            })}
          </div>
        </div>

        <div className="journey-years">
          {years.map(({ yearIndex, semesterIndexes }) => <article className="journey-year" key={yearIndex}>
            <div className="journey-semesters">
              {semesterIndexes.map(index => {
                const item = semesters[index];
                if (!item) return null;
                return <button
                  type="button"
                  className={`journey-semester ${selectedIndex === index ? "active" : ""} ${currentIndex === index ? "current" : ""}`}
                  data-semester-index={index}
                  key={item.label}
                  onClick={() => onSelect(index)}
                  onKeyDown={event => chooseFromKeyboard(event, index)}
                  aria-pressed={selectedIndex === index}
                  title={`${item.label}：${item.theme}，任务进度 ${item.progress}%`}
                >
                  <span>{item.label}</span><b>{item.theme}</b><i><em style={{ width: `${item.progress}%` }} /></i><small>{item.progress}% 已核验</small>
                </button>;
              })}
            </div>
          </article>)}
        </div>
      </div>
    </div>
  </section>;
}
