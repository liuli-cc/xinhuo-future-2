"use client";

import * as THREE from "three";
import { memo, useEffect, useRef } from "react";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";
import { createLiuliRig, disposeLiuliScene } from "../avatar/liuli-rig";

export type InterviewerState = "idle" | "thinking" | "speaking" | "listening" | "scoring";

interface VirtualInterviewerProps {
  state: InterviewerState;
  audioLevel?: number;
  /** Separate microphone level when playback and recording are both active. */
  inputLevel?: number;
  ttsSource?: "tencent" | "browser" | "none";
}

type Pose = {
  tilt: number; turn: number; nod: number;
  left: number; right: number; elbow: number; lean: number;
};
const POSES: Record<InterviewerState, Pose> = {
  idle: { tilt: 0, turn: 0, nod: 0, left: -0.1, right: 0.1, elbow: -0.12, lean: 0 },
  listening: { tilt: -0.085, turn: 0.035, nod: 0.035, left: -0.16, right: 0.15, elbow: -0.16, lean: 0.035 },
  thinking: { tilt: 0.08, turn: -0.12, nod: -0.045, left: -0.1, right: 0.66, elbow: -1.9, lean: -0.025 },
  speaking: { tilt: 0.015, turn: 0, nod: 0, left: -0.35, right: 0.72, elbow: -0.6, lean: 0 },
  scoring: { tilt: 0.02, turn: 0, nod: 0.15, left: -0.34, right: 0.34, elbow: -0.9, lean: 0.025 },
};

function VirtualInterviewer({ state, audioLevel = 0, inputLevel, ttsSource = "none" }: VirtualInterviewerProps) {
  const { reducedMotion } = useMotionPreference();
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ state, audioLevel, inputLevel, reducedMotion });
  const requestRender = useRef<(() => void) | null>(null);

  useEffect(() => {
    latest.current = { state, audioLevel, inputLevel, reducedMotion };
    requestRender.current?.();
  }, [state, audioLevel, inputLevel, reducedMotion]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      mount.dataset.rendering = "fallback";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.7, 1.7, 2, -2, 0.1, 20);
    camera.position.set(0, 0.6, 7);
    camera.lookAt(0, 0.23, 0);
    scene.add(new THREE.HemisphereLight(0xfff5e6, 0x7182a2, 2.5));
    const key = new THREE.DirectionalLight(0xfff1dc, 3.1);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xadc5ff, 2.6);
    rim.position.set(3, 2, -2);
    scene.add(rim);
    const rig = createLiuliRig();
    scene.add(rig.root);

    // A small contact shadow avoids a continuously updated shadow-map pass.
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), new THREE.MeshBasicMaterial({ color: 0x090e21, transparent: true, opacity: 0.23, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 0.6;
    shadow.position.set(0.03, -1.405, 0.08);
    scene.add(shadow);

    const pose = { ...POSES[latest.current.state] };
    const poseKeys = Object.keys(pose) as Array<keyof Pose>;
    let frame = 0;
    let disposed = false;
    let inViewport = true;
    let pageVisible = document.visibilityState === "visible";
    let contextLost = false;
    let lastFrame = 0;
    let elapsed = 0;
    let mouthOpen = 0;

    const render = (now: number) => {
      frame = 0;
      if (disposed || !inViewport || !pageVisible || contextLost) return;
      const current = latest.current;
      const active = current.state === "speaking" || current.state === "listening";
      // Idle does not need a 120 Hz canvas on ProMotion screens.
      const interval = active ? 1000 / 60 : 1000 / 30;
      if (!current.reducedMotion && now - lastFrame < interval - 1) {
        frame = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(0.05, (now - lastFrame) / 1000 || 1 / 60);
      lastFrame = now;
      elapsed += dt;
      const t = elapsed;
      const motion = current.reducedMotion ? 0 : 1;
      const blend = current.reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
      const target = POSES[current.state];
      poseKeys.forEach(key => { pose[key] += (target[key] - pose[key]) * blend; });
      const speaking = current.state === "speaking";
      const listening = current.state === "listening";
      const signal = THREE.MathUtils.clamp(current.audioLevel || 0, 0, 1);
      const microphone = THREE.MathUtils.clamp(current.inputLevel ?? current.audioLevel ?? 0, 0, 1);
      const voice = speaking ? Math.max(signal, (0.25 + 0.2 * Math.sin(t * 19)) * (0.6 + 0.4 * Math.sin(t * 7))) : 0;
      mouthOpen += ((speaking ? 0.25 + voice * 0.8 : 0) - mouthOpen) * (1 - Math.exp(-dt * 24));
      rig.root.position.y = Math.sin(t * 1.8) * 0.009 * motion;
      rig.root.rotation.set(pose.lean, Math.sin(t * 0.7) * 0.022 * motion, Math.sin(t * 1.1) * 0.009 * motion);
      rig.head.rotation.set(pose.nod + (listening ? Math.sin(t * 2.4) * microphone * 0.06 : speaking ? Math.sin(t * 4) * voice * 0.045 : 0) * motion, pose.turn, pose.tilt);
      rig.arms[0].rotation.z = pose.left - (speaking ? Math.sin(t * 2.7) * 0.07 : 0) * motion;
      rig.arms[1].rotation.z = pose.right + (speaking ? Math.sin(t * 3.1) * 0.1 : 0) * motion;
      rig.forearms[0].rotation.x = pose.elbow * (current.state === "thinking" ? 0.07 : 0.7);
      rig.forearms[1].rotation.x = pose.elbow + (speaking ? Math.sin(t * 4) * 0.1 : 0) * motion;
      rig.tail.rotation.set(0, Math.sin(t * (listening ? 2.8 : 1.6)) * 0.14 * motion, Math.sin(t * 1.3) * 0.055 * motion);
      rig.feet[0].rotation.z = -0.035 + Math.sin(t * 1.1) * 0.012 * motion;
      rig.feet[1].rotation.z = 0.035 + Math.sin(t * 1.1) * 0.012 * motion;
      rig.ears.forEach((ear, i) => { ear.rotation.z = (i === 0 ? 1 : -1) * (0.26 + (listening ? microphone * 0.14 : 0)) + Math.sin(t * 2.1 + i) * 0.023 * motion; });
      const blinkPhase = t % 4.7;
      const blink = motion && blinkPhase > 4.5 ? 1 - Math.sin((blinkPhase - 4.5) / 0.2 * Math.PI) * 0.94 : 1;
      rig.eyes.forEach(eye => { eye.scale.y = blink; });
      rig.brows.forEach((brow, i) => { brow.position.y = 0.31 + (speaking ? voice * 0.03 : listening ? 0.035 : 0) * motion; brow.rotation.z = (i === 0 ? 1 : -1) * (current.state === "thinking" ? 0.33 : 0.2); });
      const openness = current.reducedMotion ? (speaking ? 0.45 : 0) : mouthOpen;
      rig.mouth.scale.set(0.085 * (1 - openness * 0.2), Math.max(0.003, 0.095 * openness), 0.018);
      rig.mouth.visible = openness > 0.08;
      rig.smile.visible = openness < 0.4;
      renderer.render(scene, camera);
      mount.dataset.rendering = "ready";
      if (!current.reducedMotion) frame = requestAnimationFrame(render);
    };
    const request = () => {
      if (disposed || frame || !inViewport || !pageVisible || contextLost) return;
      frame = requestAnimationFrame(render);
    };
    requestRender.current = request;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const halfHeight = Math.max(1.95, 1.5 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      request();
    };
    const pause = () => { cancelAnimationFrame(frame); frame = 0; lastFrame = performance.now(); };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    const intersectionObserver = new IntersectionObserver(entries => {
      inViewport = entries[0]?.isIntersecting ?? false;
      if (inViewport) request(); else pause();
    });
    intersectionObserver.observe(mount);
    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible) request(); else pause();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault(); contextLost = true; pause(); mount.dataset.rendering = "fallback";
    };
    const onContextRestored = () => { contextLost = false; request(); };
    document.addEventListener("visibilitychange", onVisibility);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    resize();
    return () => {
      disposed = true;
      pause();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      requestRender.current = null;
      disposeLiuliScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const expression = { idle: "准备就绪", thinking: "思考中", speaking: "正在交流", listening: "认真倾听", scoring: "整理反馈" }[state];
  return <div className={`virtual-interviewer mentor-state-${state}`} aria-label={`虚拟面试官 liuli 老师，${expression}`} data-voice-source={ttsSource}>
    <div className="mentor-3d-stage" ref={mountRef}>
      <svg className="mentor-fallback" viewBox="0 0 260 330" aria-hidden="true">
        <ellipse cx="130" cy="302" rx="58" ry="9" fill="#111c36" opacity=".3" />
        <path d="M166 243 Q230 263 210 191" fill="none" stroke="#d27648" strokeWidth="28" strokeLinecap="round" />
        <path d="M201 242l16-11m-10-9 14-9m-15-8 13-8" stroke="#f4bc83" strokeWidth="10" />
        <path d="M111 247v39m37-39v39" stroke="#4b3337" strokeWidth="29" strokeLinecap="round" />
        <ellipse cx="130" cy="218" rx="49" ry="60" fill="#656eac" />
        <path d="M88 197l-9 47m92-47 8 47" stroke="#d27648" strokeWidth="23" strokeLinecap="round" />
        <path d="M78 242v8m102-8v8" stroke="#4b3337" strokeWidth="25" strokeLinecap="round" />
        <path d="M71 96Q42 26 86 47l22 27m43 0 22-27q44-21 15 49" fill="#ffead0" stroke="#4b3337" strokeWidth="10" />
        <ellipse cx="130" cy="122" rx="72" ry="64" fill="#d27648" />
        <ellipse cx="92" cy="146" rx="35" ry="29" fill="#ffead0" /><ellipse cx="168" cy="146" rx="35" ry="29" fill="#ffead0" />
        <ellipse cx="130" cy="151" rx="35" ry="27" fill="#ffead0" />
        <ellipse cx="102" cy="119" rx="16" ry="21" fill="#713f39" /><ellipse cx="158" cy="119" rx="16" ry="21" fill="#713f39" />
        <ellipse cx="102" cy="116" rx="8" ry="11" fill="#211f2b" /><ellipse cx="158" cy="116" rx="8" ry="11" fill="#211f2b" />
        <circle cx="99" cy="112" r="3" fill="white" /><circle cx="155" cy="112" r="3" fill="white" />
        <path d="M91 91q11-7 22 0m34 0q11-7 22 0" fill="none" stroke="#ffead0" strokeWidth="9" strokeLinecap="round" />
        <ellipse cx="130" cy="143" rx="9" ry="6" fill="#211f2b" />
        <path d="M119 155q11 13 22 0" fill="none" stroke="#713f39" strokeWidth="3" strokeLinecap="round" />
        <circle cx="130" cy="212" r="3" fill="#ffead0" /><circle cx="130" cy="230" r="3" fill="#ffead0" />
      </svg>
    </div>
    <div className="mentor-identity"><strong>liuli 老师</strong><span>你的面试搭档</span></div>
    <div className="interviewer-label" role="status"><span className={`indicator state-${state}`} /><span>{expression}</span></div>
  </div>;
}

export default memo(VirtualInterviewer);
