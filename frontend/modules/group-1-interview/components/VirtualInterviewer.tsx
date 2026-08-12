"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Image from "next/image";
import { useRef } from "react";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";

gsap.registerPlugin(useGSAP);

export type InterviewerState = "idle" | "thinking" | "speaking" | "listening" | "scoring";

interface VirtualInterviewerProps {
  state: InterviewerState;
  audioLevel?: number;
  ttsSource?: "tencent" | "browser" | "none";
}

const stateCopy: Record<InterviewerState, { label: string; detail: string }> = {
  idle: { label: "准备就绪", detail: "可以按自己的节奏开始" },
  thinking: { label: "正在整理思路", detail: "结合材料准备下一步问题" },
  speaking: { label: "正在提问", detail: "先听完问题，再组织回答" },
  listening: { label: "正在倾听", detail: "你的回答会实时转写" },
  scoring: { label: "正在复盘", detail: "从回答中提取证据与改进点" },
};

export default function VirtualInterviewer({
  state,
  audioLevel = 0,
  ttsSource = "none",
}: VirtualInterviewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotionPreference();

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;
    const portrait = root.querySelector<HTMLElement>("[data-mentor-portrait]");
    const halo = root.querySelector<HTMLElement>("[data-mentor-halo]");
    const signals = root.querySelectorAll<HTMLElement>("[data-mentor-signal]");
    gsap.killTweensOf([portrait, halo, signals]);

    if (reducedMotion) {
      gsap.set([portrait, halo, signals], { clearProps: "all" });
      return;
    }

    gsap.fromTo(portrait, {
      y: state === "listening" ? 2 : 5,
      rotate: state === "thinking" ? -0.45 : 0,
    }, {
      y: 0,
      rotate: 0,
      duration: 0.38,
      ease: "power3.out",
      overwrite: "auto",
    });
    gsap.fromTo(halo, { scale: 0.94, autoAlpha: 0.35 }, {
      scale: 1,
      autoAlpha: state === "idle" ? 0.42 : 0.78,
      duration: 0.42,
      ease: "power3.out",
      overwrite: "auto",
    });
    gsap.fromTo(signals, { scaleY: 0.25, autoAlpha: 0.32 }, {
      scaleY: state === "listening" || state === "speaking" ? 1 : 0.42,
      autoAlpha: state === "listening" || state === "speaking" ? 1 : 0.45,
      duration: 0.25,
      stagger: 0.025,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, { scope: rootRef, dependencies: [state, reducedMotion], revertOnUpdate: true });

  const status = stateCopy[state];
  const liveSignal = state === "listening" ? Math.max(0.22, Math.min(1, audioLevel)) : state === "speaking" ? 0.72 : 0.26;

  return (
    <div ref={rootRef} className={`virtual-interviewer mentor-state-${state}`} aria-label={`虚拟面试官 liuli 老师，${status.label}`}>
      <div className="mentor-portrait-stage">
        <span className="mentor-portrait-halo" data-mentor-halo aria-hidden="true" />
        <div className="mentor-portrait-copy">
          <span>LIULI · CAREER MENTOR</span>
          <b>{status.label}</b>
          <small>{status.detail}</small>
        </div>
        <div className="mentor-portrait-media" data-mentor-portrait>
          <Image
            src="/liuli-mentor-v2.jpg"
            alt="liuli 老师虚拟导师形象"
            width={1050}
            height={1400}
            priority
            sizes="(max-width: 900px) 70vw, 320px"
          />
        </div>
        <div className="mentor-signal" aria-hidden="true">
          {Array.from({ length: 11 }).map((_, index) => (
            <i
              key={index}
              data-mentor-signal
              style={{
                height: `${10 + Math.sin((index / 10) * Math.PI) * 16 * liveSignal}px`,
                animationDelay: `${index * 45}ms`,
              }}
            />
          ))}
        </div>
        <span className="mentor-virtual-badge">AI 虚拟形象 · 非真人</span>
      </div>
      <div className="mentor-identity">
        <strong>liuli 老师</strong>
        <span>青年职业导师 · 状态实时反馈</span>
      </div>
      <div className="interviewer-label" role="status" aria-live="polite">
        <span className={`indicator state-${state}`} />
        <span>{status.label}</span>
        {ttsSource !== "none" && state === "speaking" && (
          <small className="tts-source-badge">{ttsSource === "tencent" ? "云端语音" : "浏览器语音"}</small>
        )}
      </div>
    </div>
  );
}
