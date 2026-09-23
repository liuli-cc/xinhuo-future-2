"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
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
  useTransition,
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
  const [isPending, startTransition] = useTransition();
  const enteredPathname = useRef<string | null>(null);
  const { reducedMotion } = useMotionPreference();

  const navigate = useCallback((href: string) => {
    if (!navigationAllowed()) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) {
      window.location.assign(target.href);
      return;
    }
    if (target.pathname === pathname && target.search === window.location.search) {
      if (target.hash) window.location.hash = target.hash;
      return;
    }
    // Dispatch immediately. An exit animation must never delay the network request.
    startTransition(() => router.push(`${target.pathname}${target.search}${target.hash}`));
  }, [pathname, router]);

  const goBack = useCallback(() => {
    if (!navigationAllowed()) return;
    startTransition(() => {
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    });
  }, [router]);

  useGSAP(() => {
    navigationTimeline.current?.kill();
    if (!isPending || reducedMotion) {
      gsap.set(streakRef.current, { autoAlpha: 0, scaleX: 0 });
      return;
    }
    // Only show progress if navigation actually takes time; keep current content usable.
    navigationTimeline.current = gsap.timeline({ delay: 0.12 })
      .fromTo(streakRef.current, { scaleX: 0.06, autoAlpha: 0 }, { scaleX: 0.78, autoAlpha: 1, duration: 0.7, ease: "power3.out" });
  }, { dependencies: [isPending, reducedMotion], scope: rootRef, revertOnUpdate: true });

  useGSAP(() => {
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
    gsap.fromTo(stageRef.current,
      { opacity: 0.93 },
      { opacity: 1, duration: 0.18, ease: "power3.out", clearProps: "opacity,visibility" },
    );
  }, { dependencies: [pathname, reducedMotion], scope: rootRef, revertOnUpdate: true });

  useEffect(() => {
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

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [navigate, pathname]);

  const value = useMemo(() => ({ goBack, navigate }), [goBack, navigate]);

  return <RouteMotionContext.Provider value={value}>
    <div className="route-motion-root" ref={rootRef} data-route-pending={isPending || undefined}>
      <div className="route-transition-streak" ref={streakRef} aria-hidden="true" />
      <div className="route-motion-stage" ref={stageRef}>{children}</div>
    </div>
  </RouteMotionContext.Provider>;
}

export function MotionAnchor({ href, children, className, onClick }: { href: string; children: ReactNode; className?: string; onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void }) {
  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}
