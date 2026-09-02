"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { useMotionPreference } from "./motion-preference";
import {
  createContext,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

gsap.registerPlugin(useGSAP);

type RouteMotionContextValue = {
  goBack: () => void;
  navigate: (href: string) => void;
};

const RouteMotionContext = createContext<RouteMotionContextValue | null>(null);

function shouldHandleLink(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.dataset.noTransition === "true") return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  const target = new URL(anchor.href, window.location.href);
  return target.origin === window.location.origin && !target.pathname.startsWith("/api/");
}

function navigationAllowed() {
  const guard = document.querySelector<HTMLElement>("[data-navigation-guard]");
  if (!guard) return true;
  return window.confirm(guard.dataset.navigationGuard || "当前页面仍有未完成操作，确认离开吗？");
}

export function useRouteMotion() {
  const context = useContext(RouteMotionContext);
  if (!context) throw new Error("useRouteMotion must be used inside RouteMotionProvider");
  return context;
}

export default function RouteMotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const navigationTimeline = useRef<gsap.core.Timeline | null>(null);
  const navigating = useRef(false);
  const enteredPathname = useRef<string | null>(null);
  const pressRipples = useRef<Set<HTMLSpanElement>>(new Set());
  const { reducedMotion } = useMotionPreference();

  const runExit = useCallback((complete: () => void) => {
    if (navigating.current) return;
    navigating.current = true;
    navigationTimeline.current?.kill();
    if (reducedMotion) {
      complete();
      return;
    }
    navigationTimeline.current = gsap.timeline({
      defaults: { ease: "expo.out" },
      onComplete: complete,
    })
      .fromTo(streakRef.current, { scaleX: 0, xPercent: -50, autoAlpha: 0 }, { scaleX: 1, xPercent: 0, autoAlpha: 1, duration: 0.19, transformOrigin: "left center" }, 0)
      .to(stageRef.current, { x: -14, autoAlpha: 0.45, duration: 0.16 }, 0);
  }, [reducedMotion]);

  const navigate = useCallback((href: string) => {
    if (!navigationAllowed()) return;
    const target = new URL(href, window.location.href);
    if (target.pathname === pathname && target.search === window.location.search) {
      if (target.hash) window.location.hash = target.hash;
      return;
    }
    runExit(() => router.push(`${target.pathname}${target.search}${target.hash}`));
  }, [pathname, router, runExit]);

  const goBack = useCallback(() => {
    if (!navigationAllowed()) return;
    runExit(() => {
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    });
  }, [router, runExit]);

  useGSAP(() => {
    navigating.current = false;
    navigationTimeline.current?.kill();
    navigationTimeline.current = null;
    if (reducedMotion) {
      gsap.set(stageRef.current, { clearProps: "all", autoAlpha: 1 });
      gsap.set(streakRef.current, { autoAlpha: 0, scaleX: 0 });
      enteredPathname.current = pathname;
      return;
    }
    if (enteredPathname.current === pathname) {
      gsap.set(stageRef.current, { clearProps: "all", autoAlpha: 1 });
      gsap.set(streakRef.current, { autoAlpha: 0, scaleX: 0 });
      return;
    }
    enteredPathname.current = pathname;
    const timeline = gsap.timeline({ defaults: { ease: "expo.out" } });
    timeline
      .fromTo(stageRef.current, { x: 22, autoAlpha: 0.55 }, { x: 0, autoAlpha: 1, duration: 0.38, clearProps: "transform,opacity,visibility" }, 0)
      .to(streakRef.current, { xPercent: 105, autoAlpha: 0, duration: 0.34, clearProps: "transform,opacity,visibility" }, 0);
  }, { dependencies: [pathname, reducedMotion], scope: rootRef, revertOnUpdate: true });

  useEffect(() => {
    const ripples = pressRipples.current;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !shouldHandleLink(event, anchor)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.pathname === pathname && url.search === window.location.search) return;
      event.preventDefault();
      navigate(anchor.href);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>("button, [role='button']");
      if (!control || control.hasAttribute("disabled")) return;
      const rect = control.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 1.4;
      ripple.className = "global-press-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      control.appendChild(ripple);
      ripples.add(ripple);
      gsap.fromTo(ripple, { scale: 0.05, autoAlpha: 0.28 }, {
        scale: 1,
        autoAlpha: 0,
        duration: 0.5,
        ease: "expo.out",
        onComplete: () => {
          ripples.delete(ripple);
          ripple.remove();
        },
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      navigationTimeline.current?.kill();
      ripples.forEach(ripple => {
        gsap.killTweensOf(ripple);
        ripple.remove();
      });
      ripples.clear();
    };
  }, [navigate, pathname, reducedMotion]);

  const value = useMemo(() => ({ goBack, navigate }), [goBack, navigate]);

  return <RouteMotionContext.Provider value={value}>
    <div className="route-motion-root" ref={rootRef}>
      <div className="route-transition-streak" ref={streakRef} aria-hidden="true" />
      <div className="route-motion-stage" ref={stageRef}>{children}</div>
    </div>
  </RouteMotionContext.Provider>;
}

export function MotionAnchor({ href, children, className, onClick }: { href: string; children: ReactNode; className?: string; onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void }) {
  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}
