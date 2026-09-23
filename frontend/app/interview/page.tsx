"use client";

import { apiFetch } from "@/modules/shared/api/bmob-api";
import PortalFrame from "@/modules/shared/components/PortalFrame";
import { AnimatedBarChart, AnimatedLineChart } from "@/modules/shared/components/DataViz";
import type { InterviewerState } from "@/modules/group-1-interview/components/VirtualInterviewer";
import dynamic from "next/dynamic";
import ContinuousSpeechRecognition, {
  supportsBrowserSpeechRecognition,
  type LiveSpeechStatus,
} from "@/modules/group-1-interview/components/ContinuousSpeechRecognition";
import NativeRealtimeConversation, { type NativeRealtimeHandle, type NativeRealtimeContext } from "@/modules/group-1-interview/components/NativeRealtimeConversation";
import ResumeUploader from "@/modules/group-1-interview/components/ResumeUploader";
import {
  INTERVIEW_MODEL_PROVIDERS,
  type InterviewModelProvider,
  type InterviewModelAnalysis,
} from "@/modules/group-1-interview/client/interview-model";
import type { ResumeStructured } from "@/modules/group-1-interview/client/resume-parser";
import type { JobStructured } from "@/modules/group-3-career/client/job-parser";
import { defaultInterviewPlan, type InterviewPlan } from "@/modules/group-1-interview/client/interview-plan";
import { analyzeSpeechMetrics, type SpeechMetrics } from "@/modules/group-1-interview/client/speech-analysis";
import { mergeInterviewApplications, type InterviewApplication } from "@/modules/group-1-interview/client/interview-applications";
import { combineTurnText, ResponseGate } from "@/modules/group-1-interview/client/conversation-turn";
import { importResumeFile } from "@/modules/group-1-interview/client/resume-import";
import { generateReportV2, scoreAnswerV2, applyModelEvaluation, reviewAnswerWithEvidence, type ScoredAnswer, type InterviewReportV2 } from "@/modules/group-1-interview/client/scoring-v2";
import { buildInterviewReportMarkdown, interviewReportFileName } from "@/modules/group-1-interview/client/interview-report-export";
import {
  downloadInterviewReportPdf,
  downloadInterviewReportWord,
} from "@/modules/group-1-interview/client/interview-report-download";
import type { VoiceCaptureStats } from "@/modules/group-1-interview/client/wav-audio";
import { useMotionPreference } from "@/modules/shared/motion/motion-preference";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

gsap.registerPlugin(useGSAP);

function MentorPlaceholder() {
  return <div className="virtual-interviewer" style={{ minHeight: 420, display: "grid", placeContent: "center" }}>
    <div className="mentor-identity"><strong>liuli 老师</strong><span>你的面试搭档</span></div>
  </div>;
}
const VirtualInterviewer = dynamic(() => import("@/modules/group-1-interview/components/VirtualInterviewer"), {
  ssr: false, loading: MentorPlaceholder,
});

/* ── 类型 ── */
type SetupStep = "resume" | "job" | "plan" | "ready";
type PageMode = "setup" | "active" | "report";
type PlanMode = "local" | "ai";
type Connection = { status: "idle" | "testing" | "connected" | "error"; message: string; latencyMs?: number };
type CareerApplication = InterviewApplication;
type History = { id: string; targetRole: string; overallScore: number; createdAt: number };

const INTERVIEW_DURATION_SECONDS = 15 * 60;
const MAX_CONVERSATION_TURNS = 12;
const providerConsoles: Record<InterviewModelProvider, string> = {
  deepseek: "https://platform.deepseek.com/",
  kimi: "https://platform.kimi.com/",
  glm: "https://bigmodel.cn/",
  qwen: "https://bailian.console.aliyun.com/",
  mimo: "https://mimo.mi.com/",
  doubao: "https://console.volcengine.com/ark/",
};

export default function InterviewPage() {
  const studioRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotionPreference();

  /* ── 页面状态 ── */
  const [pageMode, setPageMode] = useState<PageMode>("setup");
  const [setupStep, setSetupStep] = useState<SetupStep>("resume");

  /* ── 简历 ── */
  const [, setResumeFile] = useState<File | null>(null);
  const [resumeParsed, setResumeParsed] = useState<ResumeStructured | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadProgress, setResumeUploadProgress] = useState(0);
  const [resumeError, setResumeError] = useState("");

  /* ── 岗位 ── */
  const [jobSource, setJobSource] = useState<"saved" | "manual" | "none">("none");
  const [careerApplications, setCareerApplications] = useState<CareerApplication[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [manualJobTitle, setManualJobTitle] = useState("");
  const [manualJobDesc, setManualJobDesc] = useState("");
  const [manualJobCompany, setManualJobCompany] = useState("");
  const [jobParsed, setJobParsed] = useState<JobStructured | null>(null);
  const [jobError, setJobError] = useState("");

  /* ── 模型 ── */
  const [provider, setProvider] = useState<InterviewModelProvider>("deepseek");
  const [planMode, setPlanMode] = useState<PlanMode>("local");
  const [modelName, setModelName] = useState<string>(INTERVIEW_MODEL_PROVIDERS.deepseek.defaultModel);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [capabilities, setCapabilities] = useState({ modelConfigured: false, allowClientKeys: false, nativeRealtimeConfigured: false, realtimeModel: "" });
  const [voiceMode, setVoiceMode] = useState<"browser" | "realtime">("browser");
  const [realtimeConsent, setRealtimeConsent] = useState(false);
  const [realtimeContext, setRealtimeContext] = useState<NativeRealtimeContext | null>(null);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const nativeRealtimeRef = useRef<NativeRealtimeHandle>(null);
  const nativeAnswersRef = useRef<ScoredAnswer[]>([]);
  const reportCompletingRef = useRef(false);
  const nativeTurnIdsRef = useRef(new Set<string>());
  const nativeReviewSessionRef = useRef(0);
  const nativeReviewControllersRef = useRef(new Set<AbortController>());
  const nativeReviewTasksRef = useRef(new Set<Promise<void>>());
  const nativeScoresRef = useRef(new Map<string, { order: number; answer: ScoredAnswer }>());
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [connection, setConnection] = useState<Connection>({ status: "idle", message: "尚未测试连接" });

  /* ── 面试计划 ── */
  const [interviewPlan, setInterviewPlan] = useState<InterviewPlan | null>(null);
  const [planGenerating, setPlanGenerating] = useState(false);

  /* ── 活跃面试 ── */
  const [index, setIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [answers, setAnswers] = useState<ScoredAnswer[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [interviewerState, setInterviewerState] = useState<InterviewerState>("idle");
  const [ttsSource, setTtsSource] = useState<"tencent" | "browser" | "none">("none");
  const [audioLevel, setAudioLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [pendingReport, setPendingReport] = useState<ScoredAnswer[] | null>(null);
  const [liveListening, setLiveListening] = useState(false);
  const [liveTurnKey, setLiveTurnKey] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveSpeechStatus, setLiveSpeechStatus] = useState<LiveSpeechStatus>("idle");
  const [callPaused, setCallPaused] = useState(false);
  const [browserSpeechReady, setBrowserSpeechReady] = useState<boolean | null>(null);
  const [conversationLog, setConversationLog] = useState<Array<{ speaker: "interviewer" | "candidate"; text: string }>>([]);
  const callPausedRef = useRef(false);
  const responseGateRef = useRef(new ResponseGate());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechEpochRef = useRef(0);
  const liveListeningRef = useRef(false);
  const pendingAnswerRef = useRef<{ text: string; durationMs: number; stats?: VoiceCaptureStats } | null>(null);
  const callActiveRef = useRef(false);

  /* ── 实时语音识别 ── */
  const [transcribedText, setTranscribedText] = useState("");
  const [asrError, setAsrError] = useState("");
  const [useTextFallback, setUseTextFallback] = useState(false);

  /* ── 报告 ── */
  const [report, setReport] = useState<InterviewReportV2 | null>(null);
  const [reportExporting, setReportExporting] = useState<"pdf" | "word" | null>(null);
  const [history, setHistory] = useState<History[]>([]);

  /* ── Toast ── */
  const [toast, setToast] = useState("");
  const showToast = (msg: string, dur = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  };

  useGSAP(() => {
    const root = studioRef.current;
    if (!root || reducedMotion) return;

    if (pageMode === "setup") {
      const panel = root.querySelector<HTMLElement>("[data-studio-panel]");
      if (panel) {
        gsap.fromTo(panel, { autoAlpha: 0, x: 18 }, {
          autoAlpha: 1,
          x: 0,
          duration: 0.26,
          ease: "power3.out",
        });
      }
      const activeStep = root.querySelector<HTMLElement>(".step-item.active");
      if (activeStep) {
        gsap.fromTo(activeStep, { x: -5 }, { x: 0, duration: 0.22, ease: "power3.out" });
      }
      const planQuestions = root.querySelectorAll<HTMLElement>("[data-plan-question]");
      if (planQuestions.length) {
        gsap.fromTo(planQuestions, { autoAlpha: 0, y: 8 }, {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          stagger: 0.045,
          ease: "power3.out",
        });
      }
    }

    if (pageMode === "active") {
      const entries = Array.from(root.querySelectorAll<HTMLElement>("[data-live-entry]"));
      const latestEntry = entries.at(-1);
      if (latestEntry) {
        gsap.fromTo(latestEntry, { autoAlpha: 0, y: 10 }, {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          ease: "power3.out",
        });
      }
      const console = root.querySelector<HTMLElement>("[data-live-console]");
      if (console) {
        gsap.fromTo(console, { autoAlpha: 0, y: 8 }, {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          ease: "power3.out",
        });
      }
    }

    if (pageMode === "report" && report) {
      const scoreRing = root.querySelector<HTMLElement>(".report-score-ring");
      if (scoreRing) {
        gsap.set(scoreRing, { "--ring-progress": 0 });
        gsap.to(scoreRing, {
          "--ring-progress": report.overallScore,
          duration: 0.72,
          ease: "power3.out",
        });
      }
      const dimensionFills = root.querySelectorAll<HTMLElement>(".report-dimension-fill");
      if (dimensionFills.length) {
        gsap.fromTo(dimensionFills, { scaleX: 0 }, {
          scaleX: 1,
          duration: 0.52,
          stagger: 0.07,
          ease: "power3.out",
        });
      }
    }
  }, {
    scope: studioRef,
    dependencies: [pageMode, setupStep, conversationLog.length, index, report?.calculatedAt, reducedMotion],
    revertOnUpdate: true,
  });

  /* ── 计时器 ── */
  useEffect(() => {
    if (pageMode !== "active" || callPaused) return;
    const t = setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [pageMode, index, callPaused]);

  useEffect(() => {
    if (pageMode !== "active" || callPaused) return;
    const timer = setInterval(() => setCallSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [callPaused, pageMode]);

  useEffect(() => {
    if (pageMode !== "active") return;
    const preventAccidentalLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventAccidentalLeave);
    return () => window.removeEventListener("beforeunload", preventAccidentalLeave);
  }, [pageMode]);

  useEffect(() => {
    callPausedRef.current = callPaused;
  }, [callPaused]);

  useEffect(() => {
    setBrowserSpeechReady(supportsBrowserSpeechRecognition());
    const responseGate = responseGateRef.current;
    const reviewControllers = nativeReviewControllersRef.current;
    const reviewSession = nativeReviewSessionRef;
    return () => {
      reviewSession.current += 1;
      reviewControllers.forEach(controller => controller.abort());
      responseGate.cancel();
      callActiveRef.current = false;
      speechEpochRef.current += 1;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  /* ── 加载历史 & 投递记录 ── */
  useEffect(() => {
    apiFetch("/api/interview/capabilities").then(response => response.ok ? response.json() : null).then(data => {
      if (!data) return;
      setCapabilities(data);
      if (data.modelConfigured && data.provider in INTERVIEW_MODEL_PROVIDERS) {
        setProvider(data.provider);
        setModelName(data.model);
        setUseCustomModel(true);
        setPlanMode("ai");
      }
    }).catch(() => {});
    apiFetch("/api/interview").then(r => r.json()).then(b => setHistory(b.sessions ?? [])).catch(() => {});
    const read = async <T,>(path: string): Promise<T | null> => {
      try { const response = await apiFetch(path); return response.ok ? await response.json() as T : null; }
      catch { return null; }
    };
    void Promise.all([
      read<{ applications: Parameters<typeof mergeInterviewApplications>[0] }>("/api/career/applications"),
      read<{ applications: Parameters<typeof mergeInterviewApplications>[1] }>("/api/recruitment/applications"),
      read<{ jobs: Parameters<typeof mergeInterviewApplications>[2] }>("/api/recruitment/jobs"),
    ]).then(([career, recruitment, jobs]) => setCareerApplications(mergeInterviewApplications(career?.applications ?? [], recruitment?.applications ?? [], jobs?.jobs ?? [])));
  }, []);

  const format = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  const providerInfo = INTERVIEW_MODEL_PROVIDERS[provider];
  const selectedApplication = careerApplications.find(item => item.id === applicationId);
  const legacyApplicationId = jobSource === "saved" && selectedApplication?.source === "career" ? selectedApplication.sourceId : undefined;

  /* ── 模型连接测试 ── */
  const testConnection = async () => {
    if (!capabilities.modelConfigured && !apiKey.trim()) return showToast("请先在服务端配置模型");
    if (!modelName.trim()) return showToast("请填写模型名称");
    if (!privacyAccepted) return showToast("请先确认外部模型数据传输说明");
    setConnection({ status: "testing", message: "正在连接..." });
    try {
      const r = await apiFetch("/api/interview/model", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", provider, model: modelName, apiKey, role: "通用能力", difficulty: "标准", history: [] }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "连接失败");
      setConnection({ status: "connected", message: `${b.providerLabel ?? providerInfo.label} ${b.model ?? modelName} 已连接`, latencyMs: b.latencyMs });
    } catch (e) { setConnection({ status: "error", message: e instanceof Error ? e.message : "连接失败" }); }
  };

  /* ── 简历上传 ── */
  const handleResumeFile = async (file: File) => {
    setResumeFile(file);
    setResumeUploading(true);
    setResumeUploadProgress(0);
    setResumeError("");
    setInterviewerState("thinking");
    try {
      const result = await importResumeFile(file, ({ progress }) => setResumeUploadProgress(progress));
      setResumeParsed(result.resume);
      showToast("简历识别完成，请确认字段");
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : "简历识别失败");
    } finally {
      setResumeUploading(false);
      setInterviewerState("idle");
    }
  };

  /* ── 岗位解析 ── */
  const parseJob = async () => {
    setJobError("");
    setInterviewerState("thinking");
    try {
      if (selectedApplication?.source === "recruitment" && jobSource === "saved" && manualJobDesc.trim().length < 10) {
        // An old submission may only retain a title. Do not invent missing requirements.
        setJobParsed({ title: selectedApplication.title, company: selectedApplication.company, skills: [], responsibilities: [],
          experienceReq: "未明确", coreCompetencies: [], possibleQuestions: [], difficulty: "standard", missingFields: ["岗位描述"] });
        setSetupStep("plan");
        return;
      }
      const r = await apiFetch("/api/interview/job/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: manualJobTitle, description: manualJobDesc, company: manualJobCompany, applicationId: legacyApplicationId }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "岗位解析失败");
      setJobParsed(b.job);
      setSetupStep("plan");
    } catch (e) {
      setJobError(e instanceof Error ? e.message : "岗位解析失败");
    } finally {
      setInterviewerState("idle");
    }
  };

  /* ── 生成面试计划 ── */
  const generatePlan = async () => {
    if (connection.status !== "connected") return showToast("请先完成模型连接测试");
    setPlanGenerating(true);
    setInterviewerState("thinking");
    try {
      const r = await apiFetch("/api/interview/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model: modelName, apiKey, resume: resumeParsed, job: jobParsed, applicationId: legacyApplicationId }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "计划生成失败");
      setInterviewPlan(b.plan);
      setModelAvailable(true);
      setSetupStep("ready");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "计划生成失败，将使用默认面试流程");
      // 使用默认计划
      setInterviewPlan(defaultInterviewPlan(resumeParsed, jobParsed));
      setModelAvailable(false);
      setSetupStep("ready");
    } finally {
      setPlanGenerating(false);
      setInterviewerState("idle");
    }
  };

  const generateLocalPlan = () => {
    setInterviewPlan(defaultInterviewPlan(resumeParsed, jobParsed));
    setModelAvailable(false);
    setSetupStep("ready");
    showToast("已生成免费本地面试计划");
  };

  /* ── 开始面试 ── */
  const startInterview = () => {
    if (voiceMode === "realtime" && (!capabilities.nativeRealtimeConfigured || !realtimeConsent)) {
      showToast("请先确认实时语音数据传输");
      return;
    }
    nativeReviewSessionRef.current += 1;
    nativeReviewControllersRef.current.forEach(controller => controller.abort());
    nativeReviewControllersRef.current.clear();
    nativeReviewTasksRef.current.clear();
    nativeAnswersRef.current = [];
    reportCompletingRef.current = false;
    nativeTurnIdsRef.current.clear();
    nativeScoresRef.current.clear();
    callActiveRef.current = true;
    callPausedRef.current = false;
    responseGateRef.current.cancel();
    pendingAnswerRef.current = null;
    const questions = interviewPlan?.questions ?? [];
    const openingQuestion = questions[0]?.label ?? "你好，我是今天的面试官liuli老师。先不用紧张，请你结合正在申请的方向，做一个两分钟左右的自我介绍。";
    if (questions.length === 0) {
      const plan = defaultInterviewPlan(resumeParsed, jobParsed);
      setInterviewPlan(plan);
      setCurrentQuestion(plan.questions[0]?.label ?? openingQuestion);
    } else {
      setCurrentQuestion(openingQuestion);
    }
    setIndex(0);
    setAnswers([]);
    setTextAnswer("");
    setSeconds(0);
    setCallSeconds(0);
    setCallPaused(false);
    setLiveListening(false);
    setLiveTranscript("");
    setAsrError("");
    setUseTextFallback(false);
    setConversationLog([]);
    setPageMode("active");
    setInterviewerState("speaking");
    if (voiceMode === "realtime") {
      setInterviewerState("thinking");
      setRealtimeContext({ role: jobParsed?.title ?? "通用能力", job: jobParsed,
        resume: resumeParsed ? { education: resumeParsed.education, major: resumeParsed.major, skills: resumeParsed.skills,
          projects: resumeParsed.projects, internships: resumeParsed.internships } : null,
        opening: openingQuestion, consent: realtimeConsent });
    } else speakQuestion(openingQuestion);
  };

  const beginListeningTurn = () => {
    if (callPausedRef.current || !callActiveRef.current) return;
    if (!supportsBrowserSpeechRecognition()) {
      setBrowserSpeechReady(false);
      setLiveListening(false);
      setUseTextFallback(true);
      setAsrError("当前浏览器不支持语音识别，请使用桌面版 Chrome，或改用文字回答。");
      setInterviewerState("idle");
      return;
    }
    setBrowserSpeechReady(true);
    setLiveTranscript("");
    setTranscribedText("");
    setTextAnswer("");
    setAsrError("");
    setSeconds(0);
    setLiveTurnKey(value => value + 1);
    liveListeningRef.current = true;
    setLiveListening(true);
    setInterviewerState("listening");
  };

  const stopPlayback = () => {
    speechEpochRef.current += 1;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const interruptResponse = () => {
    if (voiceMode === "realtime" && realtimeContext) { nativeRealtimeRef.current?.interrupt(); return; }
    responseGateRef.current.cancel();
    stopPlayback();
    setSaving(false);
    setInterviewerState("listening");
    if (!liveListeningRef.current && !useTextFallback) beginListeningTurn();
  };

  const speakQuestion = (text: string, addToLog = true) => {
    if (!text || callPausedRef.current || !callActiveRef.current) return;
    if (!useTextFallback && !liveListeningRef.current) beginListeningTurn();
    stopPlayback();
    setInterviewerState("speaking");
    if (addToLog) setConversationLog(log => [...log, { speaker: "interviewer", text }]);
    fallbackTTS(text, () => {
      if (callActiveRef.current && !callPausedRef.current) setInterviewerState("listening");
    });
  };

  const fallbackTTS = (text: string, onDone?: () => void) => {
    if (!("speechSynthesis" in window)) { setTtsSource("none"); onDone?.(); return; }
    const epoch = speechEpochRef.current;
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    setTtsSource("browser");
    utterance.lang = "zh-CN";
    utterance.rate = 1.02;
    utterance.pitch = 1.04;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(voice => /^zh(-|_)/i.test(voice.lang) && /Ting|Mei|Xiaoxiao|female|女/i.test(voice.name))
      ?? voices.find(voice => /^zh(-|_)/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;
    const done = () => {
      if (epoch !== speechEpochRef.current) return;
      utteranceRef.current = null;
      onDone?.();
    };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  };

  const completeInterview = async (finalAnswers: ScoredAnswer[], announce = true) => {
    if (reportCompletingRef.current) return;
    if (finalAnswers.length === 0) {
      showToast("至少完成一轮回答后才能生成面试报告");
      return;
    }

    reportCompletingRef.current = true;
    responseGateRef.current.cancel();
    callActiveRef.current = false;
    liveListeningRef.current = false;
    stopPlayback();
    setLiveListening(false);
    setCallPaused(true);
    callPausedRef.current = true;
    setSaving(true);
    setInterviewerState("scoring");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (announce && voiceMode !== "realtime") {
      fallbackTTS("好的，谢谢你的回答。今天的交流就到这里，我正在为你整理一份具体的面试反馈。");
    }

    if (nativeReviewTasksRef.current.size) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled([...nativeReviewTasksRef.current]),
        new Promise(resolve => { timeout = setTimeout(resolve, 8000); }),
      ]);
      if (timeout) clearTimeout(timeout);
    }
    // Lock the report snapshot before cancelling slow reviews: late results stay out.
    nativeReviewSessionRef.current += 1;
    nativeReviewControllersRef.current.forEach(controller => controller.abort());
    finalAnswers = finalAnswers.map(answer => {
      const reviewed = answer.realtimeTurnId ? nativeScoresRef.current.get(answer.realtimeTurnId)?.answer ?? answer : answer;
      return reviewed.evaluationNote === "AI 反馈生成中" ? { ...reviewed, evaluationNote: "AI 反馈暂不可用，采用提纲评分" } : reviewed;
    });
    const rpt = generateReportV2(finalAnswers);
    setReport(rpt);
    setPendingReport(null);
    setPageMode("report");
    setApiKey("");
    setConnection({ status: "idle", message: "本次面试已结束" });

    try {
      const saveR = await apiFetch("/api/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: jobParsed?.title ?? "通用能力",
          difficulty: jobParsed?.difficulty === "advanced" ? "进阶" : jobParsed?.difficulty === "entry" ? "入门" : "标准",
          answers: finalAnswers.map(answer => ({
            question: answer.question,
            answer: answer.answer,
            seconds: answer.seconds,
            speechMetrics: answer.speechMetrics,
          })),
          modelProvider: provider,
          modelName,
          applicationId: legacyApplicationId,
          reportV2: rpt,
        }),
      });
      const saveB = await saveR.json().catch(() => ({}));
      if (!saveR.ok) throw new Error(saveB.error || "云端保存失败");
      setReport(saveB.report ?? rpt);
      setHistory(previous => [{
        id: saveB.id ?? crypto.randomUUID(),
        targetRole: jobParsed?.title ?? "通用能力",
        overallScore: rpt.overallScore,
        createdAt: Date.now(),
      }, ...previous].slice(0, 12));
      showToast("面试报告已生成并保存");
    } catch (error) {
      setPendingReport(finalAnswers);
      showToast(`报告已在本机生成；${error instanceof Error ? error.message : "云端保存失败"}，可稍后重试`, 6000);
    } finally {
      setSaving(false);
    }
  };

  const finishCurrentInterview = async () => {
    if (saving) return;
    let completedAnswers = answers;
    if (voiceMode === "realtime" && realtimeContext) {
      setSaving(true);
      const fullyTranscribed = await nativeRealtimeRef.current?.finish();
      completedAnswers = nativeAnswersRef.current;
      if (fullyTranscribed === false) showToast("最后一段转写未完成，将保留已完成的回答", 5000);
      setSaving(false);
    }
    if (completedAnswers.length === 0) {
      showToast("至少完成一轮回答后才能生成报告");
      if (voiceMode === "realtime") { setRealtimeContext(null); setVoiceMode("browser"); setUseTextFallback(true); }
      return;
    }
    await completeInterview(completedAnswers);
  };

  const downloadInterviewReport = () => {
    if (!report) return;
    const targetRole = jobParsed?.title ?? "通用能力";
    const markdown = buildInterviewReportMarkdown(report, {
      targetRole,
      durationSeconds: callSeconds,
    });
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = interviewReportFileName(targetRole, report.calculatedAt);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("面试报告已下载");
  };

  const reportExportContext = () => ({
    targetRole: jobParsed?.title ?? "通用能力",
    durationSeconds: callSeconds,
  });

  const exportReportWord = async () => {
    if (!report || reportExporting) return;
    setReportExporting("word");
    try {
      await downloadInterviewReportWord(report, reportExportContext());
      showToast("Word 报告已生成");
    } catch (error) {
      showToast(error instanceof Error ? `Word 导出失败：${error.message}` : "Word 导出失败");
    } finally {
      setReportExporting(null);
    }
  };

  const exportReportPdf = async () => {
    if (!report || reportExporting) return;
    setReportExporting("pdf");
    try {
      await downloadInterviewReportPdf(report, reportExportContext());
      showToast("PDF 报告已生成");
    } catch (error) {
      showToast(error instanceof Error ? `PDF 导出失败：${error.message}` : "PDF 导出失败");
    } finally {
      setReportExporting(null);
    }
  };

  /* ── 每次响应都有独立取消令牌，补充回答会使旧响应失效 ── */
  const submitAnswer = async (answerOverride?: string, durationOverrideMs?: number, captureStatsOverride?: VoiceCaptureStats) => {
    const incoming = answerOverride?.trim() || (useTextFallback ? textAnswer.trim() : transcribedText.trim());
    if (!incoming) return;
    const pending = pendingAnswerRef.current;
    const finalAnswer = combineTurnText(pending?.text ?? "", incoming);
    const answerDurationMs = (pending?.durationMs ?? 0) + (durationOverrideMs ?? Math.max(1, seconds * 1000));
    const captureStats = captureStatsOverride && pending?.stats ? {
      ...captureStatsOverride,
      activeSpeechMs: pending.stats.activeSpeechMs + captureStatsOverride.activeSpeechMs,
      pauseDurationsMs: [...pending.stats.pauseDurationsMs, ...captureStatsOverride.pauseDurationsMs],
      thinkingBeforeAnswerMs: pending.stats.thinkingBeforeAnswerMs,
      volumeSamples: [...pending.stats.volumeSamples, ...captureStatsOverride.volumeSamples],
    } : captureStatsOverride;
    pendingAnswerRef.current = { text: finalAnswer, durationMs: answerDurationMs, stats: captureStats };
    const request = responseGateRef.current.begin();
    stopPlayback();
    setSaving(true);
    if (!useTextFallback) beginListeningTurn();
    setInterviewerState("thinking");
    setConversationLog(log => pending && log.at(-1)?.speaker === "candidate"
      ? [...log.slice(0, -1), { speaker: "candidate", text: finalAnswer }]
      : [...log, { speaker: "candidate", text: finalAnswer }]);
    const answerSeconds = Math.max(1, Math.round(answerDurationMs / 1000));
    const speechMetrics: SpeechMetrics | null = captureStats && captureStats.activeSpeechMs > 0
      ? analyzeSpeechMetrics(finalAnswer, answerDurationMs, captureStats.activeSpeechMs, captureStats.pauseDurationsMs,
          captureStats.thinkingBeforeAnswerMs, captureStats.volumeSamples)
      : null;
    let modelInsight: InterviewModelAnalysis | null = null;
    let nextQuestion = "";
    if (modelAvailable) {
      try {
        const r = await apiFetch("/api/interview/model", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
          body: JSON.stringify({
            action: "turn", provider, model: modelName, apiKey,
            role: jobParsed?.title ?? "通用能力", difficulty: jobParsed?.difficulty ?? "standard",
            jobContext: jobParsed,
            history: [...answers.map(a => ({ question: a.question, answer: a.answer, seconds: a.seconds, speechMetrics: a.speechMetrics })),
              { question: currentQuestion, answer: finalAnswer, seconds: answerSeconds, speechMetrics }],
          }),
        });
        const body = await r.json();
        if (!responseGateRef.current.isCurrent(request.id)) return;
        if (!r.ok) throw new Error(body.error || "模型暂时不可用");
        modelInsight = body.analysis ?? null;
        nextQuestion = body.question ?? "";
      } catch (error) {
        if (!responseGateRef.current.isCurrent(request.id)) return;
        showToast(`${error instanceof Error ? error.message : "模型连接中断"}，已继续练习提纲`, 5000);
      }
    }
    if (!responseGateRef.current.isCurrent(request.id) || callPausedRef.current || !callActiveRef.current) return;
    pendingAnswerRef.current = null;
    let scored = scoreAnswerV2(currentQuestion, finalAnswer, answerSeconds, jobParsed?.skills ?? [], speechMetrics);
    if (modelInsight) scored = applyModelEvaluation(scored, modelInsight);
    const newAnswers = [...answers, scored];
    setAnswers(newAnswers);
    setTextAnswer("");
    setTranscribedText("");
    setSeconds(0);
    const questions = interviewPlan?.questions ?? [];
    const hasCoveredCoreFlow = newAnswers.length >= Math.min(5, Math.max(1, questions.length));
    const reachedTimeTarget = callSeconds >= INTERVIEW_DURATION_SECONDS - 45 && hasCoveredCoreFlow;
    const reachedTurnLimit = newAnswers.length >= (modelAvailable ? MAX_CONVERSATION_TURNS : Math.max(1, questions.length));
    if (!reachedTimeTarget && !reachedTurnLimit) {
      const nextIdx = index + 1;
      const nextQ = nextQuestion || questions[nextIdx]?.label || "面对一个不熟悉的任务，你会怎样补齐能力并推进交付？";
      setCurrentQuestion(nextQ);
      setIndex(nextIdx);
      setSaving(false);
      speakQuestion(nextQ);
    } else await completeInterview(newAnswers);
  };

  const handleLiveTurnComplete = (text: string, durationMs: number, stats: VoiceCaptureStats) => {
    liveListeningRef.current = false;
    setLiveTranscript(text);
    setTranscribedText(text);
    setAsrError("");
    void submitAnswer(text, durationMs, stats);
  };

  const handleLiveSpeechError = (message: string) => {
    liveListeningRef.current = false;
    setLiveListening(false);
    setAsrError(message);
    setTextAnswer(liveTranscript);
    setUseTextFallback(true);
    setInterviewerState("idle");
    showToast(message, 5000);
  };

  const toggleCallPause = () => {
    if (voiceMode === "realtime" && realtimeContext) {
      callPausedRef.current = !callPaused;
      setCallPaused(!callPaused);
      setInterviewerState(callPaused ? "listening" : "idle");
      return;
    }
    if (callPaused) {
      callPausedRef.current = false;
      setCallPaused(false);
      setAsrError("");
      setUseTextFallback(false);
      beginListeningTurn();
      if (!pendingAnswerRef.current) speakQuestion(currentQuestion, false);
      return;
    }
    if (liveTranscript.trim() && !pendingAnswerRef.current) {
      pendingAnswerRef.current = { text: liveTranscript.trim(), durationMs: Math.max(1, seconds * 1000) };
    }
    callPausedRef.current = true;
    responseGateRef.current.cancel();
    stopPlayback();
    liveListeningRef.current = false;
    setSaving(false);
    setCallPaused(true);
    setLiveListening(false);
    setInterviewerState("idle");
  };

  /* ── 重试保存 ── */
  const retrySave = async () => {
    if (!pendingReport) return;
    setSaving(true);
    try {
      const rpt = generateReportV2(pendingReport);
      const r = await apiFetch("/api/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: jobParsed?.title ?? "通用能力",
          difficulty: jobParsed?.difficulty === "advanced" ? "进阶" : jobParsed?.difficulty === "entry" ? "入门" : "标准",
          answers: pendingReport.map(a => ({ question: a.question, answer: a.answer, seconds: a.seconds, speechMetrics: a.speechMetrics })),
          modelProvider: provider, modelName, reportV2: rpt,
        }),
      });
      if (r.ok) {
        const b = await r.json();
        setReport(b.report ?? rpt);
        setPageMode("report");
        setPendingReport(null);
        setHistory(previous => [{
          id: b.id ?? crypto.randomUUID(),
          targetRole: jobParsed?.title ?? "通用能力",
          overallScore: rpt.overallScore,
          createdAt: Date.now(),
        }, ...previous].slice(0, 12));
        showToast("报告已重新保存到云端");
      } else {
        throw new Error((await r.json()).error);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败");
    } finally { setSaving(false); }
  };

  /* ── 重置 ── */
  const resetAll = () => {
    setRealtimeContext(null);
    setOutputAudioLevel(0);
    nativeReviewSessionRef.current += 1;
    nativeReviewControllersRef.current.forEach(controller => controller.abort());
    nativeAnswersRef.current = [];
    callActiveRef.current = false;
    liveListeningRef.current = false;
    pendingAnswerRef.current = null;
    responseGateRef.current.cancel();
    stopPlayback();
    setPageMode("setup");
    setSetupStep("resume");
    setResumeFile(null); setResumeParsed(null); setResumeError("");
    setJobParsed(null); setJobError("");
    setInterviewPlan(null);
    setAnswers([]); setTextAnswer(""); setSeconds(0);
    setReport(null); setPendingReport(null);
    setApiKey(""); setConnection({ status: "idle", message: "准备开始新的面试" });
    setTranscribedText(""); setAsrError(""); setUseTextFallback(false);
    setCallSeconds(0); setCallPaused(false); setLiveListening(false); setLiveTranscript("");
    setLiveSpeechStatus("idle"); setConversationLog([]);
    setInterviewerState("idle");
  };

  /* ── 投递岗位切换 ── */
  const selectCareerJob = (id: string) => {
    setApplicationId(id);
    const app = careerApplications.find(a => a.id === id);
    if (app) {
      setManualJobTitle(app.title);
      setManualJobCompany(app.company);
      setManualJobDesc(app.description ?? "");
      setJobParsed(null);
      setJobSource("saved");
    }
  };

  /* ═══════════════════════════════════════════
     SETUP 页面
     ═══════════════════════════════════════════ */
  if (pageMode === "setup") {
    return (
      <div ref={studioRef} className="interview-studio-root interview-studio-root--setup">
      <PortalFrame active="interview" eyebrow="INTERVIEW STUDIO" title="和 liuli 老师，完成一场真实的模拟面试" subtitle="多格式简历识别 · 连续语音追问 · 约 15 分钟 · 结构化复盘">
        <div className="voice-interview-setup interview-v3">
          {/* 左侧：进度步骤 */}
          <aside className="setup-steps-panel">
            <div className={`step-item ${setupStep === "resume" ? "active" : resumeParsed ? "done" : ""}`}>
              <span className="step-num">{resumeParsed ? "✓" : "1"}</span>
              <div><b>上传简历</b><small>文档、Markdown、图片与扫描件，最大3MB</small></div>
            </div>
            <div className={`step-item ${setupStep === "job" ? "active" : jobParsed ? "done" : ""}`}>
              <span className="step-num">{jobParsed ? "✓" : "2"}</span>
              <div><b>选择岗位</b><small>从已投递选择或手动粘贴岗位描述</small></div>
            </div>
            <div className={`step-item ${setupStep === "plan" ? "active" : interviewPlan ? "done" : ""}`}>
              <span className="step-num">{interviewPlan ? "✓" : "3"}</span>
              <div><b>生成谈话提纲</b><small>提纲练习与智能追问</small></div>
            </div>
            <div className={`step-item ${setupStep === "ready" ? "active" : ""}`}>
              <span className="step-num">4</span>
              <div><b>开始实时通话</b><small>liuli老师自然追问，Chrome 自动转写回答</small></div>
            </div>
          </aside>

          {/* 右侧：配置面板 */}
          <section className="setup-config-panel">
            {/* Step 1: 简历 */}
            {setupStep === "resume" && (
              <div className="setup-card portal-card" data-studio-panel>
                <div className="card-heading"><div><span>STEP 1</span><h2>上传简历</h2></div></div>
                <ResumeUploader onFileSelected={handleResumeFile} uploading={resumeUploading} progress={resumeUploadProgress} error={resumeError} />
                {resumeParsed && (
                  <div className="resume-preview">
                    <h3>解析结果（请确认和修改）</h3>
                    <div className="resume-fields">
                      {(["name", "education", "major", "skills", "projects", "internships", "competitions", "selfEval"] as const).map(field => (
                        <label key={field}>
                          <span>{field === "name" ? "姓名" : field === "education" ? "学历" : field === "major" ? "专业" : field === "skills" ? "技能" : field === "projects" ? "项目经历" : field === "internships" ? "实习经历" : field === "competitions" ? "竞赛证书" : "自我评价"}</span>
                          {field === "skills" ? (
                            <input value={resumeParsed.skills.join("、")} onChange={e => setResumeParsed({ ...resumeParsed, skills: e.target.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean) })} />
                          ) : field === "projects" ? (
                            <textarea value={resumeParsed.projects.map(p => p.description ? `${p.name}：${p.description}` : p.name).join("\n")} onChange={e => setResumeParsed({ ...resumeParsed, projects: e.target.value.split("\n").filter(Boolean).map(line => { const [n, ...d] = line.split("："); return { name: n || "", description: d.join("：") }; }) })} rows={3} />
                          ) : field === "internships" ? (
                            <textarea value={resumeParsed.internships.map(i => `${[i.company, i.role].filter(Boolean).join(" ")}${i.description ? `：${i.description}` : ""}`).join("\n")} onChange={e => setResumeParsed({ ...resumeParsed, internships: e.target.value.split("\n").filter(Boolean).map(line => { const parts = line.split("："); const head = parts[0]?.split(" ") ?? []; return { company: head[0] || "", role: head[1] || "", description: parts.slice(1).join("：") }; }) })} rows={3} />
                          ) : field === "competitions" ? (
                            <textarea value={resumeParsed.competitions.map(c => c.award ? `${c.name}：${c.award}` : c.name).join("\n")} onChange={e => setResumeParsed({ ...resumeParsed, competitions: e.target.value.split("\n").filter(Boolean).map(line => { const [n, ...a] = line.split("："); return { name: n || "", award: a.join("：") }; }) })} rows={2} />
                          ) : (
                            <input value={String(resumeParsed[field as keyof ResumeStructured] ?? "")} onChange={e => setResumeParsed({ ...resumeParsed, [field]: e.target.value })} />
                          )}
                        </label>
                      ))}
                    </div>
                    <button className="btn-primary" onClick={() => setSetupStep("job")}>确认简历，下一步 →</button>
                  </div>
                )}
                <button className="btn-ghost" onClick={() => { setSetupStep("job"); }} style={{ marginTop: 10 }}>跳过简历上传 →</button>
              </div>
            )}

            {/* Step 2: 岗位 */}
            {setupStep === "job" && (
              <div className="setup-card portal-card" data-studio-panel>
                <div className="card-heading"><div><span>STEP 2</span><h2>选择或填写岗位</h2></div></div>
                <div className="job-source-tabs">
                  <button className={jobSource === "none" ? "active" : ""} onClick={() => setJobSource("none")}>不指定岗位</button>
                  <button className={jobSource === "saved" ? "active" : ""} onClick={() => setJobSource("saved")}>已投递岗位</button>
                  <button className={jobSource === "manual" ? "active" : ""} onClick={() => setJobSource("manual")}>手动填写</button>
                </div>

                {jobSource === "saved" && careerApplications.length > 0 && (
                  <div className="saved-jobs-list">
                    {careerApplications.map(app => (
                      <button key={app.id} className={applicationId === app.id ? "active" : ""} onClick={() => selectCareerJob(app.id)}>
                        <b>{app.title}</b><span>{app.company}</span>
                      </button>
                    ))}
                    {applicationId && <button className="btn-primary" onClick={parseJob}>确认岗位，解析 →</button>}
                  </div>
                )}
                {jobSource === "saved" && careerApplications.length === 0 && (
                  <p className="muted">还没有投递记录，请先前往“实习就业”投递，或选择手动填写。</p>
                )}

                {jobSource === "manual" && (
                  <div className="manual-job-form">
                    <label><span>岗位名称 *</span><input value={manualJobTitle} onChange={e => setManualJobTitle(e.target.value)} placeholder="如：后端开发实习生" /></label>
                    <label><span>企业名称</span><input value={manualJobCompany} onChange={e => setManualJobCompany(e.target.value)} placeholder="如：字节跳动" /></label>
                    <label><span>岗位描述 *</span><textarea value={manualJobDesc} onChange={e => setManualJobDesc(e.target.value)} placeholder="粘贴岗位描述文本..." rows={6} /></label>
                    <button className="btn-primary" onClick={parseJob} disabled={!manualJobTitle || !manualJobDesc}>解析岗位 →</button>
                  </div>
                )}

                {jobSource === "none" && (
                  <div className="no-job-note">
                    <p>不指定岗位也可以进行通用能力面试。面试官会根据你的简历进行提问。</p>
                    <button className="btn-primary" onClick={() => setSetupStep("plan")}>跳过，生成面试计划 →</button>
                  </div>
                )}

                {jobParsed && (
                  <div className="job-preview">
                    <h3>解析结果</h3>
                    <div className="job-tags">
                      {jobParsed.skills.map(s => <span key={s} className="tag">{s}</span>)}
                      {jobParsed.coreCompetencies.map(c => <span key={c} className="tag dim">{c}</span>)}
                    </div>
                    <p>经验要求：{jobParsed.experienceReq} · 难度：{jobParsed.difficulty === "advanced" ? "进阶" : jobParsed.difficulty === "entry" ? "入门" : "标准"}</p>
                    <button className="btn-primary" onClick={() => setSetupStep("plan")}>确认，生成面试计划 →</button>
                  </div>
                )}
                {jobError && <div className="error-msg">{jobError}</div>}
                <button className="btn-ghost" onClick={() => setSetupStep("plan")} style={{ marginTop: 8 }}>跳过岗位 →</button>
              </div>
            )}

            {/* Step 3: 模型 & 计划 */}
            {(setupStep === "plan" || setupStep === "ready") && (
              <div className="setup-card portal-card" data-studio-panel>
                <div className="card-heading"><div><span>STEP 3</span><h2>生成面试计划</h2></div></div>

                <div className="job-source-tabs" style={{ marginBottom: 14 }}>
                  <button className={planMode === "local" ? "active" : ""} onClick={() => { setPlanMode("local"); setInterviewPlan(null); setModelAvailable(false); }}>提纲练习</button>
                  <button disabled={!capabilities.modelConfigured && !capabilities.allowClientKeys} title={!capabilities.modelConfigured && !capabilities.allowClientKeys ? "管理员配置模型后开启" : undefined} className={planMode === "ai" ? "active" : ""} onClick={() => { setPlanMode("ai"); setInterviewPlan(null); }}>智能面试</button>
                </div>

                {/* 模型连接 */}
                {planMode === "local" ? (
                  <div className="no-job-note" style={{ marginBottom: 16 }}>
                    <p>按提纲练习，完成后查看五维反馈。</p>
                  </div>
                ) : <div className="model-connect-panel">
                  {capabilities.allowClientKeys && <div className="model-provider-tabs">
                    {(Object.keys(INTERVIEW_MODEL_PROVIDERS) as InterviewModelProvider[]).map(p => (
                      <button key={p} className={provider === p ? "active" : ""} onClick={() => { setProvider(p); setModelName(INTERVIEW_MODEL_PROVIDERS[p].defaultModel); setUseCustomModel(false); setApiKey(""); setConnection({ status: "idle", message: "请输入 API Key" }); }}>
                        <b>{INTERVIEW_MODEL_PROVIDERS[p].label}</b>
                        <small>{INTERVIEW_MODEL_PROVIDERS[p].description}</small>
                      </button>
                    ))}
                  </div>}
                  {capabilities.allowClientKeys && <div className="model-credentials">
                    <label>
                      <span>模型</span>
                      {!useCustomModel ? (
                        <select
                          value={modelName}
                          onChange={event => {
                            if (event.target.value === "__custom__") {
                              setUseCustomModel(true);
                              setModelName("");
                            } else {
                              setModelName(event.target.value);
                            }
                            setConnection({ status: "idle", message: "请测试连接" });
                          }}
                        >
                          {providerInfo.models.map(model => <option value={model.id} key={model.id}>{model.label}</option>)}
                          <option value="__custom__">自定义模型 / Endpoint ID…</option>
                        </select>
                      ) : (
                        <div className="custom-model-row">
                          <input value={modelName} onChange={event => setModelName(event.target.value)} placeholder={provider === "doubao" ? "输入模型名或 ep- 开头的 Endpoint ID" : "输入模型名称"} />
                          <button type="button" onClick={() => { setUseCustomModel(false); setModelName(providerInfo.defaultModel); }}>使用预设</button>
                        </div>
                      )}
                    </label>
                    {capabilities.allowClientKeys && <label><span>API Key</span><input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); if (connection.status !== "idle") setConnection({ status: "idle", message: "请重新测试连接" }); }} placeholder="仅保留在当前页面内存" /></label>}
                  </div>}
                  <label style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, marginBottom: 12 }}>
                    <input type="checkbox" checked={privacyAccepted} onChange={e => { setPrivacyAccepted(e.target.checked); if (!e.target.checked) setConnection({ status: "idle", message: "请确认数据传输说明" }); }} />
                    <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>同意将简历、岗位和回答发送至 {providerInfo.label} 生成面试反馈</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 9, color: connection.status === "connected" ? "var(--green)" : "var(--ink-dim)", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: connection.status === "connected" ? "var(--green)" : "var(--muted)", display: "inline-block" }} />{connection.message}{connection.latencyMs ? ` · ${connection.latencyMs}ms` : ""}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      {capabilities.allowClientKeys && <a href={providerConsoles[provider]} target="_blank" rel="noreferrer" style={{ fontSize: 8, color: "var(--ink-dim)", padding: "7px 9px", borderRadius: 6 }}>控制台</a>}
                      <button onClick={testConnection} disabled={connection.status === "testing"} style={{ fontSize: 8, padding: "7px 9px", borderRadius: 6, background: "var(--accent)", color: "white", border: "none" }}>{connection.status === "testing" ? "测试中..." : "测试连接"}</button>
                    </div>
                  </div>
                </div>}

                <div className="job-source-tabs" aria-label="语音方式" style={{ marginBottom: 14 }}>
                  <button className={voiceMode === "browser" ? "active" : ""} onClick={() => setVoiceMode("browser")}>浏览器语音</button>
                  <button className={voiceMode === "realtime" ? "active" : ""} disabled={!capabilities.nativeRealtimeConfigured}
                    title={capabilities.nativeRealtimeConfigured ? "直接音频对话" : "管理员配置实时语音后开启"}
                    onClick={() => setVoiceMode("realtime")}>双向实时语音{!capabilities.nativeRealtimeConfigured ? " · 待开通" : ""}</button>
                </div>
                {voiceMode === "realtime" && <label style={{ display: "flex", gap: 8, alignItems: "start", marginBottom: 16, fontSize: 11 }}>
                  <input type="checkbox" checked={realtimeConsent} onChange={event => setRealtimeConsent(event.target.checked)} />
                  <span>同意将声音、岗位与简历经历发送至 OpenAI{capabilities.modelConfigured || modelAvailable ? `，并由 ${providerInfo.label} 根据转写内容生成评分反馈` : ""}。通话由平台付费提供，最长 15 分钟。</span>
                </label>}
                {/* 生成计划 */}
                {!interviewPlan ? (
                  <button className="btn-primary" onClick={planMode === "local" ? generateLocalPlan : generatePlan} disabled={planMode === "ai" && (planGenerating || connection.status !== "connected")} style={{ width: "100%" }}>
                    {planMode === "local" ? "生成练习提纲" : planGenerating ? "AI 正在生成面试计划..." : "生成 AI 面试计划"}
                  </button>
                ) : (
                  <div className="plan-preview">
                    <h3>本次面试提纲</h3>
                    <div className="plan-questions">
                      {interviewPlan.questions.map((q, i) => (
                        <div key={q.id} className="plan-question-item" data-plan-question>
                          <span className="q-num">{String.fromCharCode(65 + i)}</span>
                          <div><b>{q.label}</b><small>{q.guidance}</small></div>
                          <span className="q-cat">{q.category === "self_intro" ? "自我介绍" : q.category === "resume_deep" ? "简历深挖" : q.category === "professional" ? "专业能力" : q.category === "scenario" ? "情景处理" : q.category === "teamwork" ? "团队协作" : q.category === "pressure" ? "压力追问" : q.category === "career" ? "职业规划" : "反问"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="plan-actions">
                      <button className="btn-ghost" onClick={() => setInterviewPlan(null)}>重新生成</button>
                      <button className="btn-primary" onClick={startInterview}>进入实时通话 →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 虚拟面试官预览 */}
          <aside className="setup-interviewer-preview">
            {setupStep === "plan" || setupStep === "ready" ? <VirtualInterviewer state={interviewerState} /> : <MentorPlaceholder />}
          </aside>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <section className="portal-card" style={{ marginTop: 24 }}>
            <div className="card-heading"><div><span>HISTORY</span><h2>最近面试记录</h2></div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {history.map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <b style={{ fontSize: 12 }}>{h.targetRole}</b>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{new Date(h.createdAt).toLocaleDateString("zh-CN")}</span>
                  <strong style={{ fontSize: 14, marginLeft: "auto" }}>{h.overallScore}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {toast && <div className="portal-toast" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--surface-elevated)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 20px", fontSize: 11, zIndex: 100 }}>{toast}</div>}
      </PortalFrame>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     ACTIVE 面试页面
     ═══════════════════════════════════════════ */
  if (pageMode === "active") {
    const callProgress = Math.min(100, Math.round(callSeconds / INTERVIEW_DURATION_SECONDS * 100));
    const statusCopy = callPaused
      ? "通话已暂停"
      : interviewerState === "speaking"
        ? "liuli老师正在提问"
        : interviewerState === "listening"
          ? "轮到你回答"
          : interviewerState === "thinking"
            ? "liuli老师正在整理追问"
            : interviewerState === "scoring"
              ? "正在整理反馈"
              : "实时面试进行中";
    return (
      <div ref={studioRef} className="interview-studio-root interview-studio-root--active" data-navigation-guard="面试正在进行，离开会结束当前语音与作答状态。确认离开吗？">
      <PortalFrame active="interview" eyebrow={`${jobParsed?.title ?? "通用能力"} INTERVIEW`}
        title="与liuli老师的实时模拟面试"
        subtitle={`约 15 分钟连续对话 · ${voiceMode === "realtime" ? "双向实时语音" : "浏览器语音"} · 原始录音不保存`}
        actions={(
          <div className="live-call-header-actions">
            <button className="ghost-action" onClick={toggleCallPause}>{callPaused ? "继续通话" : "暂停"}</button>
            <button className="ghost-action danger" onClick={finishCurrentInterview} disabled={saving}>结束并生成报告</button>
          </div>
        )}
      >
        <div className="live-interview-stage interview-v3">
          <aside className="live-mentor-panel portal-card" data-studio-mentor>
            <div className="live-call-badge">
              <span className={callPaused ? "paused" : ""} />
              {statusCopy}
            </div>
            <VirtualInterviewer state={interviewerState} audioLevel={voiceMode === "realtime" ? outputAudioLevel : audioLevel} inputLevel={audioLevel} ttsSource={ttsSource} />
            <div className="live-call-meter" aria-label="麦克风实时音量">
              {Array.from({ length: 18 }).map((_, meterIndex) => (
                <i
                  key={meterIndex}
                  className={audioLevel > meterIndex / 18 ? "active" : ""}
                  style={{ height: `${6 + Math.sin((meterIndex / 18) * Math.PI) * 18}px` }}
                />
              ))}
            </div>
            <div className="live-call-time">
              <span>{format(callSeconds)}</span>
              <div><i style={{ width: `${callProgress}%` }} /></div>
              <small>预计 15:00</small>
            </div>
            <p className="live-privacy-note">仅保存转写文本和客观表达指标，不保存原始录音。</p>
          </aside>

          <section className="live-conversation-panel portal-card">
            <header className="live-conversation-header">
              <div>
                <span className="live-room-title">模拟面试通话</span>
                <h2>{statusCopy}</h2>
              </div>
              <div className="live-signal-summary">
                <span className={browserSpeechReady ? "ready" : "warning"}>
                  <i />{voiceMode === "realtime" ? "双向实时语音" : browserSpeechReady ? "浏览器识别" : "等待语音能力"}
                </span>
                <span className={modelAvailable ? "ready" : "warning"}>
                  <i />{voiceMode === "realtime" && realtimeContext ? "音频实时追问" : modelAvailable ? "动态追问" : "内置流程"}
                </span>
              </div>
            </header>

            <div className="live-transcript-feed" aria-live="polite">
              {conversationLog.length === 0 && (
                <div className="live-call-empty">
                  <span>通话即将开始</span>
                  <p>liuli老师会先介绍本次面试，然后自然地引导你完成后续交流。</p>
                </div>
              )}
              {conversationLog.slice(-7).map((entry, logIndex) => (
                <article className={`live-transcript-entry ${entry.speaker}`} data-live-entry key={`${entry.speaker}-${logIndex}-${entry.text.slice(0, 12)}`}>
                  <span>{entry.speaker === "interviewer" ? "liuli老师" : "我"}</span>
                  <p>{entry.text}</p>
                </article>
              ))}
              {liveListening && liveTranscript && (
                <article className="live-transcript-entry candidate is-live" data-live-entry>
                  <span>我 · 实时</span>
                  <p>{liveTranscript}</p>
                </article>
              )}
              {saving && (
                <div className="live-thinking-row">
                  <span /><span /><span />
                  {interviewerState === "scoring" ? "正在生成面试报告…" : "liuli老师正在根据你的回答继续交流"}
                </div>
              )}
            </div>

            <div className="live-turn-console" data-live-console>
              {voiceMode === "realtime" && realtimeContext ? <NativeRealtimeConversation
                ref={nativeRealtimeRef}
                context={realtimeContext}
                paused={callPaused}
                onStateChange={setInterviewerState}
                onInputLevel={setAudioLevel}
                onOutputLevel={setOutputAudioLevel}
                onTranscript={entries => {
                  setConversationLog(entries.filter(entry => entry.text).map(entry => ({ speaker: entry.speaker,
                    text: entry.text + (entry.interrupted ? "（已打断）" : "") })));
                  const latestQuestion = entries.findLast(entry => entry.speaker === "interviewer");
                  if (latestQuestion?.text) setCurrentQuestion(latestQuestion.text);
                }}
                onTurn={turn => {
                  if (nativeTurnIdsRef.current.has(turn.id)) return;
                  nativeTurnIdsRef.current.add(turn.id);
                  const metrics = turn.stats && turn.stats.activeSpeechMs > 0
                    ? analyzeSpeechMetrics(turn.answer, turn.durationMs, turn.stats.activeSpeechMs,
                        turn.stats.pauseDurationsMs, turn.stats.thinkingBeforeAnswerMs, turn.stats.volumeSamples) : null;
                  const scored = scoreAnswerV2(turn.question, turn.answer, Math.max(1, Math.round(turn.durationMs / 1000)), jobParsed?.skills ?? [], metrics);
                  scored.realtimeTurnId = turn.id;
                  const canReview = realtimeConsent && (capabilities.modelConfigured || modelAvailable);
                  if (canReview) scored.evaluationNote = "AI 反馈生成中";
                  nativeScoresRef.current.set(turn.id, { order: turn.order, answer: scored });
                  if (canReview) {
                    const session = nativeReviewSessionRef.current;
                    const controller = new AbortController();
                    nativeReviewControllersRef.current.add(controller);
                    const timeout = setTimeout(() => controller.abort(), 22000);
                    const reviewHistory = [...nativeScoresRef.current.values()].filter(item => item.order <= turn.order)
                      .sort((a, b) => a.order - b.order).slice(-12).map(item => ({ question: item.answer.question,
                        answer: item.answer.answer, seconds: item.answer.seconds, speechMetrics: item.answer.speechMetrics }));
                    const task = reviewAnswerWithEvidence(scored, async () => {
                      const response = await apiFetch("/api/interview/model", { method: "POST", signal: controller.signal,
                        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review",
                          provider, model: modelName, apiKey, role: jobParsed?.title ?? "通用能力", jobContext: jobParsed,
                          history: reviewHistory }) });
                      const body = await response.json();
                      if (!response.ok || !body.analysis) throw new Error("评估未完成");
                      return body.analysis as InterviewModelAnalysis;
                    }).then(reviewed => {
                      if (session !== nativeReviewSessionRef.current) return;
                      nativeScoresRef.current.set(turn.id, { order: turn.order, answer: reviewed });
                      nativeAnswersRef.current = [...nativeScoresRef.current.values()].sort((a, b) => a.order - b.order).map(item => item.answer);
                      setAnswers(nativeAnswersRef.current);
                    }).finally(() => {
                      clearTimeout(timeout);
                      nativeReviewControllersRef.current.delete(controller);
                      nativeReviewTasksRef.current.delete(task);
                    });
                    nativeReviewTasksRef.current.add(task);
                  }
                  nativeAnswersRef.current = [...nativeScoresRef.current.values()].sort((left, right) => left.order - right.order).map(item => item.answer);
                  setAnswers(nativeAnswersRef.current);
                  setIndex(nativeAnswersRef.current.length);
                }}
                onError={message => { setAsrError(message); setInterviewerState("idle"); }}
                onLimit={() => {
                  if (nativeAnswersRef.current.length) void completeInterview(nativeAnswersRef.current, false);
                  else { setRealtimeContext(null); setVoiceMode("browser"); setUseTextFallback(true); setInterviewerState("idle"); showToast("通话已结束，尚无可用转写"); }
                }}
              /> : <ContinuousSpeechRecognition
                active={liveListening && !callPaused && !useTextFallback}
                turnKey={liveTurnKey}
                speaking={interviewerState === "speaking"}
                spokenText={currentQuestion}
                onSpeechStart={interruptResponse}
                maxDurationMs={90_000}
                silenceMs={1_500}
                onInterimChange={setLiveTranscript}
                onAudioLevel={setAudioLevel}
                onStatusChange={setLiveSpeechStatus}
                onComplete={handleLiveTurnComplete}
                onError={handleLiveSpeechError}
              />}

              {callPaused && (
                <div className="live-paused-note">
                  <b>通话已暂停</b>
                  <span>点击页面右上角“继续通话”，liuli老师会从当前问题继续。</span>
                </div>
              )}

              {voiceMode === "realtime" && asrError && <div className="live-text-fallback"><b>{asrError}</b>
                <button className="btn-ghost" onClick={() => {
                  setVoiceMode("browser"); setRealtimeContext(null); setAsrError(""); setUseTextFallback(true);
                }}>切换文字练习</button>
              </div>}
              {(useTextFallback || asrError) && !(voiceMode === "realtime" && realtimeContext) && !callPaused && (
                <div className="live-text-fallback">
                  <div>
                    <b>{asrError ? "语音识别已暂停" : "文字回答"}</b>
                    <span>{asrError || "输入后发送"}</span>
                  </div>
                  <textarea
                    value={textAnswer}
                    onChange={event => setTextAnswer(event.target.value)}
                    placeholder="在这里输入回答，提交后面试会继续…"
                    rows={4}
                    disabled={saving}
                  />
                  <footer>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setUseTextFallback(false);
                        setAsrError("");
                        beginListeningTurn();
                      }}
                    >
                      重试语音
                    </button>
                    <button className="btn-primary" onClick={() => void submitAnswer()} disabled={saving || textAnswer.trim().length < 1}>
                      {saving ? "正在继续面试…" : "发送回答"}
                    </button>
                  </footer>
                </div>
              )}

              {!callPaused && (interviewerState === "speaking" || saving) && (
                <button className="live-replay-question" onClick={interruptResponse}>打断，我想补充</button>
              )}
              {voiceMode !== "realtime" && !callPaused && interviewerState === "speaking" && (
                <button className="live-replay-question" onClick={() => speakQuestion(currentQuestion, false)}>
                  没听清？重新播放
                </button>
              )}

              {pendingReport && (
                <button className="btn-primary" onClick={retrySave} disabled={saving}>
                  {saving ? "保存中…" : "重试保存报告"}
                </button>
              )}

              {voiceMode !== "realtime" && !useTextFallback && !callPaused && (
                <button className="live-replay-question" onClick={() => {
                  interruptResponse();
                  liveListeningRef.current = false;
                  setLiveListening(false);
                  setUseTextFallback(true);
                  setTextAnswer(liveTranscript);
                }}>改用文字回答</button>
              )}
              <div className="live-console-footnote">
                <span>{liveSpeechStatus === "hearing" ? "正在接收你的回答" : "停顿后自动接话 · 可随时打断"}</span>
                <span>建议佩戴耳机，降低扬声器回声</span>
              </div>
            </div>
          </section>
        </div>
        {toast && <div className="portal-toast" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--surface-elevated)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 20px", fontSize: 11, zIndex: 100 }}>{toast}</div>}
      </PortalFrame>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     REPORT 页面
     ═══════════════════════════════════════════ */
  if (pageMode === "report" && report) {
    return (
      <div ref={studioRef} className="interview-studio-root interview-studio-root--report">
      <PortalFrame active="interview" eyebrow="INTERVIEW REPORT" title="本次面试报告"
        subtitle={`${jobParsed?.title ?? "通用能力"} · ${report.overallScore} 分`}
        actions={(
          <div className="report-actions">
            <button className="ghost-action" onClick={downloadInterviewReport}>Markdown</button>
            <button className="ghost-action" onClick={() => void exportReportWord()} disabled={Boolean(reportExporting)}>
              {reportExporting === "word" ? "生成 Word…" : "导出 Word"}
            </button>
            <button className="ghost-action" onClick={() => void exportReportPdf()} disabled={Boolean(reportExporting)}>
              {reportExporting === "pdf" ? "生成 PDF…" : "导出 PDF"}
            </button>
            <button className="primary-action" onClick={resetAll}>开始新面试</button>
          </div>
        )}
      >
        <div className="interview-report-page" id="interview-report-document" data-studio-report>
          <section className={`report-save-state ${pendingReport ? "pending" : "saved"}`}>
            <b>{pendingReport ? "报告已在本机生成，尚未保存到云端" : "报告已生成并保存到云端"}</b>
            <span>{pendingReport ? "你仍可下载或打印；网络恢复后点击“重试云端保存”。" : `生成时间：${new Date(report.calculatedAt).toLocaleString("zh-CN", { hour12: false })}`}</span>
            {pendingReport && <button className="ghost-action" onClick={retrySave} disabled={saving}>{saving ? "保存中…" : "重试云端保存"}</button>}
          </section>

          <section className="report-expression portal-card">
            <div>
              <span>口语表达画像</span>
              <h2>{report.expressionSummary.answersWithVoice ? "口语节奏" : "本次使用文字表达"}</h2>
              <p>{report.expressionSummary.observation}</p>
            </div>
            <dl>
              <div><dt>平均语速</dt><dd>{report.expressionSummary.answersWithVoice ? report.expressionSummary.averageWordsPerMinute : "—"}<small>字/分</small></dd></div>
              <div><dt>平均停顿</dt><dd>{report.expressionSummary.answersWithVoice ? report.expressionSummary.averagePauseRatio : "—"}<small>%</small></dd></div>
              <div><dt>开口前思考</dt><dd>{report.expressionSummary.answersWithVoice ? report.expressionSummary.averageThinkingSeconds : "—"}<small>秒</small></dd></div>
              <div><dt>口头语密度</dt><dd>{report.expressionSummary.answersWithVoice ? report.expressionSummary.fillerWordsPerMinute : "—"}<small>次/分</small></dd></div>
            </dl>
          </section>

          {/* 总分 */}
          <section className="report-hero-v2 portal-card">
          <div className="report-score-ring" style={{
            "--ring-progress": report.overallScore,
            width: 120, height: 120, borderRadius: "50%", display: "grid", placeItems: "center",
          } as CSSProperties}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--surface-card)", display: "grid", placeItems: "center" }}>
              <strong style={{ fontSize: 28 }}>{report.overallScore}</strong>
              <small style={{ fontSize: 8, color: "var(--muted)", display: "block" }}>综合得分</small>
            </div>
          </div>
          <div>
            <span style={{ fontSize: 9, color: "var(--green)", background: "var(--green-soft)", padding: "4px 8px", borderRadius: 5 }}>{report.scoredAnswers.some(answer => answer.evaluationSource === "model-evidence") ? "AI 证据评估 · 练习参考" : "提纲评分 · 练习参考"}</span>
            <h2>{report.overallScore >= 80 ? "表现优秀，继续保持" : report.overallScore >= 60 ? "基础扎实，持续改进" : "建议加强练习"}</h2>
            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>共 {report.scoredAnswers.length} 道回答。{report.trendNote}</p>
          </div>
          </section>

          <section className="report-viz-grid">
            <AnimatedBarChart
              title="五维能力换算"
              description="统一换算为百分制，悬停查看原始维度分值。"
              max={100}
              data={([
                { key: "content", label: "经历内容", max: 30 },
                { key: "roleMatch", label: "岗位匹配", max: 20 },
                { key: "professionalDepth", label: "专业深度", max: 20 },
                { key: "logicStructure", label: "逻辑结构", max: 15 },
                { key: "languageExpression", label: "语言表达", max: 15 },
              ] as const).map(item => ({ label: item.label, value: Math.round(report.dimensions[item.key] / item.max * 100), detail: `原始得分 ${report.dimensions[item.key]} / ${item.max}` }))}
            />
            <AnimatedLineChart
              title="逐题表现曲线"
              description="每个节点对应一轮真实回答，悬停查看题目和用时。"
              max={100}
              data={report.scoredAnswers.map((item, index) => ({ label: `第 ${index + 1} 题`, value: item.score, detail: `${item.question}，用时 ${format(item.seconds)}` }))}
            />
          </section>

          {/* 五维得分 */}
          <section className="report-dimensions">
          {([
            { key: "content", label: "经历与内容质量", max: 30 },
            { key: "roleMatch", label: "岗位匹配度", max: 20 },
            { key: "professionalDepth", label: "专业深度", max: 20 },
            { key: "logicStructure", label: "逻辑结构", max: 15 },
            { key: "languageExpression", label: "语言表达", max: 15 },
          ] as const).map(d => (
            <article className="portal-card dim-card" key={d.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: "var(--ink-dim)" }}>{d.label}</span>
                <strong style={{ fontSize: 14 }}>{report.dimensions[d.key]}<small style={{ fontSize: 8, color: "var(--muted)" }}>/{d.max}</small></strong>
              </div>
              <div style={{ height: 4, background: "var(--bg-alt)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  className="report-dimension-fill"
                  style={{ height: "100%", width: `${(report.dimensions[d.key] / d.max) * 100}%`, background: "var(--accent)", borderRadius: 2, transformOrigin: "left center" }}
                />
              </div>
            </article>
          ))}
          </section>

          {/* 优劣势 */}
          <section className="report-insights" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div className="portal-card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 11, margin: "0 0 8px" }}>回答亮点</h3>
            <ul style={{ fontSize: 10, color: "var(--ink-dim)", padding: "0 0 0 16px", margin: 0 }}>
              {report.strengths.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ul>
          </div>
          <div className="portal-card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 11, margin: "0 0 8px" }}>改进建议</h3>
            <ul style={{ fontSize: 10, color: "var(--ink-dim)", padding: "0 0 0 16px", margin: 0 }}>
              {report.improvements.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ul>
          </div>
          </section>

          <section className="portal-card report-action-plan" style={{ marginTop: 12, padding: 20 }}>
            <div className="card-heading"><div><span>NEXT STEP</span><h2>下一步行动计划</h2></div></div>
            <ol>
              {(report.actionPlan ?? []).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ol>
          </section>

          {/* 逐题回顾 */}
          <section className="portal-card report-question-review" style={{ marginTop: 12, padding: 24 }}>
          <div className="card-heading"><div><span>DETAIL</span><h2>逐题证据与指标</h2></div></div>
          {report.scoredAnswers.map((item, idx) => (
            <details key={idx} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }} open>
              <summary style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 11 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 9 }}>{String(idx + 1).padStart(2, "0")}</span>
                <b style={{ flex: 1 }}>{item.question}</b>
                <em style={{ fontSize: 9, fontStyle: "normal", color: "var(--muted)" }}>{item.score} 分 · {format(item.seconds)}</em>
              </summary>
              <div style={{ padding: "0 0 12px 34px" }}>
                <p style={{ fontSize: 10, color: "var(--ink-dim)", lineHeight: 1.7 }}>{item.answer}</p>
                {item.evaluationNote && <p className="muted" style={{ fontSize: 10 }}>{item.evaluationNote}</p>}
                {item.speechMetrics && (
                  <div className="speech-detail" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "8px 12px", background: "var(--bg-alt)", borderRadius: 6, marginBottom: 8, fontSize: 9 }}>
                    <span>语速：{item.speechMetrics.wordsPerMinute} 字/分</span>
                    <span>停顿：{item.speechMetrics.pauseRatio}%</span>
                    <span>思考：{(item.speechMetrics.thinkingBeforeAnswerMs / 1000).toFixed(1)} 秒</span>
                    <span>口头语：{item.speechMetrics.fillerWordsPerMinute} 次/分</span>
                    <span>STAR：{item.speechMetrics.starCompleteness}/4</span>
                  </div>
                )}
                <aside style={{ padding: 12, background: "var(--bg-alt)", borderRadius: 6 }}>
                  <b style={{ fontSize: 9, color: "var(--green)" }}>+ {item.evidence.highlight}</b>
                  <span style={{ display: "block", fontSize: 9, color: "var(--amber)", marginTop: 4 }}>- {item.evidence.gap}</span>
                  {item.evidence.originalQuote && <blockquote style={{ fontSize: 8, color: "var(--muted)", margin: "8px 0 0", padding: "0 0 0 8px", borderLeft: "2px solid var(--line)" }}>“{item.evidence.originalQuote}”</blockquote>}
                </aside>
                {item.riskPoints.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 9, color: "var(--red)" }}>
                    {item.riskPoints.map((rp, ri) => <div key={ri}>⚠ {rp}</div>)}
                  </div>
                )}
              </div>
            </details>
          ))}
          </section>

          <p className="report-disclaimer">本报告供面试练习参考，反馈依据本次回答生成。</p>
        </div>
        {toast && <div className="portal-toast" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--surface-elevated)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 20px", fontSize: 11, zIndex: 100 }}>{toast}</div>}
      </PortalFrame>
      </div>
    );
  }

  // 加载中
  return <PortalFrame active="interview" eyebrow="" title="加载中..." subtitle=""><p>Loading...</p></PortalFrame>;
}
