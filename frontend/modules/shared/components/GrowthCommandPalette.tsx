"use client";

import {
  Briefcase,
  ChartDonut,
  Command,
  HouseLine,
  MapTrifold,
  Robot,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const destinations = [
  { href: "/dashboard", label: "成长首页", hint: "回到今日总览", icon: HouseLine },
  { href: "/growth-map", label: "成长地图", hint: "继续任务与提交佐证", icon: MapTrifold },
  { href: "/portrait", label: "能力画像", hint: "查看证据计算结果", icon: ChartDonut },
  { href: "/ai", label: "成长决策", hint: "生成下一项优先行动", icon: Sparkle },
  { href: "/career", label: "实习就业", hint: "岗位、投递与复盘", icon: Briefcase },
  { href: "/interview", label: "模拟面试", hint: "和 liuli 老师练习", icon: Robot },
];

export default function GrowthCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(value => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const filtered = destinations.filter(item => `${item.label}${item.hint}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <button className="app-command-trigger" onClick={() => setOpen(true)} aria-label="打开快捷导航">
      <Command size={17} /><span>快捷前往</span><kbd>⌘ K</kbd>
    </button>
    {open && <div className="command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="快捷导航" onMouseDown={event => event.stopPropagation()}>
        <label><Command size={19} /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索成长功能…" /><kbd>ESC</kbd></label>
        <div>
          {filtered.map(item => {
            const Icon = item.icon;
            return <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
              <i><Icon size={20} weight="duotone" /></i><span><b>{item.label}</b><small>{item.hint}</small></span><em>↗</em>
            </Link>;
          })}
          {!filtered.length && <p>没有匹配功能，试试“面试”或“画像”。</p>}
        </div>
      </section>
    </div>}
  </>;
}
