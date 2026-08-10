const siteRoot = "https://sai.imnu.edu.cn";
const facultyListUrl = `${siteRoot}/faculty/jsml.htm`;
const mentorListUrls = [
  `${siteRoot}/faculty/dsml.htm`,
  `${siteRoot}/faculty/dsml/2.htm`,
  `${siteRoot}/faculty/dsml/1.htm`,
];

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value = "") {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html, name) {
  const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i");
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i");
  return decodeHtml(html.match(pattern)?.[1] || html.match(reverse)?.[1] || "").trim();
}

function field(html, id) {
  const pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
  return cleanText(html.match(pattern)?.[1] || "");
}

async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": "Xinhuo-Faculty-Directory/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

const facultyHtml = await get(facultyListUrl);
const facultyLinks = [];
const facultyPattern = /<a\s+href=["'](\.\.\/info\/1081\/\d+\.htm)["'][^>]*>([^<]+)<\/a>/gi;
for (const match of facultyHtml.matchAll(facultyPattern)) {
  const name = cleanText(match[2]);
  if (!name || name.includes("名录") || facultyLinks.some(item => item.name === name)) continue;
  facultyLinks.push({ name, url: new URL(match[1], facultyListUrl).href });
}

const mentorRoles = new Map();
for (const url of mentorListUrls) {
  const html = await get(url);
  const rolePattern = /【(博士|硕士)研究生导师】([^<]+)<\/h4>/g;
  for (const match of html.matchAll(rolePattern)) mentorRoles.set(cleanText(match[2]), `${match[1]}研究生导师`);
}

const faculty = [];
for (const item of facultyLinks) {
  const html = await get(item.url);
  const researchText = field(html, "research-tags") || meta(html, "keywords").replace(/^人工智能学院[,，]?/, "");
  const researchAreas = [...new Set(researchText.split(/[,，、;；]|\s{2,}/).map(cleanText).filter(Boolean))];
  const content = html.match(/id=["']vsb_content["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
  const description = cleanText(content) || meta(html, "description");
  const email = cleanText(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const photoPath = html.match(/id=["']teacher-photo["'][^>]+src=["']([^"']+)["']/i)?.[1] || "";
  faculty.push({
    id: Number(item.url.match(/\/(\d+)\.htm$/)?.[1]),
    name: field(html, "teacher-name") || item.name,
    title: field(html, "teacher-title"),
    position: field(html, "teacher-position"),
    mentorLevel: mentorRoles.get(item.name) || "教师",
    researchAreas,
    email,
    description: description.length > 260 ? `${description.slice(0, 260)}…` : description,
    profileUrl: item.url,
    photoUrl: photoPath ? new URL(photoPath, item.url).href : "",
  });
}

process.stdout.write(JSON.stringify({
  school: "内蒙古师范大学",
  college: "人工智能学院",
  sourceUrl: facultyListUrl,
  mentorSourceUrl: mentorListUrls[0],
  updatedAt: new Date().toISOString(),
  faculty,
}, null, 2));
