"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { api, copy, download, supabase } from "@/lib/client";
import { anglesText, csvExport, jsonExport } from "@/lib/exports";
import type { Project, Stage } from "@/lib/analysis/schema";
import { Importer } from "./importer";
import { Results, sectionNames, sections, type Section } from "./results";
import { Empty, Modal, Spinner } from "./ui";
import { localizeError } from "@/lib/language";
export function Workspace({ demo, ready }: { demo: boolean; ready: boolean }) {
  const [ar, setAr] = useState(false);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [signed, setSigned] = useState(demo);
  const [authReady, setAuthReady] = useState(demo || !ready);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<"new" | "history" | "results">("new");
  const [section, setSection] = useState<Section>("overview");
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const lang = localStorage.getItem("reviewangle-ui");
    if (lang === "ar") setAr(true);
  }, []);
  useEffect(() => {
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.lang = ar ? "ar" : "en";
    localStorage.setItem("reviewangle-ui", ar ? "ar" : "en");
  }, [ar]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, section]);
  useEffect(() => {
    if (!supabase || demo) return;
    supabase.auth.getSession().then(({ data }) => {
      setSigned(!!data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSigned(!!session);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [demo]);
  useEffect(() => {
    if (!signed) return;
    api<{ projects: Project[] }>("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e.message));
  }, [signed]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);
  function update(p: Project) {
    setProject(p);
    setProjects((old) => [p, ...old.filter((v) => v.id !== p.id)]);
  }
  async function run(p: Project) {
    setBusy(true);
    setError("");
    setView("results");
    update(p);
    try {
      let current = p;
      while (current.run.stage !== "complete") {
        const result = await api<{ project: Project }>(
          `/api/projects/${current.id}/step`,
          {},
        );
        current = result.project;
        update(current);
        if (current.run.stage === "failed") break;
      }
      setSection("overview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    if (!supabase) return;
    setAuthBusy(true);
    setError("");
    try {
      if (sent) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email",
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setSent(true);
      }
    } catch {
      setError(
        t(
          "Sign-in could not be completed. Check your email or code and try again.",
          "تعذّر تسجيل الدخول. تحقّق من البريد أو الرمز وأعد المحاولة.",
        ),
      );
    } finally {
      setAuthBusy(false);
    }
  }
  async function exportAll(kind: "copy" | "csv" | "json") {
    if (!project) return;
    try {
      if (kind === "copy") {
        await copy(anglesText(project));
        setNotice(t("All angles copied", "تم نسخ جميع الزوايا"));
      } else
        download(
          kind === "csv" ? csvExport(project) : jsonExport(project),
          `reviewangle-${project.id}.${kind}`,
          kind === "csv" ? "text/csv;charset=utf-8" : "application/json",
        );
    } catch {
      setError(
        t(
          "Could not export. Try downloading JSON instead.",
          "تعذّر التصدير. جرّب تنزيل JSON.",
        ),
      );
    }
  }
  const stageText: Record<Stage, string> = {
    ready: t("Preparing reviews", "تجهيز المراجعات"),
    extracting: t("Extracting customer insights", "استخراج رؤى العملاء"),
    themes: t("Finding repeated themes", "اكتشاف المحاور المتكررة"),
    intelligence: t("Building customer personas", "بناء شرائح العملاء"),
    angles: t("Creating evidence-backed angles", "إنشاء زوايا مدعومة بالأدلة"),
    complete: t("Analysis complete", "اكتمل التحليل"),
    failed: t(
      "This step needs another try",
      "هذه الخطوة تحتاج إلى إعادة المحاولة",
    ),
  };
  const title =
    view === "new"
      ? t(
          "Turn customer words into your next angle.",
          "حوّل كلمات العملاء إلى زاويتك الإعلانية القادمة.",
        )
      : view === "history"
        ? t("Your research, all in one place.", "كل أبحاثك في مكان واحد.")
        : sectionNames[section][ar ? 1 : 0];
  return (
    <div className="app-shell" dir={ar ? "rtl" : "ltr"}>
      <aside className={`sidebar ${menu ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            r<span>↗</span>
          </div>
          <span>
            ReviewAngle<span className="brand-ai">AI</span>
          </span>
          <button
            className="icon-button mobile-close"
            aria-label={t("Close navigation", "إغلاق القائمة")}
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="avatar">
            {demo ? "D" : email ? email[0].toUpperCase() : "R"}
          </span>
          <div>
            <strong>{t("Research workspace", "مساحة الأبحاث")}</strong>
            <small>
              {demo
                ? t("Synthetic demo", "عرض تجريبي")
                : t("Free plan", "الخطة المجانية")}
            </small>
          </div>
        </div>
        <button
          className={`nav-item ${view === "history" ? "active" : ""}`}
          onClick={() => {
            setView("history");
            setMenu(false);
          }}
          disabled={busy}
        >
          <FolderOpen size={18} />
          {t("All projects", "كل المشاريع")}
          <span className="nav-count">{projects.length}</span>
        </button>
        <div className="nav-label">
          {t("ANALYSIS WORKSPACE", "مساحة التحليل")}
        </div>
        <nav aria-label={t("Analysis sections", "أقسام التحليل")}>
          {sections.map((s, i) => (
            <button
              key={s}
              className={`nav-item ${view === "results" && section === s ? "active" : ""}`}
              disabled={!project || project.run.stage !== "complete" || busy}
              onClick={() => {
                setView("results");
                setSection(s);
                setMenu(false);
              }}
            >
              {i === 0 ? (
                <LayoutDashboard size={18} />
              ) : i === 6 ? (
                <Sparkles size={18} />
              ) : (
                <span className="nav-dot" />
              )}
              {sectionNames[s][ar ? 1 : 0]}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={21} />
            <strong>{t("Built around evidence", "مبني على الأدلة")}</strong>
            <p>
              {t(
                "Every idea has a source. Every source stays within reach.",
                "لكل فكرة مصدر. وكل مصدر متاح للمراجعة.",
              )}
            </p>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            {t("How it works", "كيف يعمل")}
          </button>
          {signed && !demo && (
            <button
              className="nav-item"
              onClick={async () => {
                await supabase?.auth.signOut();
                setProject(null);
                setProjects([]);
              }}
            >
              <LogOut size={17} />
              {t("Sign out", "تسجيل الخروج")}
            </button>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label={t("Open navigation", "فتح القائمة")}
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>{t("Workspace", "مساحة العمل")}</span>
            <span>/</span>
            <strong>
              {view === "results"
                ? project?.name
                : t("Customer intelligence", "رؤى العملاء")}
            </strong>
          </div>
          <div className="top-actions">
            <button className="language-toggle" onClick={() => setAr(!ar)}>
              <Globe2 size={17} />
              {ar ? "English" : "العربية"}
            </button>
            <span className="user-avatar">RA</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "new"
                  ? t(
                      "FROM REVIEWS TO RELEVANCE",
                      "من المراجعات إلى رسائل مؤثرة",
                    )
                  : view === "history"
                    ? t("PROJECT LIBRARY", "مكتبة المشاريع")
                    : project?.name}
              </span>
              <h1>{title}</h1>
              <p>
                {view === "new"
                  ? t(
                      "Find the pains, benefits and messages your customers actually care about.",
                      "اكتشف المشكلات والفوائد والرسائل التي تهم عملاءك فعلاً.",
                    )
                  : view === "history"
                    ? t(
                        "Reopen an analysis and pick up where you left off.",
                        "افتح تحليلاً سابقاً وأكمل من حيث توقفت.",
                      )
                    : t(
                        "Trace every insight back to the customer reviews behind it.",
                        "تتبّع كل نتيجة وصولاً إلى مراجعات العملاء التي تدعمها.",
                      )}
              </p>
            </div>
            <div className="page-actions">
              {view === "results" && project?.run.stage === "complete" && (
                <details className="export-menu">
                  <summary className="button">
                    <Download size={16} />
                    {t("Export", "تصدير")}
                    <ChevronDown size={14} />
                  </summary>
                  <div>
                    <button onClick={() => void exportAll("copy")}>
                      {t("Copy all angles", "نسخ كل الزوايا")}
                    </button>
                    <button onClick={() => void exportAll("csv")}>
                      {t("Download CSV", "تنزيل CSV")}
                    </button>
                    <button onClick={() => void exportAll("json")}>
                      {t("Download JSON + evidence", "تنزيل JSON مع الأدلة")}
                    </button>
                  </div>
                </details>
              )}
              {view !== "new" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    setView("new");
                    setError("");
                  }}
                >
                  <Plus size={17} />
                  {t("New project", "مشروع جديد")}
                </button>
              )}
            </div>
          </div>
          {(demo || (project?.demo && view === "results")) && (
            <div className="demo-banner">
              <span className="demo-dot" />
              {t("SYNTHETIC DEMO", "بيانات صناعية تجريبية")}
              <span>
                {demo
                  ? t(
                      "Fictional reviews · deterministic fixture analysis · local storage only",
                      "مراجعات خيالية · تحليل بقواعد تجريبية · تخزين محلي فقط",
                    )
                  : t(
                      "This project contains fictional fixture reviews.",
                      "هذا المشروع يحتوي على مراجعات تجريبية خيالية.",
                    )}
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>
                  {t("We couldn’t complete that action", "تعذّر إكمال الإجراء")}
                </strong>
                <p dir="auto">{localizeError(error, ar)}</p>
                {ar && (
                  <small>
                    يمكنك إعادة المحاولة أو العودة إلى اللصق أو رفع ملف CSV.
                    بيانات المشروع المحفوظة متاحة في «كل المشاريع».
                  </small>
                )}
              </div>
              <button
                className="icon-button"
                aria-label={t("Dismiss error", "إغلاق التنبيه")}
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {!authReady ? (
            <div className="loading-state">
              <Spinner />
              {t("Loading workspace…", "جارٍ تحميل مساحة العمل…")}
            </div>
          ) : !signed ? (
            <section className="panel auth-panel">
              <ShieldCheck size={30} />
              <h2>
                {t(
                  "Your customer research deserves a home.",
                  "أبحاث عملائك تستحق مساحة خاصة.",
                )}
              </h2>
              <p>
                {t(
                  "Sign in with your email to save projects and analyze reviews.",
                  "سجّل ببريدك الإلكتروني لحفظ المشاريع وتحليل المراجعات.",
                )}
              </p>
              {ready ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void signIn();
                  }}
                >
                  <label>
                    {t("Email address", "البريد الإلكتروني")}
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      dir="ltr"
                      disabled={sent}
                    />
                  </label>
                  {sent && (
                    <>
                      <p className="notice">
                        {t(
                          "Check your email for a sign-in link or enter the one-time code below.",
                          "افتح رابط الدخول في بريدك أو أدخل رمز الاستخدام لمرة واحدة أدناه.",
                        )}
                      </p>
                      <label>
                        {t("One-time code", "رمز الدخول")}
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          minLength={6}
                          maxLength={8}
                        />
                      </label>
                    </>
                  )}
                  <button className="button primary" disabled={authBusy}>
                    {authBusy ? <Spinner /> : <ArrowRight size={17} />}{" "}
                    {sent
                      ? t("Verify code", "تأكيد الرمز")
                      : t("Send sign-in email", "إرسال بريد تسجيل الدخول")}
                  </button>
                  {sent && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setSent(false);
                        setCode("");
                      }}
                    >
                      {t(
                        "Use another email / resend",
                        "بريد آخر / إعادة الإرسال",
                      )}
                    </button>
                  )}
                </form>
              ) : (
                <div className="notice">
                  {t(
                    "Service setup is needed. Add Supabase and OpenAI credentials to .env.local, or enable local synthetic demo mode using the README.",
                    "يلزم إعداد الخدمة. أضف بيانات Supabase وOpenAI في ملف البيئة، أو فعّل العرض التجريبي المحلي كما هو موضح في README.",
                  )}
                </div>
              )}
            </section>
          ) : (
            <>
              {view === "new" && (
                <Importer
                  ar={ar}
                  demo={demo}
                  onError={setError}
                  onCreated={(p) => void run(p)}
                />
              )}
              {view === "history" &&
                (projects.length ? (
                  <div className="project-grid">
                    {projects.map((p) => (
                      <button
                        className="panel project-card"
                        key={p.id}
                        onClick={() => {
                          setProject(p);
                          setView("results");
                          setSection("overview");
                        }}
                      >
                        <span className="project-symbol">
                          <FolderOpen size={23} />
                        </span>
                        <div>
                          <h2>{p.name}</h2>
                          <p>
                            {p.reviews.length} {t("reviews", "مراجعات")} ·{" "}
                            {p.angles.length} {t("angles", "زوايا")}
                          </p>
                        </div>
                        <span
                          className={`badge ${p.run.stage === "complete" ? "complete" : ""}`}
                        >
                          {stageText[p.run.stage]}
                        </span>
                        <div className="project-date">
                          <Clock3 size={14} />
                          {new Date(p.updatedAt).toLocaleDateString(
                            ar ? "ar-EG" : "en-US",
                          )}
                          {p.demo && (
                            <span>{t("Synthetic", "بيانات تجريبية")}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={t(
                      "Your first insight starts here",
                      "نتيجتك الأولى تبدأ هنا",
                    )}
                    description={t(
                      "Create a project from reviews, or try the labeled synthetic examples.",
                      "أنشئ مشروعاً من المراجعات أو جرّب الأمثلة الصناعية المعلّمة بوضوح.",
                    )}
                  >
                    <button
                      className="button primary"
                      onClick={() => setView("new")}
                    >
                      <Plus size={17} />
                      {t("Add reviews", "إضافة مراجعات")}
                    </button>
                  </Empty>
                ))}
              {view === "results" &&
                project &&
                (project.run.stage === "complete" ? (
                  <Results
                    key={project.id}
                    project={project}
                    section={section}
                    ar={ar}
                    onUpdate={update}
                    onError={setError}
                    onNotice={setNotice}
                  />
                ) : (
                  <section className="panel progress-panel">
                    <div className="progress-symbol">
                      {busy ? <Spinner /> : <ShieldCheck size={30} />}
                    </div>
                    <h2 aria-live="polite">{stageText[project.run.stage]}</h2>
                    <p>
                      {project.run.processed} / {project.reviews.length}{" "}
                      {t("reviews extracted", "مراجعات تم استخراجها")}
                    </p>
                    <ol className="progress-steps">
                      {(
                        [
                          "ready",
                          "extracting",
                          "themes",
                          "intelligence",
                          "angles",
                        ] as Stage[]
                      ).map((s, i) => (
                        <li
                          className={s === project.run.stage ? "current" : ""}
                          key={s}
                        >
                          <span>{i + 1}</span>
                          {stageText[s]}
                        </li>
                      ))}
                    </ol>
                    {project.run.error && (
                      <p role="alert" className="error-text">
                        {localizeError(project.run.error, ar)}
                      </p>
                    )}
                    <p className="hint">
                      {t(
                        "Progress is saved after each step. If you leave, reopen this project and resume.",
                        "يُحفظ التقدم بعد كل خطوة. إذا غادرت، افتح المشروع وأكمل التحليل.",
                      )}
                    </p>
                    {!busy && (
                      <button
                        className="button primary"
                        onClick={() => void run(project)}
                      >
                        {t("Resume analysis", "متابعة التحليل")}
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </section>
                ))}
            </>
          )}
          <footer className="page-footer">
            <span>ReviewAngle AI</span>
            <span>
              <ShieldCheck size={14} />
              {t(
                "Customer evidence, kept in context.",
                "أدلة العملاء، في سياقها الصحيح.",
              )}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        ar={ar}
        title={t(
          "From reviews to evidence-backed ideas",
          "من المراجعات إلى أفكار تدعمها الأدلة",
        )}
      >
        <div className="help-content">
          <p>
            {t(
              "1. Paste reviews or upload CSV/TXT, then preview and map columns.",
              "١. الصق المراجعات أو ارفع CSV/TXT، ثم عاين البيانات وحدّد الأعمدة.",
            )}
          </p>
          <p>
            {t(
              "2. Choose the marketing language. Arabic options adapt the copy to the selected dialect.",
              "٢. اختر لغة التسويق. خيارات العربية توطّن المحتوى حسب اللهجة المختارة.",
            )}
          </p>
          <p>
            {t(
              "3. Analyze in saved stages. Counts exclude duplicates and failed reviews.",
              "٣. حلّل في مراحل محفوظة. الأعداد تستبعد التكرار والمراجعات التي تعذّر تحليلها.",
            )}
          </p>
          <p>
            {t(
              "4. Explore insights, inspect original evidence, save angles and generate grounded follow-ups.",
              "٤. استكشف النتائج وراجع الأدلة الأصلية واحفظ الزوايا وولّد محتوى إضافياً مدعوماً.",
            )}
          </p>
          <p>
            {t(
              "5. Export angles as CSV or the complete evidence-linked project as JSON.",
              "٥. صدّر الزوايا بصيغة CSV أو المشروع الكامل مع الأدلة بصيغة JSON.",
            )}
          </p>
          <div className="notice">
            {t(
              "An Evidence Score describes support within this sample. It is not a forecast of conversions, revenue or advertising performance. Small samples receive capped scores.",
              "درجة الأدلة تصف الدعم داخل هذه العينة. لا تتنبأ بالتحويلات أو الإيرادات أو أداء الإعلان. درجات العينات الصغيرة لها سقف.",
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
