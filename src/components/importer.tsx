"use client";
import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  FileUp,
  Link2,
  AlignLeft,
  ArrowRight,
  FlaskConical,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/client";
import { fixtures } from "@/lib/fixtures";
import {
  mapColumns,
  parseCSV,
  parsePaste,
  prepareReviews,
  type RawReview,
} from "@/lib/ingestion";
import {
  languageName,
  outputLanguages,
  type OutputLanguage,
} from "@/lib/language";
import type { Project } from "@/lib/analysis/schema";
import { Spinner } from "./ui";
export function Importer({
  ar,
  onCreated,
  onError,
  demo,
}: {
  ar: boolean;
  onCreated: (p: Project) => void;
  onError: (s: string) => void;
  demo: boolean;
}) {
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>(ar ? "ar" : "en");
  const [tab, setTab] = useState("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<RawReview[]>([]);
  const [table, setTable] = useState<{
    columns: string[];
    rows: Record<string, string>[];
  } | null>(null);
  const [mapping, setMapping] = useState({
    text: "",
    rating: "",
    date: "",
    title: "",
  });
  const [source, setSource] = useState("CSV");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exclude, setExclude] = useState(true);
  const prepared = prepareReviews(rows);
  const near = prepared.reviews.filter((r) => r.nearDuplicateOf).length;
  const count = prepared.reviews.length - (exclude ? near : 0);
  function showPreview() {
    try {
      const next =
        tab === "paste"
          ? parsePaste(text)
          : table
            ? mapColumns(table.rows, mapping, source)
            : rows;
      if (!next.length)
        throw new Error(t("Add some reviews first.", "أضف مراجعات أولاً."));
      if (next.length > 200)
        throw new Error(
          t(
            "Split this input into batches of up to 200 reviews.",
            "قسّم البيانات إلى مجموعات لا تتجاوز ٢٠٠ مراجعة.",
          ),
        );
      setRows(next);
      setPreview(true);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function file(file?: File) {
    if (!file) return;
    setPreview(false);
    if (file.size > 2_000_000) {
      onError(
        t(
          "File exceeds 2 MB. Split it into smaller files.",
          "الملف أكبر من ٢ ميجابايت. قسّمه إلى ملفات أصغر.",
        ),
      );
      return;
    }
    try {
      const content = await file.text();
      setSource(file.name);
      if (file.name.toLowerCase().endsWith(".txt")) {
        setTable(null);
        setRows(parsePaste(content).map((r) => ({ ...r, source: file.name })));
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        const parsed = parseCSV(content);
        setTable(parsed);
        const find = (re: RegExp) =>
          parsed.columns.find((c) => re.test(c)) || "";
        setMapping({
          text: find(/review.?text|body|content|^text$|مراجعة|نص/i),
          rating: find(/rating|stars|تقييم/i),
          date: find(/date|تاريخ/i),
          title: find(/title|عنوان/i),
        });
      } else
        throw new Error(
          t(
            "Choose a CSV or TXT file. Export Excel files as CSV first.",
            "اختر ملف CSV أو TXT. صدّر ملفات إكسل بصيغة CSV أولاً.",
          ),
        );
    } catch (e) {
      onError((e as Error).message);
    }
  }
  async function loadURL() {
    setBusy(true);
    try {
      const result = await api<{ reviews: RawReview[]; truncated: boolean }>(
        "/api/import-url",
        { url },
      );
      setRows(result.reviews);
      setTable(null);
      setPreview(true);
      if (result.truncated)
        onError(
          t(
            "Only the first 200 reviews were imported.",
            "تم استيراد أول ٢٠٠ مراجعة فقط.",
          ),
        );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    setBusy(true);
    try {
      const { project } = await api<{ project: Project }>("/api/projects", {
        name: name.trim() || t("Untitled analysis", "تحليل جديد"),
        language,
        reviews: rows,
        excludeNearDuplicates: exclude,
      });
      onCreated(project);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function fixture(kind: "en" | "ar" | "mixed") {
    setRows(fixtures(kind));
    setTable(null);
    setName(
      t(
        "Daily Carry Bottle · Synthetic demo",
        "زجاجة الاستخدام اليومي · بيانات تجريبية",
      ),
    );
    setPreview(true);
  }
  return (
    <div className="import-layout">
      <section className="panel import-panel">
        <div className="panel-title">
          <span className="step-number">01</span>
          <div>
            <h2>
              {t("Start with your customers’ words", "ابدأ بكلمات عملائك")}
            </h2>
            <p>
              {t(
                "Add real reviews. We’ll keep every insight connected to its source.",
                "أضف مراجعات حقيقية. سنربط كل نتيجة بمصدرها.",
              )}
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            {t("Project name", "اسم المشروع")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "e.g. Summer skincare launch",
                "مثال: إطلاق منتجات العناية الصيفية",
              )}
              maxLength={100}
            />
          </label>
          <label>
            {t("Marketing output language", "لغة المحتوى التسويقي")}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as OutputLanguage)}
            >
              {outputLanguages.map((l) => (
                <option key={l} value={l}>
                  {languageName[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!preview ? (
          <>
            <Tabs.Root
              value={tab}
              onValueChange={(v) => {
                setTab(v);
                setRows([]);
                setTable(null);
              }}
            >
              <Tabs.List
                className="input-tabs"
                aria-label={t("Review input method", "طريقة إدخال المراجعات")}
              >
                <Tabs.Trigger value="paste">
                  <AlignLeft size={17} />
                  {t("Paste reviews", "لصق المراجعات")}
                </Tabs.Trigger>
                <Tabs.Trigger value="file">
                  <FileUp size={17} />
                  {t("Upload file", "رفع ملف")}
                </Tabs.Trigger>
                <Tabs.Trigger value="url">
                  <Link2 size={17} />
                  {t("Import URL", "رابط المصدر")}
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="paste">
                <label className="input-label">
                  {t("One review per paragraph", "مراجعة واحدة في كل فقرة")}
                  <textarea
                    className="review-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t(
                      "Paste customer reviews here, separated by a blank line…",
                      "الصق مراجعات العملاء هنا، مع سطر فارغ بين كل مراجعتين…",
                    )}
                    maxLength={1_000_000}
                  />
                </label>
                <p className="hint">
                  {t(
                    "Original text is preserved. Obvious emails and phone numbers are masked before AI processing.",
                    "نحتفظ بالنص الأصلي ونخفي البريد الإلكتروني وأرقام الهاتف الواضحة قبل إرسال النص للذكاء الاصطناعي.",
                  )}
                </p>
              </Tabs.Content>
              <Tabs.Content value="file">
                <label className="file-drop">
                  <FileUp size={30} />
                  <strong>
                    {t("Choose a review file", "اختر ملف المراجعات")}
                  </strong>
                  <span>CSV / TXT · {t("up to 2 MB", "حتى ٢ ميجابايت")}</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => void file(e.target.files?.[0])}
                  />
                </label>
                {table && (
                  <div className="mapping">
                    <p>
                      {t(
                        `${table.rows.length} rows found. Map your columns:`,
                        `تم العثور على ${table.rows.length} صف. حدّد الأعمدة:`,
                      )}
                    </p>
                    <div className="form-grid">
                      {(["text", "rating", "date", "title"] as const).map(
                        (key, i) => (
                          <label key={key}>
                            {
                              [
                                t("Review text *", "نص المراجعة *"),
                                t("Rating", "التقييم"),
                                t("Date", "التاريخ"),
                                t("Title", "العنوان"),
                              ][i]
                            }
                            <select
                              value={mapping[key]}
                              onChange={(e) =>
                                setMapping({
                                  ...mapping,
                                  [key]: e.target.value,
                                })
                              }
                            >
                              <option value="">
                                {t("Select column", "اختر العمود")}
                              </option>
                              {table.columns.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </Tabs.Content>
              <Tabs.Content value="url">
                <label>
                  {t(
                    "Public product or review page",
                    "صفحة المنتج أو المراجعات العامة",
                  )}
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://store.com/products/your-product"
                    dir="ltr"
                  />
                </label>
                <div className="notice">
                  <AlertCircle size={18} />
                  <p>
                    {t(
                      "Only permitted public HTML is supported. If reviews require login, verification or JavaScript, use paste or CSV import.",
                      "ندعم صفحات HTML العامة المسموح الوصول إليها فقط. إذا كانت المراجعات تتطلب تسجيل دخول أو تحققاً أو JavaScript، استخدم اللصق أو CSV.",
                    )}
                  </p>
                </div>
              </Tabs.Content>
            </Tabs.Root>
            <div className="import-footer">
              <span>
                {t(
                  "Maximum 200 reviews per project",
                  "٢٠٠ مراجعة كحد أقصى لكل مشروع",
                )}
              </span>
              <button
                className="button primary"
                onClick={() => (tab === "url" ? void loadURL() : showPreview())}
                disabled={busy}
              >
                {busy ? <Spinner /> : <ArrowRight size={17} />}{" "}
                {t("Preview reviews", "معاينة المراجعات")}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="preview-summary">
              <span>
                <Check size={17} />
                {count} {t("ready to analyze", "جاهزة للتحليل")}
              </span>
              <span>
                {prepared.rejected.length}{" "}
                {t("rejected / duplicates", "مرفوضة / مكررة")}
              </span>
              <span>
                {near} {t("near duplicates", "متشابهة جداً")}
              </span>
            </div>
            {near > 0 && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={exclude}
                  onChange={(e) => setExclude(e.target.checked)}
                />
                {t(
                  "Exclude near duplicates from analysis",
                  "استبعاد المراجعات المتشابهة جداً من التحليل",
                )}
              </label>
            )}
            <div className="preview-list">
              {prepared.reviews.map((r, i) => (
                <div key={r.id}>
                  <span className="review-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p dir="auto">{r.text}</p>
                  <span className="badge">
                    {r.language}
                    {r.rating ? ` · ${r.rating}/5` : ""}
                  </span>
                </div>
              ))}
            </div>
            {prepared.rejected.length > 0 && (
              <p className="hint">
                {prepared.rejected
                  .map(
                    (r) =>
                      `${t("Row", "صف")} ${r.row}: ${r.reason === "duplicate" ? t("duplicate", "مكررة") : r.reason === "too_long" ? t("over 6,000 characters", "أكثر من ٦٠٠٠ حرف") : t("empty or unusable", "فارغة أو غير مفيدة")}`,
                  )
                  .join(" · ")}
              </p>
            )}
            <div className="import-footer">
              <button className="button" onClick={() => setPreview(false)}>
                {t("Back to input", "العودة للإدخال")}
              </button>
              <button
                className="button primary"
                disabled={busy || !count}
                onClick={() => void analyze()}
              >
                {busy ? <Spinner /> : <ArrowRight size={17} />}{" "}
                {t("Analyze reviews", "تحليل المراجعات")}
              </button>
            </div>
          </div>
        )}
      </section>
      <aside className="import-aside">
        <div className="evidence-note">
          <span className="eyebrow">
            {t("EVIDENCE, NOT GUESSWORK", "أدلة، لا تخمينات")}
          </span>
          <h3>
            {t(
              "The review is always one click away.",
              "المراجعة الأصلية دائماً على بُعد نقرة.",
            )}
          </h3>
          <p>
            {t(
              "Every angle links back to the reviews behind it. Counts come from your data, and the Evidence Score measures support—not ad performance.",
              "كل زاوية إعلانية مرتبطة بالمراجعات التي تدعمها. الأعداد محسوبة من بياناتك، ودرجة الأدلة تقيس قوة الدعم وليس أداء الإعلان.",
            )}
          </p>
          <div className="evidence-chain">
            <span>{t("Review", "مراجعة")}</span>
            <i>→</i>
            <span>{t("Insight", "نتيجة")}</span>
            <i>→</i>
            <span>{t("Angle", "زاوية")}</span>
          </div>
        </div>
        <div className="panel demo-card">
          <FlaskConical size={21} />
          <h3>{t("Try a synthetic example", "جرّب مثالاً ببيانات صناعية")}</h3>
          <p>
            {t(
              "12 fictional bottle reviews. Clearly labeled, never mixed with real customer data.",
              "١٢ مراجعة خيالية لزجاجة. موسومة بوضوح ولا تُخلط مع بيانات العملاء الحقيقية.",
            )}
          </p>
          <div className="demo-buttons">
            <button className="button" onClick={() => fixture("en")}>
              English
            </button>
            <button className="button" onClick={() => fixture("ar")}>
              العربية
            </button>
            <button className="button" onClick={() => fixture("mixed")}>
              {t("Mixed", "مختلط")}
            </button>
          </div>
          {demo && (
            <span className="hint">
              {t(
                "Local demo uses fixture rules, not live AI.",
                "العرض المحلي يستخدم قواعد تجريبية وليس ذكاءً اصطناعياً مباشراً.",
              )}
            </span>
          )}
        </div>
      </aside>
    </div>
  );
}
