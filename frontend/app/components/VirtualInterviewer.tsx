"use client";

import * as THREE from "three";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

export type InterviewerState = "idle" | "thinking" | "speaking" | "listening" | "scoring";

interface VirtualInterviewerProps {
  state: InterviewerState;
  audioLevel?: number;
  ttsSource?: "tencent" | "browser" | "none";
}

type Rig = {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  eyes: THREE.Mesh[];
};

type Pose = {
  headTilt: number;
  headTurn: number;
  headNod: number;
  leftArm: number;
  rightArm: number;
  rightArmPitch: number;
};

function capsule(
  radius: number,
  length: number,
  material: THREE.Material,
  rotationZ = 0,
) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 18), material);
  mesh.rotation.z = rotationZ;
  mesh.castShadow = true;
  return mesh;
}

function buildLiuliTeacher(scene: THREE.Scene): Rig {
  const root = new THREE.Group();
  root.position.y = -0.18;
  scene.add(root);

  const skin = new THREE.MeshStandardMaterial({ color: 0xf6c9a6, roughness: 0.78 });
  const skinSoft = new THREE.MeshStandardMaterial({ color: 0xf2b998, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x292331, roughness: 0.68 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x5b63d8, roughness: 0.58 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xf7f8ff, roughness: 0.86 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x262134, roughness: 0.5 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xf497a8, transparent: true, opacity: 0.6 });

  const torso = capsule(0.53, 0.72, jacket);
  torso.scale.set(1.08, 1, 0.72);
  torso.position.y = -0.72;
  root.add(torso);

  const shirtFront = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 16), shirt);
  shirtFront.scale.set(1, 1.08, 0.3);
  shirtFront.position.set(0, -0.51, 0.49);
  root.add(shirtFront);

  const neck = capsule(0.15, 0.18, skin);
  neck.position.y = -0.03;
  root.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.52;
  root.add(head);

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.67, 32, 24), hair);
  hairBack.scale.set(0.98, 1.13, 0.86);
  hairBack.position.set(0, 0.02, -0.08);
  hairBack.castShadow = true;
  head.add(hairBack);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), skin);
  face.scale.set(0.92, 1.04, 0.82);
  face.position.z = 0.16;
  face.castShadow = true;
  head.add(face);

  const fringePieces = [
    [-0.31, 0.42, 0.38, -0.28],
    [-0.08, 0.49, 0.43, -0.1],
    [0.18, 0.46, 0.39, 0.18],
  ] as const;
  fringePieces.forEach(([x, y, scale, tilt]) => {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), hair);
    piece.scale.set(scale, 0.62, 0.52);
    piece.position.set(x, y, 0.47);
    piece.rotation.z = tilt;
    head.add(piece);
  });

  const eyes: THREE.Mesh[] = [];
  [-0.2, 0.2].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), ink);
    eye.scale.set(0.72, 1, 0.55);
    eye.position.set(x, 0.12, 0.63);
    head.add(eye);
    eyes.push(eye);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), blush);
    cheek.scale.set(1.35, 0.45, 0.35);
    cheek.position.set(x * 1.46, -0.08, 0.61);
    head.add(cheek);
  });

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), skinSoft);
  nose.position.set(0, 0.01, 0.69);
  head.add(nose);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.012, 8, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x9a4f61, roughness: 0.6 }),
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.17, 0.675);
  head.add(smile);

  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.55, -0.42, 0.05);
    const sleeve = capsule(0.14, 0.52, jacket, side * -0.08);
    sleeve.position.y = -0.28;
    pivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), skin);
    hand.position.set(side * 0.05, -0.64, 0.02);
    hand.castShadow = true;
    pivot.add(hand);
    root.add(pivot);
    return pivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  return { root, head, leftArm, rightArm, eyes };
}

export default function VirtualInterviewer({
  state,
  audioLevel = 0,
  ttsSource = "none",
}: VirtualInterviewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const rigRef = useRef<Rig | null>(null);
  const reducedMotionRef = useRef(false);
  const poseRef = useRef<Pose>({
    headTilt: 0,
    headTurn: 0,
    headNod: 0,
    leftArm: 0.08,
    rightArm: -0.08,
    rightArmPitch: 0,
  });

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0.25, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf5f6ff, 0x35304c, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(2.8, 4.2, 4.5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8fa4ff, 1.8);
    rimLight.position.set(-3.5, 1.4, -2);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshStandardMaterial({ color: 0xcdd3f8, transparent: true, opacity: 0.34, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.48;
    floor.receiveShadow = true;
    scene.add(floor);

    const rig = buildLiuliTeacher(scene);
    rigRef.current = rig;
    const poseState = poseRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedMotionRef.current = reducedMotion;
    let frame = 0;
    let disposed = false;
    const startedAt = Date.now();

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const render = () => {
      if (disposed) return;
      const t = (Date.now() - startedAt) / 1000;
      const current = stateRef.current;
      const motion = reducedMotion ? 0 : 1;
      const pose = poseState;
      rig.root.position.y = -0.18 + Math.sin(t * 1.8) * 0.018 * motion;
      rig.root.rotation.y = Math.sin(t * 0.48) * 0.035 * motion;
      rig.head.rotation.set(
        pose.headNod + (current === "speaking" ? Math.sin(t * 3.4) * 0.018 * motion : 0),
        pose.headTurn,
        pose.headTilt + (current === "listening" ? Math.sin(t * 1.4) * 0.018 * motion : 0),
      );
      rig.leftArm.rotation.set(0, 0, pose.leftArm);
      rig.rightArm.rotation.set(
        pose.rightArmPitch,
        0,
        pose.rightArm + (current === "speaking" ? Math.sin(t * 4.4) * 0.12 * motion : current === "scoring" ? Math.sin(t * 5) * 0.03 * motion : 0),
      );

      const blink = !reducedMotion && Math.sin(t * 0.82) > 0.992;
      rig.eyes.forEach(eye => { eye.scale.y = blink ? 0.08 : 1; });
      const voiceBounce = current === "speaking" ? Math.min(0.04, audioLevelRef.current * 0.04) : 0;
      rig.head.position.y = voiceBounce;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      gsap.killTweensOf(poseState);
      rigRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      });
    };
  }, []);

  useEffect(() => {
    if (!rigRef.current) return;
    const target: Pose = state === "listening"
      ? { headTilt: -0.048, headTurn: 0, headNod: 0, leftArm: 0.08, rightArm: -0.23, rightArmPitch: 0 }
      : state === "thinking"
        ? { headTilt: 0.08, headTurn: -0.12, headNod: 0.02, leftArm: 0.08, rightArm: -1.18, rightArmPitch: -0.22 }
        : state === "speaking"
          ? { headTilt: 0, headTurn: 0, headNod: 0, leftArm: 0.08, rightArm: -0.68, rightArmPitch: -0.16 }
          : state === "scoring"
            ? { headTilt: 0, headTurn: 0, headNod: 0.1, leftArm: 0.5, rightArm: -0.5, rightArmPitch: 0 }
            : { headTilt: 0, headTurn: 0, headNod: 0, leftArm: 0.08, rightArm: -0.08, rightArmPitch: 0 };

    if (reducedMotionRef.current) {
      Object.assign(poseRef.current, target);
      return;
    }

    gsap.to(poseRef.current, {
      ...target,
      duration: 0.28,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [state]);

  const expression = state === "listening"
    ? "专注倾听"
    : state === "thinking"
      ? "整理思路"
      : state === "speaking"
        ? "温和提问"
        : state === "scoring"
          ? "记录反馈"
          : "准备就绪";

  return (
    <div className={`virtual-interviewer mentor-state-${state}`} aria-label={`虚拟面试官liuli老师，${expression}`}>
      <div className="mentor-3d-stage" ref={mountRef} />
      <div className="mentor-identity">
        <strong>liuli老师</strong>
        <span>青年职业导师 · 3D 实时形象</span>
      </div>
      <div className="interviewer-label">
        <span className={`indicator state-${state}`} />
        <span>
          {state === "idle" && "随时可以开始"}
          {state === "thinking" && "正在整理下一步问题"}
          {state === "speaking" && "正在和你交流"}
          {state === "listening" && "正在认真倾听"}
          {state === "scoring" && "正在整理面试反馈"}
        </span>
        {ttsSource !== "none" && state === "speaking" && (
          <small className="tts-source-badge">{ttsSource === "tencent" ? "云TTS" : "浏览器"}</small>
        )}
      </div>
    </div>
  );
}
