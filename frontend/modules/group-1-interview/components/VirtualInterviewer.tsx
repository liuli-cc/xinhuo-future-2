"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef, useState } from "react";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";

gsap.registerPlugin(useGSAP);

export type InterviewerState = "idle" | "thinking" | "speaking" | "listening" | "scoring";
type MascotPose = "wave" | "walk" | "listen" | "think" | "speak" | "happy";

interface VirtualInterviewerProps {
  state: InterviewerState;
  audioLevel?: number;
  ttsSource?: "tencent" | "browser" | "none";
}

const stateCopy: Record<InterviewerState, { label: string; detail: string; pose: MascotPose }> = {
  idle: { label: "准备就绪", detail: "直接开口即可开始", pose: "wave" },
  thinking: { label: "正在思考", detail: "根据有效内容组织追问", pose: "think" },
  speaking: { label: "正在提问", detail: "麦克风持续开启，随时可以插话", pose: "speak" },
  listening: { label: "正在倾听", detail: "实时识别并校正中文表达", pose: "listen" },
  scoring: { label: "完成复盘", detail: "正在生成证据与改进建议", pose: "happy" },
};

export default function VirtualInterviewer({
  state,
  audioLevel = 0,
  ttsSource = "none",
}: VirtualInterviewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousStateRef = useRef<InterviewerState | null>(null);
  const [pose, setPose] = useState<MascotPose>(stateCopy[state].pose);
  const { reducedMotion } = useMotionPreference();

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;
    const mascot = root.querySelector<HTMLElement>("[data-mentor-mascot]");
    const halo = root.querySelector<HTMLElement>("[data-mentor-halo]");
    const signals = root.querySelectorAll<HTMLElement>("[data-mentor-signal]");
    const thoughtDots = root.querySelectorAll<HTMLElement>("[data-thought-dot]");
    const sparkles = root.querySelectorAll<HTMLElement>("[data-mentor-sparkle]");
    const targetPose = stateCopy[state].pose;
    gsap.killTweensOf([mascot, halo, signals, thoughtDots, sparkles]);

    if (reducedMotion) {
      setPose(targetPose);
      gsap.set([mascot, halo, signals, thoughtDots, sparkles], { clearProps: "all" });
      previousStateRef.current = state;
      return;
    }

    const changed = previousStateRef.current !== null && previousStateRef.current !== state;
    const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });
    timeline.addLabel("enter", 0);
    if (changed) {
      setPose("walk");
      timeline
        .fromTo(mascot, { x: -9, y: 2, rotation: -1.5 }, { x: 8, y: -2, rotation: 1.2, duration: 0.2 }, "enter")
        .to(mascot, { x: 0, y: 0, rotation: 0, duration: 0.2 })
        .call(() => setPose(targetPose));
    } else {
      setPose(targetPose);
      timeline.fromTo(mascot, { y: 5, scale: 0.985 }, { y: 0, scale: 1, duration: 0.34 }, "enter");
    }

    timeline.fromTo(halo, { scale: 0.9, autoAlpha: 0.3 }, {
      scale: state === "scoring" ? 1.12 : 1,
      autoAlpha: state === "idle" ? 0.4 : 0.8,
      duration: 0.42,
    }, "enter");
    timeline.fromTo(signals, { scaleY: 0.2, autoAlpha: 0.3 }, {
      scaleY: state === "listening" || state === "speaking" ? 1 : 0.45,
      autoAlpha: state === "listening" || state === "speaking" ? 1 : 0.45,
      duration: 0.24,
      stagger: 0.025,
    }, "enter+=0.08");

    if (state === "thinking") {
      timeline
        .fromTo(thoughtDots, { autoAlpha: 0, scale: 0.3, y: 8 }, {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.12,
          ease: "back.out(1.7)",
        }, ">-0.08")
        .to(mascot, { rotation: -1.5, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut" }, ">-0.1");
    }
    if (state === "listening") {
      timeline.to(mascot, { scale: 1.018, duration: 0.62, repeat: -1, yoyo: true, ease: "sine.inOut" }, ">-0.1");
    }
    if (state === "speaking") {
      timeline.to(mascot, { x: 3, rotation: 0.7, duration: 0.48, repeat: -1, yoyo: true, ease: "sine.inOut" }, ">-0.12");
    }
    if (state === "scoring") {
      timeline
        .fromTo(mascot, { y: 5, scale: 0.96 }, { y: -5, scale: 1.035, duration: 0.36, ease: "back.out(1.8)" }, ">-0.05")
        .to(mascot, { y: 0, scale: 1, duration: 0.28 })
        .fromTo(sparkles, { autoAlpha: 0, scale: 0, y: 8 }, {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: 0.36,
          stagger: 0.08,
          ease: "back.out(2)",
        }, "<");
    }
    previousStateRef.current = state;
  }, { scope: rootRef, dependencies: [state, reducedMotion], revertOnUpdate: true });

  const status = stateCopy[state];
  const liveSignal = state === "listening" ? Math.max(0.22, Math.min(1, audioLevel)) : state === "speaking" ? 0.72 : 0.26;

  return (
    <div ref={rootRef} className={`virtual-interviewer mentor-state-${state}`} aria-label={`虚拟面试官 liuli 老师，${status.label}`}>
      <div className="mentor-portrait-stage">
        <span className="mentor-portrait-halo" data-mentor-halo aria-hidden="true" />
        <div className="mentor-portrait-copy">
          <span>LIULI · AI CAREER MENTOR</span>
          <b>{status.label}</b>
          <small>{status.detail}</small>
        </div>
        <div className="mentor-mascot-wrap" aria-label={`可爱 AI 导师正在${status.label}`} role="img">
          <div className={`mentor-mascot-sprite pose-${pose}`} data-mentor-mascot />
          <div className="mentor-thought-dots" aria-hidden="true">
            <i data-thought-dot /><i data-thought-dot /><i data-thought-dot />
          </div>
          <div className="mentor-sparkles" aria-hidden="true">
            <i data-mentor-sparkle>✦</i><i data-mentor-sparkle>✦</i><i data-mentor-sparkle>✦</i>
          </div>
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
        <span className="mentor-virtual-badge">原创 AI 卡通形象 · 非真人</span>
      </div>
      <div className="mentor-identity">
        <strong>liuli 老师</strong>
        <span>AI 面试导师 · 动作随对话进度变化</span>
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
