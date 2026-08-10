import { writeFile } from "node:fs/promises";

const output = process.argv[2] || "/tmp/xinhuo-large-resume.txt";
const targetBytes = Math.floor(2.8 * 1024 * 1024);
const heading = Buffer.from([
  "姓名：大文件测试同学",
  "学历：本科",
  "专业：计算机科学与技术",
  "技能：Python、TypeScript、数据分析",
  "项目经历：薪火未来平台，负责简历解析与模拟面试功能",
  "自我评价：学习能力强，重视团队协作和结果复盘",
  "",
].join("\n"));
const filler = Buffer.alloc(targetBytes - heading.length, 65);
await writeFile(output, Buffer.concat([heading, filler]));
console.log(`${output} ${targetBytes}`);
