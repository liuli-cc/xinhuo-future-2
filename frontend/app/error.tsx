"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state-page">
    <WarningCircle size={38} weight="duotone" />
    <h1>这个页面暂时没有准备好</h1>
    <p>你的数据没有被修改。可以重新加载当前页面，或返回上一页继续使用。</p>
    <button onClick={reset}><ArrowClockwise size={18} />重新加载</button>
  </main>;
}
