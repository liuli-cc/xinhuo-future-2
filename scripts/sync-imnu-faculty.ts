/**
 * 从内蒙古师范大学各二级学院官网的公开页面构建师资目录快照。
 *
 * 使用：node --experimental-strip-types scripts/sync-imnu-faculty.ts
 * 输出：data/imnu-faculty-snapshot.json
 *
 * 只抓取学校组织机构页列出的学院官网，且仅保存公开可见的姓名、职称/导师层级线索、
 * 页面地址和来源页；不猜测邮箱、研究方向或未公开的个人资料。
 */
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { imnuColleges } from "../data/imnu-colleges.ts";

type Person = {
  id: string;
  name: string;
  title: string;
  position: string;
  mentorLevel: "博士研究生导师" | "硕士研究生导师" | "教师";
  researchAreas: string[];
  email: string;
  description: string;
  profileUrl: string;
  sourceUpdatedAt: string;
};

type CollegeSnapshot = {
  id: string;
  name: string;
  officialUrl: string;
  facultySourceUrl: string;
  mentorSourceUrl: string;
  sourceStatus: "synced" | "no_public_directory" | "no_official_url" | "site_unavailable";
  sourceNote: string;
  faculty: Person[];
};

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "../data/imnu-faculty-snapshot.json");
const updatedAt = new Date().toISOString().slice(0, 10);
const namePattern = /^[\u3400-\u9fff·]{2,5}$/;
const ignoredNames = new Set([
  "首页", "学院概况", "学院简介", "联系我们", "返回首页", "更多", "详情", "查看详情", "教师", "师资队伍", "导师队伍", "研究生导师", "教学名师", "专家教授", "教授", "副教授", "讲师", "人才招聘", "党政管理", "行政人员", "下载中心", "返回上页", "上一页", "下一页",
]);

const candidatePathHints = [
  "szdw.htm", "jsml.htm", "jsfc.htm", "dsfc.htm", "dsml.htm",
  "xygk/jsml.htm", "xygk/szdw.htm", "szdw/jsml.htm", "szdw.htm",
];

function stripHtml(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function urlFor(value: string, base: string) {
  try {
    const next = new URL(value.replace(/&amp;/g, "&"), base);
    return next.protocol === "http:" || next.protocol === "https:" ? next.toString() : "";
  } catch {
    return "";
  }
}

function isSameSite(candidate: string, home: string) {
  try {
    return new URL(candidate).hostname === new URL(home).hostname;
  } catch {
    return false;
  }
}

async function readPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "XinhuoFacultyDirectory/1.0 (+public directory sync)" },
      redirect: "follow",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    return { url: response.url, html: await response.text() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function anchors(html: string, base: string) {
  const result: Array<{ text: string; url: string }> = [];
  const matcher = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(matcher)) {
    const text = stripHtml(match[2]);
    const url = urlFor(match[1], base);
    if (text && url) result.push({ text, url });
  }
  return result;
}

function facultyLinks(page: { url: string; html: string }, home: string) {
  const relevant = /(师资|教师|导师|教授|队伍|人才|faculty|teacher)/i;
  return unique(anchors(page.html, page.url)
    .filter(link => isSameSite(link.url, home) && relevant.test(link.text + link.url))
    .map(link => link.url))
    .slice(0, 5);
}

function textNear(html: string, marker: number, radius = 210) {
  return stripHtml(html.slice(Math.max(0, marker - radius), Math.min(html.length, marker + radius)));
}

function inferMentorLevel(context: string): Person["mentorLevel"] {
  if (/博士(?:研究生)?导师/.test(context)) return "博士研究生导师";
  if (/硕士(?:研究生)?导师/.test(context)) return "硕士研究生导师";
  return "教师";
}

function inferTitle(context: string) {
  const value = context.match(/(?:教授|副教授|讲师|研究员|副研究员|实验师|高级工程师|助理研究员)/)?.[0] ?? "";
  return value;
}

function peopleFromPage(page: { url: string; html: string }, collegeId: string): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const link of anchors(page.html, page.url)) {
    const name = link.text.replace(/\s/g, "");
    if (!namePattern.test(name) || name.length > 3 || ignoredNames.has(name) || !isSameSite(link.url, page.url)) continue;
    if (name.charCodeAt(name.length - 1) === 0x7cfb) continue;
    if (!link.url.includes("/info/")) continue;
    const marker = page.html.indexOf(link.text);
    const context = marker >= 0 ? textNear(page.html, marker) : name;
    // 没有个人页特征时要求上下文至少含有“师/教/导/教授”，避免把导航项误当姓名。
    if (!/(师|教|导|教授|研究员|讲师)/.test(context) && !/(info|content|page|show|teacher|faculty)/i.test(link.url)) continue;
    const key = `${name}|${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = inferTitle(context);
    people.push({
      id: `${collegeId}:${people.length + 1}`,
      name,
      title,
      position: "",
      mentorLevel: inferMentorLevel(context),
      researchAreas: [],
      email: "",
      description: "学院官网公开师资目录信息；请以个人主页最新内容为准。",
      profileUrl: link.url,
      sourceUpdatedAt: updatedAt,
    });
  }
  return people.slice(0, 160);
}

async function snapshotCollege(college: typeof imnuColleges[number]): Promise<CollegeSnapshot> {
  if (!college.officialUrl) {
    return {
      id: college.id, name: college.name, officialUrl: "", facultySourceUrl: "", mentorSourceUrl: "",
      sourceStatus: "no_official_url", sourceNote: "学校组织机构页面未公开该学院官网链接，暂不收录个人师资信息。", faculty: [],
    };
  }
  const home = await readPage(college.officialUrl);
  if (!home) {
    return {
      id: college.id, name: college.name, officialUrl: college.officialUrl, facultySourceUrl: "", mentorSourceUrl: "",
      sourceStatus: "site_unavailable", sourceNote: "同步时学院官网暂时无法访问，未写入猜测性资料。", faculty: [],
    };
  }
  const links = facultyLinks(home, college.officialUrl);
  for (const hint of candidatePathHints) {
    const url = urlFor(hint, home.url);
    if (url && isSameSite(url, college.officialUrl) && !links.includes(url)) links.push(url);
  }

  let firstDirectoryUrl = "";
  const people: Person[] = [];
  const seen = new Set<string>();
  for (const url of links.slice(0, 7)) {
    const page = await readPage(url);
    if (!page) continue;
    const found = peopleFromPage(page, college.id);
    if (found.length && !firstDirectoryUrl) firstDirectoryUrl = page.url;
    for (const person of found) {
      if (seen.has(person.name)) continue;
      seen.add(person.name);
      people.push({ ...person, id: `${college.id}:${people.length + 1}` });
    }
    if (people.length >= 120) break;
  }
  if (!people.length) {
    return {
      id: college.id, name: college.name, officialUrl: college.officialUrl, facultySourceUrl: firstDirectoryUrl, mentorSourceUrl: "",
      sourceStatus: "no_public_directory", sourceNote: "已检查学院官网公开页面，未发现可稳定识别的师资/导师个人目录。", faculty: [],
    };
  }
  return {
    id: college.id,
    name: college.name,
    officialUrl: college.officialUrl,
    facultySourceUrl: firstDirectoryUrl,
    mentorSourceUrl: firstDirectoryUrl,
    sourceStatus: "synced",
    sourceNote: "仅收录学院官网公开可识别的师资条目；研究方向和联系方式以个人主页为准。",
    faculty: people,
  };
}

const colleges = await Promise.all(imnuColleges.map(async college => {
  console.log("同步 " + college.name);
  try { return await snapshotCollege(college); }
  catch {
    return { id: college.id, name: college.name, officialUrl: college.officialUrl, facultySourceUrl: "", mentorSourceUrl: "", sourceStatus: college.officialUrl ? "site_unavailable" : "no_official_url", sourceNote: "同步时学院官网暂时无法访问，未写入猜测性资料。", faculty: [] } satisfies CollegeSnapshot;
  }
}))

const snapshot = {
  school: "内蒙古师范大学",
  directorySourceUrl: "https://www.imnu.edu.cn/zzjg.htm#erjxy",
  updatedAt,
  colleges,
};
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`完成：${outputPath}，共 ${colleges.reduce((total, college) => total + college.faculty.length, 0)} 条公开师资记录。`);
