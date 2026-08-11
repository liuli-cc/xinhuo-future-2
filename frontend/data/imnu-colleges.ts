/**
 * 内蒙古师范大学二级学院官方目录。
 * 来源：https://www.imnu.edu.cn/zzjg.htm#erjxy
 * 本文件是注册、账号归档和导师目录共用的唯一院系名单。
 */
export type ImnuCollege = {
  id: string;
  name: string;
  officialUrl: string;
  /** 历史注册信息中可能出现的旧称；保存时会归一为 name。 */
  aliases?: string[];
};

export const imnuColleges: ImnuCollege[] = [
  { id: "education", name: "教育学院", officialUrl: "https://jyxy.imnu.edu.cn" },
  { id: "mongolian-studies", name: "蒙古学学院", officialUrl: "https://mxy.imnu.edu.cn" },
  { id: "ethnology", name: "民族学人类学学院", officialUrl: "https://mr.imnu.edu.cn" },
  { id: "chinese", name: "文学院", officialUrl: "https://wxy.imnu.edu.cn" },
  { id: "journalism", name: "新闻传播学院", officialUrl: "https://xwcb.imnu.edu.cn" },
  { id: "marxism", name: "马克思主义学院", officialUrl: "https://max.imnu.edu.cn" },
  { id: "history", name: "历史文化学院", officialUrl: "https://his.imnu.edu.cn" },
  { id: "economics", name: "经济管理学院", officialUrl: "https://ems.imnu.edu.cn" },
  { id: "governance", name: "国家治理学院", officialUrl: "https://gggl.imnu.edu.cn" },
  { id: "tourism", name: "旅游学院", officialUrl: "https://tour.imnu.edu.cn" },
  { id: "foreign-languages", name: "外国语学院", officialUrl: "https://fls.imnu.edu.cn" },
  { id: "math", name: "数学科学学院", officialUrl: "https://math.imnu.edu.cn" },
  { id: "physics", name: "物理与电子信息学院", officialUrl: "https://wdy.imnu.edu.cn" },
  { id: "chemistry", name: "化学与环境科学学院", officialUrl: "https://hxxy.imnu.edu.cn" },
  { id: "life-science", name: "生命科学与技术学院", officialUrl: "https://bio.imnu.edu.cn" },
  { id: "geography", name: "地理科学学院", officialUrl: "https://geo.imnu.edu.cn" },
  { id: "computer-science", name: "计算机科学技术学院", officialUrl: "https://cs.imnu.edu.cn", aliases: ["计算机科学与技术学院"] },
  { id: "psychology", name: "心理学院", officialUrl: "https://xl.imnu.edu.cn" },
  { id: "music", name: "音乐学院", officialUrl: "https://music.imnu.edu.cn" },
  { id: "sports", name: "体育学院", officialUrl: "https://ty.imnu.edu.cn" },
  { id: "fine-arts", name: "美术学院", officialUrl: "https://ms.imnu.edu.cn" },
  { id: "design", name: "设计学院", officialUrl: "https://art.imnu.edu.cn" },
  { id: "international-exchange", name: "国际交流学院", officialUrl: "https://gjjl.imnu.edu.cn" },
  { id: "continuing-education", name: "继续教育学院", officialUrl: "https://jxjy.imnu.edu.cn" },
  { id: "history-of-science", name: "科学技术史研究院", officialUrl: "https://ihst.imnu.edu.cn" },
  { id: "party-history", name: "中共党史党建学院", officialUrl: "https://dsdj.imnu.edu.cn" },
  { id: "future-science", name: "未来科学与技术学院", officialUrl: "" },
  { id: "chinese-national-community", name: "中华民族共同体学院", officialUrl: "https://zhmzgtt.imnu.edu.cn" },
  { id: "artificial-intelligence", name: "人工智能学院", officialUrl: "https://sai.imnu.edu.cn" },
];

export const imnuCollegeNames = imnuColleges.map(item => item.name);

function normalize(value: string) {
  return value.trim().replace(/[\s　]/g, "");
}

export function canonicalImnuCollege(value: string) {
  const normalized = normalize(value);
  return imnuColleges.find(item => [item.name, ...(item.aliases ?? [])].some(name => normalize(name) === normalized))?.name ?? null;
}

export function isOfficialImnuCollege(value: string) {
  return Boolean(canonicalImnuCollege(value));
}

export function getImnuCollege(value: string) {
  const canonical = canonicalImnuCollege(value);
  return canonical ? imnuColleges.find(item => item.name === canonical) ?? null : null;
}
