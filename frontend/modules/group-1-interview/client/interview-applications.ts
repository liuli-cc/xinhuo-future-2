export type InterviewApplication = { id: string; source: "career" | "recruitment"; sourceId: string; title: string; company: string; status: string; description?: string };
type RecruitmentJob = { id?: string; title?: string; description?: string; requirements?: string; location?: string };
export function mergeInterviewApplications(
  career: Array<{ id: string; title: string; company: string; status: string }>,
  recruitment: Array<{ id: string; enterpriseName?: string; status: string; job?: RecruitmentJob | null }>,
  jobs: RecruitmentJob[] = [],
): InterviewApplication[] {
  return [
    ...recruitment.filter(row => row.job?.title).map(row => {
      const latest = jobs.find(job => job.id === row.job?.id);
      const job = row.job!;
      return { id: `recruitment:${row.id}`, source: "recruitment" as const, sourceId: row.id, title: job.title!,
        company: row.enterpriseName || "企业", status: row.status,
        description: [job.description || latest?.description, job.requirements || latest?.requirements].filter(Boolean).join("\n") };
    }),
    ...career.map(row => ({ ...row, id: `career:${row.id}`, sourceId: row.id, source: "career" as const })),
  ];
}
