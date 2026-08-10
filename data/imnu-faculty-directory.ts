import generatedSnapshot from "./imnu-faculty-snapshot.json";
import { imnuAiFacultySnapshot, type FacultySeed } from "./imnu-ai-faculty";
import { canonicalImnuCollege, imnuColleges } from "./imnu-colleges";

export type DirectoryStatus = "synced" | "no_public_directory" | "no_official_url" | "site_unavailable";

export type DirectoryFaculty = Omit<FacultySeed, "id"> & {
  id: string;
  sourceUpdatedAt: string;
};

export type CollegeFacultyDirectory = {
  id: string;
  school: string;
  college: string;
  officialUrl: string;
  sourceUrl: string;
  mentorSourceUrl: string;
  sourceStatus: DirectoryStatus;
  sourceNote: string;
  updatedAt: string;
  faculty: DirectoryFaculty[];
};

const aiDirectory: CollegeFacultyDirectory = {
  id: "artificial-intelligence",
  school: imnuAiFacultySnapshot.school,
  college: imnuAiFacultySnapshot.college,
  officialUrl: "https://sai.imnu.edu.cn",
  sourceUrl: imnuAiFacultySnapshot.sourceUrl,
  mentorSourceUrl: imnuAiFacultySnapshot.mentorSourceUrl,
  sourceStatus: "synced",
  sourceNote: "人工智能学院目录保留学院官网个人主页中的职称、导师层级和研究方向公开信息。",
  updatedAt: imnuAiFacultySnapshot.updatedAt,
  faculty: imnuAiFacultySnapshot.faculty.map(item => ({ ...item, id: `artificial-intelligence:${item.id}`, sourceUpdatedAt: imnuAiFacultySnapshot.updatedAt })),
};

const generatedDirectories = generatedSnapshot.colleges.map(item => ({
  id: item.id,
  school: generatedSnapshot.school,
  college: item.name,
  officialUrl: item.officialUrl,
  sourceUrl: item.facultySourceUrl || item.officialUrl,
  mentorSourceUrl: item.mentorSourceUrl || item.facultySourceUrl || item.officialUrl,
  sourceStatus: item.sourceStatus as DirectoryStatus,
  sourceNote: item.sourceNote,
  updatedAt: generatedSnapshot.updatedAt,
  faculty: item.faculty.map(person => ({ ...person, id: person.id, mentorLevel: person.mentorLevel as DirectoryFaculty["mentorLevel"], sourceUpdatedAt: person.sourceUpdatedAt })),
})) satisfies CollegeFacultyDirectory[];

/** 组织机构页的每一个学院都会有一个目录状态；人工智能学院使用更完整的结构化快照。 */
export const imnuFacultyDirectories = imnuColleges.map(college => {
  if (college.id === aiDirectory.id) return aiDirectory;
  return generatedDirectories.find(item => item.id === college.id) ?? {
    id: college.id,
    school: generatedSnapshot.school,
    college: college.name,
    officialUrl: college.officialUrl,
    sourceUrl: college.officialUrl,
    mentorSourceUrl: college.officialUrl,
    sourceStatus: college.officialUrl ? "no_public_directory" : "no_official_url",
    sourceNote: college.officialUrl ? "未发现可稳定识别的学院公开师资目录。" : "学校组织机构页面未公开该学院官网链接。",
    updatedAt: generatedSnapshot.updatedAt,
    faculty: [],
  } satisfies CollegeFacultyDirectory;
});

export function getImnuFacultyDirectory(college: string) {
  const canonical = canonicalImnuCollege(college);
  return imnuFacultyDirectories.find(item => item.college === canonical) ?? null;
}
