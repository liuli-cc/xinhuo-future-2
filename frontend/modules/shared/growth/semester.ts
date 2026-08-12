export function currentSemesterForGrade(grade: string, now = new Date()) {
  const entryYear = Number(grade.match(/\d{4}/)?.[0]);
  if (!entryYear) return 0;
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const term = now.getMonth() >= 8 ? 0 : 1;
  return Math.max(0, Math.min(7, (academicYear - entryYear) * 2 + term));
}

export function linkedGrowthTaskId(source: string, key: string, semesterIndex: number) {
  const sourceSlug = source.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "linked";
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `custom-${semesterIndex}-${sourceSlug}-${(hash >>> 0).toString(36)}`;
}
