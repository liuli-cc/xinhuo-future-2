import type { ResumeData } from "./resume-studio";

export async function buildResumeDocx(data: ResumeData, template = "blue") {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const color = template === "mint" ? "1E4D49" : template === "mono" ? "28343D" : "234F73";
  const text = (value: string) => value.split("\n").map(line => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 100 } }));
  const heading = (value: string) => new Paragraph({ text: value, heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 140 } });
  const doc = new Document({ styles: { default: { document: { run: { font: "Arial", color: "28343D", size: 22 } }, heading2: { run: { color, size: 26, bold: true } } } }, sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 900, right: 900 } } }, children: [
    new Paragraph({ children: [new TextRun({ text: data.name, bold: true, color, size: 44 })], spacing: { after: 140 } }),
    ...text(data.role), ...text([data.city, data.email, data.phone].filter(Boolean).join(" · ")),
    ...([data.school, data.major, data.grade].some(Boolean) ? [heading("教育背景"), ...text([data.school, data.major, data.grade].filter(Boolean).join(" · "))] : []),
    ...(data.summary ? [heading("个人简介"), ...text(data.summary)] : []),
    ...(data.skills ? [heading("核心技能"), ...text(data.skills)] : []),
    ...(data.experiences.length ? [heading("项目与实践经历"), ...data.experiences.flatMap(item => [new Paragraph({ children: [new TextRun({ text: item.title, bold: true })], keepNext: true, spacing: { before: 140 } }), ...text([item.org, item.period].filter(Boolean).join(" · ")), ...text(item.detail)])] : []),
  ] }] });
  return Packer.toBlob(doc);
}

export async function downloadResumeDocx(data: ResumeData, template = "blue") {
  const blob = await buildResumeDocx(data, template);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `${data.name || "个人"}-${data.role || "简历"}.docx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
