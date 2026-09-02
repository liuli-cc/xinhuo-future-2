"use strict";

const SECTION_DEFINITIONS = {
  basic: [
    "基本信息", "个人信息", "个人资料", "基本资料", "联系方式",
    "personal information", "profile",
  ],
  education: [
    "教育背景", "教育经历", "学习经历", "学历背景", "教育情况", "学习背景",
    "education background", "education",
  ],
  skills: [
    "专业技能", "掌握技能", "技术栈", "技能专长", "技能清单", "职业技能", "技能",
    "语言能力", "个人技能", "skills", "technical skills",
  ],
  projects: [
    "项目经历", "项目经验", "项目实践", "课程项目", "科研项目", "科研经历",
    "代表项目", "projects", "project experience",
  ],
  internships: [
    "实习经历", "实习经验", "工作经历", "工作经验", "社会实践", "校园实践",
    "在校经历", "校园经历", "学生工作", "职业经历",
    "professional experience", "work experience", "internship experience", "internships",
  ],
  competitions: [
    "竞赛与荣誉经历", "竞赛荣誉经历", "竞赛经历", "比赛经历", "获奖经历", "荣誉奖项", "奖项荣誉", "获奖情况",
    "奖励情况", "证书荣誉", "荣誉证书", "竞赛获奖", "荣誉", "证书",
    "荣誉&证书", "荣誉与证书",
    "awards and honors", "awards", "honors", "certificates",
  ],
  selfEval: [
    "自我评价", "个人评价", "自我介绍", "个人简介", "个人优势", "关于我",
    "个人总结", "自我总结", "self evaluation", "summary", "about me",
  ],
};

const ALL_SECTION_LABELS = Object.values(SECTION_DEFINITIONS).flat()
  .sort((left, right) => right.length - left.length);
const DEGREE_PATTERN = /博士研究生|博士|硕士研究生|硕士|本科|学士|大学专科|大专|专科|高职|中专|高中/g;
const DATE_RANGE_PATTERN = /(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?\s*(?:-|–|—|至|~|～)\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?|至今|现在)/i;
const ROLE_PATTERN = /(?:(?:前端|后端|全栈|软件|算法|测试|产品|运营|数据|网络|运维|行政|财务|人力资源|市场|销售|研究|科研|设计)(?:开发)?|开发)?(?:实习生|工程师|专员|助理|经理|主管|负责人|成员|组长|队长)/;
const ENTRY_PREFIX_RE = /^(?:项目名称|项目名|课题名称|公司名称|单位名称|竞赛名称|比赛名称|奖项名称)\s*[:：]\s*/;
const DESCRIPTION_PREFIX_RE = /^(?:项目描述|项目介绍|工作描述|工作内容|主要工作|主要职责|岗位职责|负责内容|个人职责|职责|技术栈|核心技术|项目成果|工作成果|成果|内容|描述|使用|通过|基于|参与|负责|完成|实现|协助)\s*[:：]?/;

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LABEL_PATTERN = ALL_SECTION_LABELS.map(escapeRegExp).join("|");

function normalizeResumeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\u00a0/g, " ")
    // OCR engines often insert a literal space between every Chinese glyph.
    // Collapse only Han-to-Han spacing so English words and numbers keep their
    // original boundaries.
    .replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(value) {
  return String(value || "")
    .replace(/^[\s•·●○►▪■◆◇★☆▶>@“”‘’"'-]+/, "")
    .replace(/^\d{1,2}[.、)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingKey(line) {
  const candidate = cleanLine(line)
    .replace(/^[一二三四五六七八九十]+[、.)]\s*/, "")
    .replace(/[：:|｜/·•\-—–]\s*$/, "")
    .trim();
  if (!candidate || candidate.length > 80) return "";
  for (const [key, labels] of Object.entries(SECTION_DEFINITIONS)) {
    for (const label of labels) {
      const escaped = escapeRegExp(label);
      const englishSuffix = "(?:\\s*[|｜/·•\\-—–]?\\s*[A-Za-z][A-Za-z &/_-]{0,45})?";
      if (new RegExp(`^${escaped}${englishSuffix}$`, "i").test(candidate)) return key;
      if (/^[a-z ]+$/i.test(label) && new RegExp(`^${escaped}$`, "i").test(candidate)) return key;
    }
  }
  return "";
}

function splitResumeSections(text) {
  const normalized = normalizeResumeText(text);
  const sections = {
    preamble: [],
    basic: [],
    education: [],
    skills: [],
    projects: [],
    internships: [],
    competitions: [],
    selfEval: [],
  };
  let current = "preamble";
  for (const rawLine of normalized.split("\n")) {
    const key = headingKey(rawLine);
    if (key) {
      current = key;
      continue;
    }
    sections[current].push(rawLine);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]),
  );
}

function findLabeledValue(text, labels, maxLength = 160) {
  const normalized = normalizeResumeText(text);
  for (const label of labels) {
    const match = new RegExp(
      `(?:^|[\\n|｜;；])\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^\\n|｜;；]{1,${maxLength}})`,
      "im",
    ).exec(normalized);
    if (match?.[1]) return cleanLine(match[1]).slice(0, maxLength);
  }
  return "";
}

function findSection(text, labels, maxLength = 3000) {
  const sections = splitResumeSections(text);
  for (const [key, knownLabels] of Object.entries(SECTION_DEFINITIONS)) {
    if (labels.some(label => knownLabels.includes(label)) && sections[key]) {
      return sections[key].slice(0, maxLength).trim();
    }
  }
  const normalized = normalizeResumeText(text);
  for (const label of labels) {
    const match = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:：]?\\s*`, "im").exec(normalized);
    if (!match) continue;
    const after = normalized.slice(match.index + match[0].length);
    const next = new RegExp(`(?:^|\\n)\\s*(?:${LABEL_PATTERN})\\s*[:：]?\\s*`, "im").exec(after);
    return (next ? after.slice(0, next.index) : after.slice(0, maxLength)).trim();
  }
  return "";
}

function extractResumeName(text) {
  const normalized = normalizeResumeText(text);
  const labeled = findLabeledValue(normalized, ["姓名", "名字", "name"], 30);
  if (labeled) return labeled.replace(/\s+/g, "").slice(0, 20);
  const lines = normalized.split("\n").map(cleanLine).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    const withoutTitle = line.replace(/^(?:个人)?简历|求职简历|resume/ig, "").trim();
    const match = /(?:^|\s)([\u4e00-\u9fff]{2,4})(?:\s|$)/.exec(withoutTitle);
    if (match?.[1] && !/个人简历|基本信息|求职意向/.test(match[1])) return match[1];
  }
  return "";
}

function canonicalDegree(value) {
  const matches = normalizeResumeText(value).match(DEGREE_PATTERN) || [];
  const ranking = ["博士研究生", "博士", "硕士研究生", "硕士", "本科", "学士", "大学专科", "大专", "专科", "高职", "中专", "高中"];
  return ranking.find(degree => matches.includes(degree)) || "";
}

function extractEducation(text, sections) {
  const labeled = findLabeledValue(text, ["最高学历", "学历层次", "学历", "学位"], 100);
  const fromLabeled = canonicalDegree(labeled);
  if (fromLabeled) return fromLabeled === "学士" ? "本科" : fromLabeled;
  const fromEducation = canonicalDegree(`${sections.education}\n${sections.preamble}\n${sections.basic}`);
  if (fromEducation) return fromEducation === "学士" ? "本科" : fromEducation;
  return "";
}

function plausibleMajor(value) {
  return cleanLine(value)
    .replace(/\s+(?:博士研究生|博士|硕士研究生|硕士|本科|学士|大专|专科|高职).*$/, "")
    .replace(/\s+(?:应届毕业生|应届生).*$/, "")
    .replace(/[|｜/·•\-—–]+\s*$/, "")
    .slice(0, 80)
    .trim();
}

function extractMajor(text, sections) {
  const labeled = findLabeledValue(text, ["所学专业", "主修专业", "本科专业", "研究生专业", "专业名称", "专业"], 100);
  if (labeled) return plausibleMajor(labeled);

  const educationLines = sections.education.split("\n").map(cleanLine).filter(Boolean);
  for (const line of educationLines) {
    const degree = canonicalDegree(line);
    if (degree) {
      const beforeDegree = line
        .replace(DATE_RANGE_PATTERN, " ")
        .split(degree)[0]
        .replace(/^.*?(?:大学|学院)\s*/, "")
        .trim();
      if (
        beforeDegree.length >= 2
        && beforeDegree.length <= 50
        && !/(?:大学|学院|博士|硕士|本科|学士|大专|专科|至今)/.test(beforeDegree)
      ) {
        return plausibleMajor(beforeDegree);
      }
    }
    if (!/(?:大学|学院)/.test(line) || !canonicalDegree(line)) continue;
    const withoutDates = line.replace(DATE_RANGE_PATTERN, " ");
    const parts = withoutDates.split(/\s{2,}|[|｜]/).map(cleanLine).filter(Boolean);
    const candidate = parts.find(part => (
      !/(?:大学|学院|博士|硕士|本科|学士|大专|专科|至今)/.test(part)
      && !/^(?:19|20)\d{2}/.test(part)
      && part.length >= 2
      && part.length <= 50
    ));
    if (candidate) return plausibleMajor(candidate);

    const afterSchool = withoutDates.replace(/^.*?(?:大学|学院)\s*/, "");
    const beforeDegree = afterSchool.split(/博士研究生|博士|硕士研究生|硕士|本科|学士|大专|专科/)[0];
    if (beforeDegree && beforeDegree.length <= 50) return plausibleMajor(beforeDegree);
  }
  return "";
}

function extractResumeField(text, labels) {
  const labeled = findLabeledValue(text, labels, 400);
  if (labeled) return labeled;
  return findSection(text, labels, 400).replace(/\s*\n\s*/g, " ").slice(0, 400);
}

function extractResumeList(text, labels) {
  const block = findSection(text, labels) || findLabeledValue(text, labels, 1200);
  if (!block) return [];
  const values = [];
  for (const rawLine of block.split("\n")) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const withoutCategory = line.replace(/^[\u4e00-\u9fffA-Za-z]{2,12}\s*[:：]\s*/, "");
    const parts = withoutCategory.split(/[、,，;；|]+/);
    for (const part of parts) {
      const value = cleanLine(part)
        .replace(/^(?:熟练掌握|熟悉|掌握|了解|精通|能够使用|会使用|具备)\s*/, "")
        .replace(/[。；].*$/, "")
        .trim();
      if (value.length > 1 && value.length < 80) values.push(value);
    }
  }
  return [...new Set(values)].slice(0, 24);
}

function isEntryTitle(line, kind, hasCurrent) {
  if (!line) return false;
  if (ENTRY_PREFIX_RE.test(line)) return true;
  if (DATE_RANGE_PATTERN.test(line)) return true;
  if (!hasCurrent) return true;
  if (DESCRIPTION_PREFIX_RE.test(line)) return false;
  if (kind === "competitions") {
    return /(?:竞赛|比赛|挑战赛|大赛|奖|荣誉|证书|优秀|先进|奖学金)/.test(line);
  }
  if (kind === "internships") {
    return line.length <= 90 && (
      /(?:公司|集团|科技|工作室|中心|银行|学校|医院|研究院|事务所|实验室)/.test(line)
      || ROLE_PATTERN.test(line)
    );
  }
  return line.length <= 90 && /(?:项目|系统|平台|网站|小程序|课题|研究|设计|开发|应用|实践|模型|算法)/.test(line);
}

function buildPair(title, description) {
  const cleanedTitle = cleanLine(title).replace(ENTRY_PREFIX_RE, "").trim();
  return {
    name: cleanedTitle.slice(0, 120),
    description: description.map(line => cleanLine(line).replace(DESCRIPTION_PREFIX_RE, "").trim())
      .filter(Boolean)
      .join("；")
      .slice(0, 1600),
  };
}

function extractEntriesFromBlock(block, kind) {
  if (!block) return [];
  const paragraphs = block.split(/\n\s*\n+/).map(value => value.trim()).filter(Boolean);
  const entries = [];

  if (paragraphs.length > 1) {
    for (const paragraph of paragraphs) {
      const lines = paragraph.split("\n").map(cleanLine).filter(Boolean);
      if (!lines.length) continue;
      if (kind === "competitions" && lines.length > 1 && lines.every(line => isEntryTitle(line, kind, true))) {
        entries.push(...lines.map(line => buildPair(line, [])));
      } else {
        entries.push(buildPair(lines[0], lines.slice(1)));
      }
    }
  } else {
    let title = "";
    let description = [];
    for (const rawLine of block.split("\n")) {
      const line = cleanLine(rawLine);
      if (!line) continue;
      if (isEntryTitle(line, kind, Boolean(title))) {
        if (title) entries.push(buildPair(title, description));
        title = line;
        description = [];
      } else if (title) {
        description.push(line);
      }
    }
    if (title) entries.push(buildPair(title, description));
  }

  return entries
    .filter(entry => entry.name && !headingKey(entry.name))
    .slice(0, 10);
}

function extractResumePairs(text, labels) {
  let kind = "projects";
  if (labels.some(label => SECTION_DEFINITIONS.internships.includes(label))) kind = "internships";
  if (labels.some(label => SECTION_DEFINITIONS.competitions.includes(label))) kind = "competitions";
  const block = findSection(text, labels) || findLabeledValue(text, labels, 2400);
  return extractEntriesFromBlock(block, kind);
}

function sectionOrLabeled(text, sections, key) {
  return sections[key] || findLabeledValue(text, SECTION_DEFINITIONS[key], 3000);
}

function splitCompetitionAward(value) {
  const normalized = cleanLine(value).replace(/[。；;]+$/, "");
  const match = /^(.*?)(?:\s+|[：:，,；;|-])?((?:国家级|省级|市级|校级|院级)?(?:特等奖|一等奖|二等奖|三等奖|金奖|银奖|铜奖|优秀奖|优胜奖|入围奖|奖学金|优秀学生|优秀干部|荣誉称号|证书).*)$/.exec(normalized);
  return match
    ? { name: match[1].trim() || normalized, award: match[2].trim() }
    : { name: normalized, award: "" };
}

function extractInlineCompetitionPairs(text) {
  const normalized = normalizeResumeText(text);
  const labels = ["所获奖项", "荣誉奖项", "获奖情况", "奖励情况"];
  const entries = [];
  const lines = normalized.split("\n");

  for (const label of labels) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*[:：]\\s*(.{2,800})$`, "i");
    for (let index = 0; index < lines.length; index += 1) {
      const match = pattern.exec(lines[index]);
      if (!match) continue;
      let awardBlock = match[1];
      for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
        const continuation = cleanLine(lines[index + offset]);
        if (
          !continuation
          || headingKey(continuation)
          || !/(?:竞赛|比赛|挑战赛|大赛|奖|荣誉|证书|优秀|先进)/.test(continuation)
        ) {
          break;
        }
        awardBlock += `、${continuation}`;
      }
      for (const value of awardBlock.split(/[、，,；;]+/)) {
        const entry = cleanLine(value).replace(/[。；;]+$/, "");
        if (
          entry.length >= 2
          && /(?:竞赛|比赛|挑战赛|大赛|奖|荣誉|证书|优秀|先进)/.test(entry)
        ) {
          entries.push({ name: entry, description: "" });
        }
      }
    }
  }

  return entries.slice(0, 10);
}

function extractInlineSkills(text) {
  const normalized = normalizeResumeText(text);
  const values = [];
  const pattern = /(?:熟练掌握|熟悉掌握|熟练使用|掌握|熟悉|会使用)\s*([^\n。；;]{2,240})/g;

  for (const match of normalized.matchAll(pattern)) {
    const candidates = match[1]
      .replace(/等(?:办公)?软件.*$/, "")
      .split(/[、，,|/]+/)
      .map(cleanLine)
      .filter(value => (
        value.length >= 2
        && value.length <= 40
        && (
          /[A-Za-z+#.]/.test(value)
          || /(?:数据库|数据分析|机器学习|深度学习|办公软件|编程|建模|绘图|设计)/.test(value)
        )
      ));
    values.push(...candidates);
  }

  return [...new Set(values)].slice(0, 24);
}

function parseInternshipPair(pair) {
  const title = pair.name
    .replace(DATE_RANGE_PATTERN, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const roleMatch = ROLE_PATTERN.exec(title);
  if (!roleMatch) return { company: title, role: "", description: pair.description };
  const before = title.slice(0, roleMatch.index).replace(/[|｜·•\-—–]+$/, "").trim();
  const after = title.slice(roleMatch.index + roleMatch[0].length).replace(/^[|｜·•\-—–]+/, "").trim();
  return {
    company: before || after || title,
    role: roleMatch[0],
    description: pair.description,
  };
}

function parseResumeStructure(text) {
  const normalized = normalizeResumeText(text);
  const sections = splitResumeSections(normalized);
  const projects = extractEntriesFromBlock(sectionOrLabeled(normalized, sections, "projects"), "projects");
  const internships = extractEntriesFromBlock(sectionOrLabeled(normalized, sections, "internships"), "internships").map(parseInternshipPair);
  const competitionPairs = [
    ...extractEntriesFromBlock(sectionOrLabeled(normalized, sections, "competitions"), "competitions"),
    ...extractInlineCompetitionPairs(normalized),
  ];
  const competitions = competitionPairs
    .map(pair => {
      const parsed = splitCompetitionAward(pair.name);
      return {
        name: parsed.name,
        award: pair.description || parsed.award,
      };
    })
    .filter((entry, index, entries) => (
      entries.findIndex(candidate => (
        candidate.name === entry.name && candidate.award === entry.award
      )) === index
    ))
    .slice(0, 10);
  const sectionSkills = extractResumeList(normalized, SECTION_DEFINITIONS.skills);

  return {
    name: extractResumeName(normalized),
    education: extractEducation(normalized, sections),
    major: extractMajor(normalized, sections),
    skills: sectionSkills.length ? sectionSkills : extractInlineSkills(normalized),
    projects,
    internships,
    competitions,
    selfEval: (
      findLabeledValue(normalized, SECTION_DEFINITIONS.selfEval, 600)
      || sections.selfEval.replace(/\s*\n\s*/g, " ").trim()
    ).slice(0, 600),
  };
}

module.exports = {
  canonicalDegree,
  extractResumeField,
  extractResumeList,
  extractResumeName,
  extractResumePairs,
  headingKey,
  normalizeResumeText,
  parseResumeStructure,
  splitResumeSections,
};
