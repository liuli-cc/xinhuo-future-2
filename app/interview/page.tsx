"use client";

import { apiFetch } from "../../lib/bmob-api";
import PortalFrame from "../components/PortalFrame";
import VirtualInterviewer, { type InterviewerState } from "../components/VirtualInterviewer";
import ContinuousSpeechRecognition, {
  supportsBrowserSpeechRecognition,
  type LiveSpeechStatus,
} from "../components/ContinuousSpeechRecognition";
import ResumeUploader from "../components/ResumeUploader";
import {
  INTERVIEW_MODEL_PROVIDERS,
  type InterviewModelProvider,
  type InterviewModelAnalysis,
} from "../../lib/interview-model";
import type { ResumeStructured } from "../../lib/resume-parser";
import type { JobStructured } from "../../lib/job-parser";
import { defaultInterviewPlan, type InterviewPlan } from "../../lib/interview-plan";
import type { SpeechMetrics } from "../../lib/speech-analysis";
import { generateReportV2, type ScoredAnswer, type InterviewReportV2 } from "../../lib/scoring-v2";
import { buildInterviewReportMarkdown, interviewReportFileName } from "../../lib/interview-report-export";
import {
  downloadInterviewReportPdf,
  downloadInterviewReportWord,
} from "../../lib/interview-report-download";
import type { VoiceCaptureStats } from "../../lib/wav-audio";
import { createResumeUploadId, splitResumeBase64 } from "../../lib/resume-upload";
import {
  canUseLocalResumeOcr,
  extractResumeTextWithOcr,
  isResumeImage,
} from "../../lib/client-resume-ocr";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

gsap.registerPlugin(useGSAP);

/* ── 类型 ── */
type SetupStep = "resume" | "job" | "plan" | "ready";
type PageMode = "setup" | "active" | "report";
type PlanMode = "local" | "ai";
type Connection = { status: "idle" | "testing" | "connected" | "error"; message: string; latencyMs?: number };
type CareerApplication = { id: string; title: string; company: string; status: string };
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
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    dependencies: [pageMode, setupStep, conversationLog.length, index, report?.calculatedAt],
    revertOnUpdate: true,
  });

  /* ── 计时器 ── */
  useEffect(() => {
    if (pageMode !== "active") return;
    const t = setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [pageMode, index]);

  useEffect(() => {
    if (pageMode !== "active" || callPaused) return;
    const timer = setInterval(() => setCallSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [callPaused, pageMode]);

  useEffect(() => {
    callPausedRef.current = callPaused;
  }, [callPaused]);

  useEffect(() => {
    setBrowserSpeechReady(supportsBrowserSpeechRecognition());
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  /* ── 加载历史 & 投递记录 ── */
  useEffect(() => {
    apiFetch("/api/interview").then(r => r.json()).then(b => setHistory(b.sessions ?? [])).catch(() => {});
    apiFetch("/api/career/applications").then(r => r.ok ? r.json() : null)
      .then(b => { if (b?.applications) setCareerApplications(b.applications); }).catch(() => {});
  }, []);

  const format = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  const providerInfo = INTERVIEW_MODEL_PROVIDERS[provider];

  /* ── 模型连接测试 ── */
  const testConnection = async () => {
    if (!apiKey.trim()) return showToast("请先填写 API Key");
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
      const parseOcrText = async () => {
        const text = await extractResumeTextWithOcr(file, progress => {
          setResumeUploadProgress(progress.progress);
        });
        const response = await apiFetch("/api/interview/resume/parse-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, source: `本地OCR:${file.name}` }),
        });
        const body: { error?: string; resume?: ResumeStructured } = await response.json().catch(() => ({}));
        if (!response.ok || !body.resume) {
          throw new Error(body.error || "OCR文字结构化失败，请确认简历内容清晰完整");
        }
        return body.resume;
      };

      if (isResumeImage(file.name)) {
        setResumeParsed(await parseOcrText());
        showToast("图片 OCR 识别成功，请确认简历字段");
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const base64Data = result.includes(",") ? result.split(",").pop() || "" : result;
          resolve(base64Data);
        };
        reader.onerror = () => {
          const err = reader.error;
          reject(new Error(`文件读取失败：${err?.message || "未知错误"}。请尝试用TXT格式保存简历后重新上传。`));
        };
        reader.readAsDataURL(file);
      });
      const chunks = splitResumeBase64(base64);
      const uploadId = createResumeUploadId();
      for (let index = 0; index < chunks.length; index += 1) {
        const chunkResponse = await apiFetch("/api/interview/resume/chunk", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, index, total: chunks.length, data: chunks[index] }),
        });
        const chunkBody: { error?: string } = await chunkResponse.json().catch(() => ({}));
        if (!chunkResponse.ok) {
          throw new Error(chunkBody.error || `简历上传中断(${chunkResponse.status})，请检查网络后重试`);
        }
        setResumeUploadProgress(Math.round(((index + 1) / chunks.length) * 95));
      }
      setResumeUploadProgress(100);
      const r = await apiFetch("/api/interview/resume/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type, uploadId, total: chunks.length }),
      });
      const b: { error?: string; resume?: ResumeStructured } = await r.json().catch(() => ({}));
      if (!r.ok) {
        const serverMessage = b.error || `服务器返回错误(${r.status})，请确认简历格式正确`;
        const shouldTryOcr = canUseLocalResumeOcr(file.name)
          && /OCR|扫描|没有提取|文字提取失败|文字过少/.test(serverMessage);
        if (!shouldTryOcr) throw new Error(serverMessage);
        setResumeUploadProgress(1);
        setResumeParsed(await parseOcrText());
        showToast("扫描版 PDF 已通过本地 OCR 识别");
        return;
      }
      if (!b.resume) throw new Error("服务器未返回有效的简历内容");
      setResumeParsed(b.resume);
      showToast("简历解析成功，请确认识别结果");
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : "简历解析失败");
    } finally {
      setResumeUploading(false);
      setResumeUploadProgress(0);
      setInterviewerState("idle");
    }
  };

  /* ── 岗位解析 ── */
  const parseJob = async () => {
    setJobError("");
    setInterviewerState("thinking");
    try {
      const r = await apiFetch("/api/interview/job/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: manualJobTitle, description: manualJobDesc, company: manualJobCompany, applicationId: jobSource === "saved" ? applicationId : undefined }),
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
        body: JSON.stringify({ provider, model: modelName, apiKey, resume: resumeParsed, job: jobParsed, applicationId: jobSource === "saved" ? applicationId : undefined }),
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
    setTimeout(() => speakQuestion(openingQuestion), 450);
  };

  const beginListeningTurn = () => {
    if (callPausedRef.current) return;
    if (!supportsBrowserSpeechRecognition()) {
      setBrowserSpeechReady(false);
      setLiveListening(false);
      setUseTextFallback(true);
      setAsrError("当前浏览器不支持免费实时识别，请使用桌面版 Chrome，或改用文字回答。");
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
    setLiveListening(true);
    setInterviewerState("listening");
  };

  /* ── 免费浏览器语音合成；朗读结束后自动进入倾听 ── */
  const speakQuestion = (text: string, addToLog = true) => {
    if (!text) return;
    setLiveListening(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setInterviewerState("speaking");
    setTtsSource("browser");
    if (addToLog) setConversationLog(log => [...log, { speaker: "interviewer", text }]);
    fallbackTTS(text, beginListeningTurn);
  };

  const fallbackTTS = (text: string, onDone?: () => void) => {
    if (!("speechSynthesis" in window)) {
      setInterviewerState("idle");
      onDone?.();
      return;
    }
    setTtsSource("browser");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.92;
    u.pitch = 1.08;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(voice => /^zh(-|_)/i.test(voice.lang) && /Ting|Mei|Xiaoxiao|female|女/i.test(voice.name))
      ?? voices.find(voice => /^zh(-|_)/i.test(voice.lang));
    if (preferred) u.voice = preferred;
    u.onend = () => {
      setInterviewerState("idle");
      onDone?.();
    };
    u.onerror = () => {
      setInterviewerState("idle");
      onDone?.();
    };
    window.speechSynthesis.speak(u);
  };

  const completeInterview = async (finalAnswers: ScoredAnswer[], announce = true) => {
    if (finalAnswers.length === 0) {
      showToast("至少完成一轮回答后才能生成面试报告");
      return;
    }

    setLiveListening(false);
    setCallPaused(true);
    callPausedRef.current = true;
    setSaving(true);
    setInterviewerState("scoring");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (announce) {
      fallbackTTS("好的，谢谢你的回答。今天的交流就到这里，我正在为你整理一份具体的面试反馈。");
    }

    const rpt = generateReportV2(finalAnswers);
    setReport(rpt);
    setPendingReport(null);
    setPageMode("report");
    setApiKey("");
    setConnection({ status: "idle", message: "面试结束，API Key 已清除" });

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
          applicationId: jobSource === "saved" ? applicationId : undefined,
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

  const finishCurrentInterview = () => {
    if (saving) return;
    if (answers.length === 0) {
      showToast("至少完成一轮回答后才能结束并生成报告");
      return;
    }
    if (!confirm(`确定结束本次面试并根据已完成的 ${answers.length} 轮回答生成报告吗？`)) return;
    void completeInterview(answers);
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

  /* ── 提交回答 ── */
  const submitAnswer = async (
    answerOverride?: string,
    durationOverrideMs?: number,
    captureStatsOverride?: VoiceCaptureStats,
  ) => {
    const finalAnswer = answerOverride?.trim() || (useTextFallback ? textAnswer.trim() : transcribedText.trim());
    if (finalAnswer.length < 8) return showToast("请先输入至少 8 个字的回答");

    setLiveListening(false);
    setSaving(true);
    setInterviewerState("thinking");
    setConversationLog(log => [...log, { speaker: "candidate", text: finalAnswer }]);
    const answerDurationMs = durationOverrideMs
      ?? Math.max(1, seconds * 1000);
    const captureStats = captureStatsOverride ?? null;
    const answerSeconds = Math.max(1, Math.round(answerDurationMs / 1000));

    // 计算语音指标
    let speechMetrics: SpeechMetrics | null = null;
    if (captureStats) {
      try {
        const r = await apiFetch("/api/interview/speech-metrics", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: finalAnswer,
            totalDurationMs: answerDurationMs,
            captureStats,
          }),
        });
        if (r.ok) {
          const b = await r.json();
          speechMetrics = b.metrics;
        }
      } catch {}
    }

    // 调用模型分析
    let modelInsight: InterviewModelAnalysis | null = null;
    let nextQuestion = "";
    if (modelAvailable) {
      try {
        const history = answers.map(a => ({ question: a.question, answer: a.answer, seconds: a.seconds }));
        const r = await apiFetch("/api/interview/model", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "turn",
            provider, model: modelName, apiKey,
            role: jobParsed?.title ?? "通用能力",
            difficulty: jobParsed?.difficulty === "advanced" ? "进阶" : jobParsed?.difficulty === "entry" ? "入门" : "标准",
            history: [...history, { question: currentQuestion, answer: finalAnswer, seconds: answerSeconds }],
            applicationId: jobSource === "saved" ? applicationId : undefined,
          }),
        });
        const b = await r.json();
        if (r.ok) {
          modelInsight = b.analysis ?? null;
          nextQuestion = b.question ?? "";
        }
      } catch { setModelAvailable(false); }
    }

    // 评分
    const { scoreAnswerV2 } = await import("../../lib/scoring-v2");
    const jobSkills = jobParsed?.skills ?? [];
    const scored = scoreAnswerV2(currentQuestion, finalAnswer, answerSeconds, jobSkills, speechMetrics);
    if (modelInsight) {
      // 把模型分析附加到评分上
      scored.evidence = {
        ...scored.evidence,
        highlight: modelInsight.strengths?.[0] ?? scored.evidence.highlight,
        gap: modelInsight.gaps?.[0] ?? scored.evidence.gap,
        originalQuote: modelInsight.evidence?.[0] ?? scored.evidence.originalQuote,
      };
    }

    const newAnswers = [...answers, scored];
    setAnswers(newAnswers);
    setTextAnswer("");
    setTranscribedText("");
    setUseTextFallback(false);
    setSeconds(0);

    const questions = interviewPlan?.questions ?? [];
    const hasCoveredCoreFlow = newAnswers.length >= Math.min(5, Math.max(1, questions.length));
    const reachedTimeTarget = callSeconds >= INTERVIEW_DURATION_SECONDS - 45 && hasCoveredCoreFlow;
    const reachedTurnLimit = newAnswers.length >= (modelAvailable
      ? MAX_CONVERSATION_TURNS
      : Math.max(1, questions.length));

    if (!reachedTimeTarget && !reachedTurnLimit) {
      const nextIdx = index + 1;
      const nextQ = nextQuestion
        || questions[nextIdx]?.label
        || "谢谢你的说明。最后想请你谈谈，如果入职后遇到一个目前还不熟悉的任务，你会怎样快速补齐能力并推进交付？";
      setCurrentQuestion(nextQ);
      setIndex(nextIdx);
      setSaving(false);
      setInterviewerState("speaking");
      setTimeout(() => speakQuestion(nextQ), 300);
    } else {
      await completeInterview(newAnswers);
    }
  };

  const handleLiveTurnComplete = (text: string, durationMs: number, stats: VoiceCaptureStats) => {
    setLiveListening(false);
    setLiveTranscript(text);
    setTranscribedText(text);
    setAsrError("");
    setUseTextFallback(false);
    if (text.trim().length < 8) {
      showToast("这段回答有些短，请再补充一点具体信息");
      setTimeout(() => beginListeningTurn(), 500);
      return;
    }
    void submitAnswer(text, durationMs, stats);
  };

  const handleLiveSpeechError = (message: string) => {
    setLiveListening(false);
    setAsrError(message);
    setUseTextFallback(true);
    setInterviewerState("idle");
    showToast(message, 5000);
  };

  const toggleCallPause = () => {
    if (callPaused) {
      callPausedRef.current = false;
      setCallPaused(false);
      setAsrError("");
      setUseTextFallback(false);
      setTimeout(() => speakQuestion(currentQuestion, false), 120);
      return;
    }
    callPausedRef.current = true;
    setCallPaused(true);
    setLiveListening(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPageMode("setup");
    setSetupStep("resume");
    setResumeFile(null); setResumeParsed(null); setResumeError("");
    setJobParsed(null); setJobError("");
    setInterviewPlan(null);
    setAnswers([]); setTextAnswer(""); setSeconds(0);
    setReport(null); setPendingReport(null);
    setApiKey(""); setConnection({ status: "idle", message: "API Key 已清除" });
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
              <div><b>生成谈话提纲</b><small>免费本地规则，或选择外部模型增强追问</small></div>
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
                  <button className={planMode === "local" ? "active" : ""} onClick={() => { setPlanMode("local"); setInterviewPlan(null); setModelAvailable(false); }}>免费本地模式（推荐）</button>
                  <button className={planMode === "ai" ? "active" : ""} onClick={() => { setPlanMode("ai"); setInterviewPlan(null); }}>外部 AI 增强</button>
                </div>

                {/* 模型连接 */}
                {planMode === "local" ? (
                  <div className="no-job-note" style={{ marginBottom: 16 }}>
                    <p>不需要安装软件、不需要 API Key。系统会根据简历和岗位生成连贯提纲，使用 Chrome 免费语音识别与浏览器朗读；回答文字和评分仍可正常保存。</p>
                  </div>
                ) : <div className="model-connect-panel">
                  <div className="model-provider-tabs">
                    {(Object.keys(INTERVIEW_MODEL_PROVIDERS) as InterviewModelProvider[]).map(p => (
                      <button key={p} className={provider === p ? "active" : ""} onClick={() => { setProvider(p); setModelName(INTERVIEW_MODEL_PROVIDERS[p].defaultModel); setUseCustomModel(false); setApiKey(""); setConnection({ status: "idle", message: "请输入 API Key" }); }}>
                        <b>{INTERVIEW_MODEL_PROVIDERS[p].label}</b>
                        <small>{INTERVIEW_MODEL_PROVIDERS[p].description}</small>
                      </button>
                    ))}
                  </div>
                  <div className="model-credentials">
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
                    <label><span>API Key</span><input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); if (connection.status !== "idle") setConnection({ status: "idle", message: "请重新测试连接" }); }} placeholder="仅保留在当前页面内存" /></label>
                  </div>
                  <label style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, marginBottom: 12 }}>
                    <input type="checkbox" checked={privacyAccepted} onChange={e => { setPrivacyAccepted(e.target.checked); if (!e.target.checked) setConnection({ status: "idle", message: "请确认数据传输说明" }); }} />
                    <span style={{ fontSize: 9, color: "var(--ink-dim)" }}>我了解面试文本会发送给所选模型服务商。密钥不会保存。</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 9, color: connection.status === "connected" ? "var(--green)" : "var(--ink-dim)", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: connection.status === "connected" ? "var(--green)" : "var(--muted)", display: "inline-block" }} />{connection.message}{connection.latencyMs ? ` · ${connection.latencyMs}ms` : ""}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <a href={providerConsoles[provider]} target="_blank" rel="noreferrer" style={{ fontSize: 8, color: "var(--ink-dim)", padding: "7px 9px", borderRadius: 6 }}>控制台</a>
                      <button onClick={testConnection} disabled={connection.status === "testing"} style={{ fontSize: 8, padding: "7px 9px", borderRadius: 6, background: "var(--accent)", color: "white", border: "none" }}>{connection.status === "testing" ? "测试中..." : "测试连接"}</button>
                    </div>
                  </div>
                </div>}

                {/* 生成计划 */}
                {!interviewPlan ? (
                  <button className="btn-primary" onClick={planMode === "local" ? generateLocalPlan : generatePlan} disabled={planMode === "ai" && (planGenerating || connection.status !== "connected")} style={{ width: "100%" }}>
                    {planMode === "local" ? "免费生成面试计划" : planGenerating ? "AI 正在生成面试计划..." : "生成 AI 面试计划"}
                  </button>
                ) : (
                  <div className="plan-preview">
                    <h3>15 分钟谈话提纲（面试官会根据回答自然追问）</h3>
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
            <VirtualInterviewer state={interviewerState} />
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
      <div ref={studioRef} className="interview-studio-root interview-studio-root--active">
      <PortalFrame active="interview" eyebrow={`${jobParsed?.title ?? "通用能力"} INTERVIEW`}
        title="与liuli老师的实时模拟面试"
        subtitle="约 15 分钟连续对话 · Chrome 免费实时识别 · 原始录音不保存"
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
            <VirtualInterviewer state={interviewerState} audioLevel={audioLevel} ttsSource={ttsSource} />
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
                  <i />{browserSpeechReady ? "Chrome 实时识别" : "等待语音能力"}
                </span>
                <span className={modelAvailable ? "ready" : "warning"}>
                  <i />{modelAvailable ? "动态追问" : "内置流程"}
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
                  liuli老师正在根据你的回答继续交流
                </div>
              )}
            </div>

            <div className="live-turn-console" data-live-console>
              <ContinuousSpeechRecognition
                active={liveListening && !callPaused && !useTextFallback}
                turnKey={liveTurnKey}
                disabled={saving || interviewerState === "speaking"}
                maxDurationMs={90_000}
                silenceMs={5_000}
                onInterimChange={setLiveTranscript}
                onAudioLevel={setAudioLevel}
                onStatusChange={setLiveSpeechStatus}
                onComplete={handleLiveTurnComplete}
                onError={handleLiveSpeechError}
              />

              {callPaused && (
                <div className="live-paused-note">
                  <b>通话已暂停</b>
                  <span>点击页面右上角“继续通话”，liuli老师会从当前问题继续。</span>
                </div>
              )}

              {(useTextFallback || asrError) && !callPaused && (
                <div className="live-text-fallback">
                  <div>
                    <b>语音识别暂时不可用</b>
                    <span>{asrError || "请使用桌面版 Chrome，或先用文字完成这一轮。"}</span>
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
                    <button className="btn-primary" onClick={() => void submitAnswer()} disabled={saving || textAnswer.trim().length < 8}>
                      {saving ? "正在继续面试…" : "发送回答"}
                    </button>
                  </footer>
                </div>
              )}

              {!callPaused && interviewerState === "speaking" && (
                <button className="live-replay-question" onClick={() => speakQuestion(currentQuestion, false)}>
                  没听清？重新播放
                </button>
              )}

              {pendingReport && (
                <button className="btn-primary" onClick={retrySave} disabled={saving}>
                  {saving ? "保存中…" : "重试保存报告"}
                </button>
              )}

              <div className="live-console-footnote">
                <span>{liveSpeechStatus === "hearing" ? "正在接收你的回答" : "连续静默约 5 秒才会提交，也可点击“我说完了”"}</span>
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
              <h2>思考停顿与口头语已纳入语言表达评分</h2>
              <p>{report.expressionSummary.observation}</p>
            </div>
            <dl>
              <div><dt>平均语速</dt><dd>{report.expressionSummary.averageWordsPerMinute}<small>字/分</small></dd></div>
              <div><dt>平均停顿</dt><dd>{report.expressionSummary.averagePauseRatio}<small>%</small></dd></div>
              <div><dt>开口前思考</dt><dd>{report.expressionSummary.averageThinkingSeconds}<small>秒</small></dd></div>
              <div><dt>口头语密度</dt><dd>{report.expressionSummary.fillerWordsPerMinute}<small>次/分</small></dd></div>
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
            <span style={{ fontSize: 9, color: "var(--green)", background: "var(--green-soft)", padding: "4px 8px", borderRadius: 5 }}>{report.engineVersion} 规则引擎</span>
            <h2>{report.overallScore >= 80 ? "表现优秀，继续保持" : report.overallScore >= 60 ? "基础扎实，持续改进" : "建议加强练习"}</h2>
            <p style={{ fontSize: 10, color: "var(--ink-dim)" }}>共 {report.scoredAnswers.length} 道回答。{report.trendNote}</p>
          </div>
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

          <p className="report-disclaimer">本报告用于模拟练习反馈，不代表真实招聘结果。外部 AI 只负责提问和提取证据，最终分数由 XH-SCORE 规则引擎计算。</p>
        </div>
        {toast && <div className="portal-toast" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--surface-elevated)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 20px", fontSize: 11, zIndex: 100 }}>{toast}</div>}
      </PortalFrame>
      </div>
    );
  }

  // 加载中
  return <PortalFrame active="interview" eyebrow="" title="加载中..." subtitle=""><p>Loading...</p></PortalFrame>;
}
