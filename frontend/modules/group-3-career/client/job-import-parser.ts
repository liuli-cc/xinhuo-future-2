export type ParsedJobDraft = {
  title: string;
  company: string;
  city: string;
  employmentType: "实习" | "校招" | "兼职" | "科研助理";
  salary: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
  confidence: number;
  missing: string[];
};

function clean(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\t　]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function lineCandidates(text: string) {
  return clean(text).split("\n").map(line => line.trim()).filter(Boolean).slice(0, 24);
}

function firstMatch(text: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = expression.exec(text);
    if (match?.[1]) return clean(match[1]).replace(/[，。；;|].*$/, "").trim();
  }
  return "";
}

function safeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function sourceNameFromUrl(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    if (hostname.endsWith("zhipin.com")) return "BOSS直聘（学生主动导入）";
    if (/\.edu\.cn$/.test(hostname) || hostname.includes("career")) return "学校就业信息（学生主动导入）";
    return "学生主动导入";
  } catch {
    return "学生主动导入";
  }
}

function inferEmploymentType(text: string): ParsedJobDraft["employmentType"] {
  if (/科研助理|科研岗位/.test(text)) return "科研助理";
  if (/兼职/.test(text)) return "兼职";
  if (/校招|应届生|毕业生招聘/.test(text)) return "校招";
  return "实习";
}

function inferTitle(lines: string[], text: string) {
  const preferred = lines.find(line => /(?:实习|实习生|校招|招聘|工程师|产品经理|设计师|助理|分析师|研究员)/.test(line)
    && line.length >= 2 && line.length <= 52 && !/^(岗位职责|任职要求|职位描述|公司介绍|工作地点|薪资待遇)/.test(line));
  if (preferred) return preferred.replace(/^(职位名称|岗位名称|职位)\s*[:：]\s*/, "").trim();
  return firstMatch(text, [/(?:职位名称|岗位名称|招聘职位|职位)\s*[:：]\s*([^\n]{2,60})/]);
}

function inferCompany(lines: string[], text: string) {
  const labelled = firstMatch(text, [/(?:公司名称|招聘企业|招聘单位|企业名称|公司)\s*[:：]\s*([^\n]{2,80})/]);
  if (labelled) return labelled;
  const candidate = lines.find(line => /(?:有限公司|公司|集团|研究院|事务所|工作室|中心)$/.test(line) && line.length <= 80);
  return candidate ?? "";
}

function inferCity(text: string) {
  const cities = ["呼和浩特", "北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "苏州", "天津", "重庆", "厦门", "青岛", "大连", "郑州", "长沙", "济南", "合肥", "无锡", "宁波"];
  return cities.find(city => text.includes(city)) ?? firstMatch(text, [/(?:工作地点|地点|城市)\s*[:：]\s*([^\n，。；;]{2,20})/]);
}

function inferSalary(text: string) {
  return firstMatch(text, [
    /(\d{1,3}\s*(?:[-~至]\s*\d{1,3})?\s*[kK](?:\s*[·x×]\s*\d{1,2}\s*薪)?)/,
    /(\d{2,4}\s*(?:[-~至]\s*\d{2,4})?\s*(?:元\s*\/\s*天|元\/天|元\/月))/,
  ]);
}

/**
 * 仅解析用户主动粘贴的岗位文字或链接，不会访问、抓取任何第三方招聘网站。
 */
export function parsePastedJob(input: { text: string; sourceUrl?: string }) : ParsedJobDraft {
  const description = clean(input.text).slice(0, 12_000);
  const sourceUrl = safeUrl(input.sourceUrl ?? "");
  const lines = lineCandidates(description);
  const title = inferTitle(lines, description);
  const company = inferCompany(lines, description);
  const city = inferCity(description);
  const salary = inferSalary(description);
  const employmentType = inferEmploymentType(description);
  const missing = [!title && "岗位名称", !company && "公司/单位", !city && "城市", !salary && "薪资"].filter(Boolean) as string[];
  const detected = 4 - missing.length;
  return {
    title,
    company,
    city,
    employmentType,
    salary,
    sourceUrl,
    sourceName: sourceNameFromUrl(sourceUrl),
    description,
    confidence: Math.min(100, Math.round((detected / 4 * 100 + (description.length >= 80 ? 10 : 0)) / 10) * 10),
    missing,
  };
}
