import { ArrowLeft, MapTrifold } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return <main className="route-state-page">
    <MapTrifold size={38} weight="duotone" />
    <h1>没有找到这个页面</h1>
    <p>链接可能已经变化。返回成长首页后，可以从左侧菜单重新进入功能。</p>
    <Link href="/dashboard"><ArrowLeft size={18} />返回成长首页</Link>
  </main>;
}
