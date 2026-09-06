"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Copy,
  FileText,
  Languages,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Angle, Project, Theme } from "@/lib/analysis/schema";
import { api, copy } from "@/lib/client";
import { Modal, Empty, Spinner } from "./ui";
import { repeatedPhrases } from "@/lib/analysis/voc";
import { localizeError } from "@/lib/language";
export const sections = [
  "overview",
  "themes",
  "pain",
  "benefit",
  "objection",
  "persona",
  "angles",
  "voc",
  "product_opportunity",
] as const;
export type Section = (typeof sections)[number];
export const sectionNames: Record<Section, [string, string]> = {
  overview: ["Overview", "نظرة عامة"],
  themes: ["Themes", "المحاور"],
  pain: ["Pain Points", "المشكلات"],
  benefit: ["Benefits", "الفوائد"],
  objection: ["Objections", "الاعتراضات"],
  persona: ["Personas", "شرائح العملاء"],
  angles: ["Ad Angles", "الزوايا الإعلانية"],
  voc: ["Voice of Customer", "صوت العميل"],
  product_opportunity: ["Product Opportunities", "فرص تطوير المنتج"],
};
export function Results({
  project: p,
  section,
  ar,
  onUpdate,
  onError,
  onNotice,
  localStaging = false,
}: {
  localStaging?: boolean;
  project: Project;
  section: Section;
  ar: boolean;
  onUpdate: (p: Project) => void;
  onError: (s: string) => void;
  onNotice: (s: string) => void;
}) {
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [angle, setAngle] = useState<Angle | null>(null);
  const [evidence, setEvidence] = useState<{
    title: string;
    ids: string[];
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [savedOnly, setSavedOnly] = useState(false);
  const [localError, setLocalError] = useState("");
  const number = (n: number) => n.toLocaleString(ar ? "ar" : "en");
  useEffect(() => setLocalError(""), [angle?.id, evidence?.title]);
  async function copied(value: string) {
    try {
      await copy(value);
      onNotice(t("Copied to clipboard", "تم النسخ"));
    } catch {
      onError(
        t(
          "Clipboard access failed. Select the text and copy it manually.",
          "تعذّر النسخ. حدّد النص وانسخه يدوياً.",
        ),
      );
    }
  }
  async function mutate(action: string, angleId?: string, reviewId?: string) {
    setLocalError("");
    setBusy(`${action}:${angleId || reviewId}`);
    try {
      const res = await api<{ project?: Project; translation?: string }>(
        `/api/projects/${p.id}`,
        { action, angleId, reviewId },
        localStaging,
      );
      if (res.project) {
        onUpdate(res.project);
        if (angle)
          setAngle(res.project.angles.find((a) => a.id === angle.id) || null);
      }
      if (res.translation && reviewId)
        setTranslations({ ...translations, [reviewId]: res.translation });
    } catch (e) {
      if (angle || evidence) setLocalError((e as Error).message);
      else onError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function showTheme(theme: Theme) {
    setEvidence({ title: theme.label, ids: theme.reviewIds });
  }
  const sentiment = (["positive", "mixed", "neutral", "negative"] as const).map(
    (key, i) => ({
      key,
      label: [
        t("Positive", "إيجابي"),
        t("Mixed", "مختلط"),
        t("Neutral", "محايد"),
        t("Negative", "سلبي"),
      ][i],
      count: p.extractions.filter((e) => e.sentiment === key).length,
    }),
  );
  const themeList = (items: Theme[]) =>
    items.map((theme) => (
      <button
        className="theme-row"
        key={theme.id}
        onClick={() => showTheme(theme)}
      >
        <div>
          <span>{theme.label}</span>
          <div className="mini-track">
            <i
              style={{
                width: `${(theme.count / Math.max(1, p.extractions.length)) * 100}%`,
              }}
            />
          </div>
        </div>
        <strong>{number(theme.count)}</strong>
        <ArrowUpRight size={16} />
      </button>
    ));
  const strengths = {
    limited: t("Limited evidence", "أدلة محدودة"),
    emerging: t("Emerging evidence", "أدلة أولية"),
    strong: t("Strong evidence", "أدلة قوية"),
  };
  return (
    <>
      {!!p.run.rejectedFacts && (
        <div className="notice warning">
          {t(
            `${p.run.rejectedFacts} model quotes did not match their source reviews and were excluded from the evidence.`,
            `تم استبعاد ${p.run.rejectedFacts} اقتباسات أعادها النموذج لأنها لا تطابق نص المراجعات الأصلية.`,
          )}
        </div>
      )}
      {p.run.failedReviewIds.length > 0 && (
        <div className="notice warning">
          <span>
            {t(
              `${p.run.failedReviewIds.length} reviews could not be extracted. Counts exclude them. Retrying rebuilds the insights and angles.`,
              `تعذّر تحليل ${p.run.failedReviewIds.length} مراجعات. الأعداد لا تشملها. إعادة المحاولة تعيد بناء النتائج والزوايا.`,
            )}
          </span>
          <button
            className="button"
            disabled={!!busy}
            onClick={() => void mutate("retry_missing")}
          >
            {t("Retry missing reviews", "إعادة تحليل المراجعات الناقصة")}
          </button>
        </div>
      )}
      {section === "overview" && (
        <>
          <div className="metrics">
            {[
              {
                label: t("Reviews analyzed", "المراجعات المحللة"),
                value: p.extractions.length,
                sub: t(
                  `of ${p.reviews.length} imported`,
                  `من ${p.reviews.length} مستوردة`,
                ),
                icon: MessageSquareQuote,
              },
              {
                label: t("Review sources", "مصادر المراجعات"),
                value: new Set(p.reviews.map((r) => r.source)).size,
                sub: t("Across this project", "في هذا المشروع"),
                icon: FileText,
              },
              {
                label: t("Detected languages", "اللغات المكتشفة"),
                value: new Set(p.reviews.map((r) => r.language)).size,
                sub: [...new Set(p.reviews.map((r) => r.language))]
                  .map((l) =>
                    l === "ar"
                      ? "العربية"
                      : l === "en"
                        ? "English"
                        : t("Mixed / other", "مختلط / أخرى"),
                  )
                  .join(" · "),
                icon: Languages,
              },
              {
                label: t("Evidence-backed angles", "زوايا مدعومة بالأدلة"),
                value: p.angles.length,
                sub: t(
                  `${p.angles.filter((a) => a.saved).length} saved`,
                  `${p.angles.filter((a) => a.saved).length} محفوظة`,
                ),
                icon: ShieldCheck,
              },
            ].map((m) => (
              <div className="panel metric" key={m.label}>
                <div>
                  <span>{m.label}</span>
                  <m.icon size={18} />
                </div>
                <strong>{number(m.value)}</strong>
                <small>{m.sub}</small>
              </div>
            ))}
          </div>
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  {t("What customers keep mentioning", "ما يكرره العملاء")}
                </h2>
                <span className="hint">
                  {t("Distinct reviews", "مراجعات فريدة")}
                </span>
              </div>
              {themeList(p.themes.slice(0, 6))}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>{t("Customer sentiment", "مشاعر العملاء")}</h2>
              </div>
              <div className="sentiment-total">
                <strong>{number(p.extractions.length)}</strong>
                <span>{t("analyzed reviews", "مراجعة محللة")}</span>
              </div>
              <div
                className="sentiment-bar"
                aria-label={t("Sentiment distribution", "توزيع المشاعر")}
              >
                {sentiment.map((s) => (
                  <span
                    key={s.key}
                    className={s.key}
                    style={{
                      width: `${(s.count / Math.max(1, p.extractions.length)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              {sentiment.map((s) => (
                <div className="sentiment-row" key={s.key}>
                  <span>
                    <i className={s.key} />
                    {s.label}
                  </span>
                  <strong>{number(s.count)}</strong>
                </div>
              ))}
            </section>
          </div>
          <div className="three-grid">
            {(["pain", "benefit", "objection"] as const).map((category) => (
              <section className="panel" key={category}>
                <div className="panel-heading">
                  <h2>{sectionNames[category][ar ? 1 : 0]}</h2>
                </div>
                {themeList(
                  p.themes.filter((t) => t.category === category).slice(0, 3),
                )}
                {!p.themes.some((t) => t.category === category) && (
                  <p className="muted">
                    {t(
                      "No evidence found in these reviews.",
                      "لا توجد أدلة في هذه المراجعات.",
                    )}
                  </p>
                )}
              </section>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                {t("More customer intelligence", "نتائج إضافية من العملاء")}
              </h2>
            </div>
            <div className="insight-grid">
              {p.insights
                .filter(
                  (i) =>
                    ![
                      "pain",
                      "benefit",
                      "objection",
                      "persona",
                      "product_opportunity",
                    ].includes(i.category),
                )
                .map((i) => (
                  <article className="insight-card" key={i.id}>
                    <span className="eyebrow">
                      {
                        (
                          {
                            purchase_reason: t("Purchase reason", "سبب الشراء"),
                            use_case: t("Use case", "حالة الاستخدام"),
                            unexpected: t(
                              "Unexpected benefit",
                              "فائدة غير متوقعة",
                            ),
                            emotion: t("Emotional trigger", "محفّز عاطفي"),
                            comparison: t("Comparison", "مقارنة"),
                            messaging_opportunity: t(
                              "Messaging opportunity",
                              "فرصة للرسائل التسويقية",
                            ),
                          } as Record<string, string>
                        )[i.category]
                      }
                    </span>
                    <h3>{i.title}</h3>
                    <p>{i.description}</p>
                    <button
                      className="text-button"
                      onClick={() =>
                        setEvidence({ title: i.title, ids: i.reviewIds })
                      }
                    >
                      {number(i.reviewIds.length)}{" "}
                      {t("supporting reviews", "مراجعات داعمة")}{" "}
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
            </div>
          </section>
        </>
      )}
      {section === "themes" && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("Repeated themes", "المحاور المتكررة")}</h2>
            <span>
              {number(p.themes.length)} {t("themes", "محاور")}
            </span>
          </div>
          <p className="hint">
            {t(
              "Counts represent distinct reviews. A review may support more than one theme.",
              "الأعداد تمثل مراجعات فريدة. قد تدعم المراجعة أكثر من محور.",
            )}
          </p>
          {p.themes.map((theme) => (
            <div className="full-theme" key={theme.id}>
              <div>
                <span className="badge">
                  {
                    (
                      {
                        product: t("Product", "المنتج"),
                        shipping: t("Shipping", "الشحن"),
                        seller: t("Seller", "البائع"),
                        packaging: t("Packaging", "التغليف"),
                        support: t("Support", "الدعم"),
                      } as Record<string, string>
                    )[theme.scope]
                  }
                </span>
              </div>
              {themeList([theme])}
            </div>
          ))}
        </section>
      )}
      {[
        "pain",
        "benefit",
        "objection",
        "persona",
        "product_opportunity",
      ].includes(section) && (
        <div className="insight-grid">
          {p.insights
            .filter((i) => i.category === section)
            .map((insight, index) => (
              <article className="panel intelligence-card" key={insight.id}>
                <div className="insight-index">
                  {section === "persona" ? (
                    <Users size={22} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </div>
                <h2>{insight.title}</h2>
                <p>{insight.description}</p>
                <button
                  className="text-button"
                  onClick={() =>
                    setEvidence({
                      title: insight.title,
                      ids: insight.reviewIds,
                    })
                  }
                >
                  <ShieldCheck size={16} />
                  {number(insight.reviewIds.length)}{" "}
                  {t("supporting reviews", "مراجعات داعمة")}
                  <ArrowUpRight size={15} />
                </button>
              </article>
            ))}
          {!p.insights.some((i) => i.category === section) && (
            <Empty
              title={t("No supported findings yet", "لا توجد نتائج مدعومة بعد")}
              description={t(
                "These reviews do not contain enough evidence for this category.",
                "هذه المراجعات لا تحتوي على أدلة كافية لهذه الفئة.",
              )}
            />
          )}
        </div>
      )}
      {section === "voc" && (
        <>
          <div className="notice">
            <MessageSquareQuote size={20} />
            <p>
              {t(
                "Verified phrases from review text, in their original language. These are customer quotes, not generated marketing copy.",
                "عبارات متحقّق منها من نص المراجعات بلغتها الأصلية. هذه اقتباسات وليست نصوصاً تسويقية مولّدة.",
              )}
            </p>
          </div>
          <div className="insight-grid">
            {repeatedPhrases(
              p.reviews.filter((r) =>
                p.extractions.some((e) => e.reviewId === r.id),
              ),
            ).map((phrase) => (
              <article className="panel quote-card" key={phrase.phrase}>
                <span className="eyebrow">
                  {t("REPEATED CUSTOMER WORDING", "عبارات متكررة من العملاء")}
                </span>
                <blockquote dir="auto">“{phrase.phrase}”</blockquote>
                <button
                  className="text-button"
                  onClick={() =>
                    setEvidence({ title: phrase.phrase, ids: phrase.reviewIds })
                  }
                >
                  {number(phrase.reviewIds.length)}{" "}
                  {t("reviews use this wording", "مراجعات تستخدم هذه العبارة")}
                  <ArrowUpRight size={15} />
                </button>
              </article>
            ))}
            {p.themes
              .filter((t) => t.count >= 2)
              .map((theme) => (
                <article className="panel quote-card" key={theme.id}>
                  <span className="eyebrow">{theme.label}</span>
                  <blockquote dir="auto">“{theme.quotes[0]?.quote}”</blockquote>
                  <button
                    className="text-button"
                    onClick={() => showTheme(theme)}
                  >
                    {t("Theme appears in", "ورد المحور في")}{" "}
                    {number(theme.count)} {t("reviews", "مراجعات")}
                    <ArrowUpRight size={15} />
                  </button>
                  <span className="hint">
                    {t(
                      "Representative quote; wording may differ across reviews.",
                      "اقتباس ممثّل للمحور؛ قد تختلف الصياغة بين المراجعات.",
                    )}
                  </span>
                </article>
              ))}
          </div>
        </>
      )}
      {section === "angles" && (
        <>
          <div className="section-toolbar">
            <p>
              {t(
                "Grounded ideas, ready for your creative brief.",
                "أفكار مدعومة، جاهزة للموجز الإبداعي.",
              )}
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
              />
              {t("Saved only", "المحفوظة فقط")}
            </label>
          </div>
          <div className="angle-grid">
            {p.angles
              .filter((a) => !savedOnly || a.saved)
              .map((a, index) => (
                <article className="panel angle-card" key={a.id}>
                  <div className="angle-top">
                    <span className="angle-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`score ${a.strength}`}
                      title={t(
                        "Evidence support, not predicted ad performance",
                        "قوة دعم الأدلة وليست توقعاً لأداء الإعلان",
                      )}
                    >
                      <ShieldCheck size={15} />
                      {number(a.score)}
                      <small>/100</small>
                    </span>
                  </div>
                  <div className="angle-type">{a.type}</div>
                  <h2>{a.name}</h2>
                  <p className="persona">
                    <Users size={15} />
                    {a.persona}
                  </p>
                  <div className="hook">
                    <span className="eyebrow">
                      {t(
                        "MAIN HOOK · GENERATED COPY",
                        "الجملة الافتتاحية · نص مولّد",
                      )}
                    </span>
                    <p>{a.hook}</p>
                  </div>
                  <button
                    className="evidence-link"
                    onClick={() =>
                      setEvidence({ title: a.name, ids: a.reviewIds })
                    }
                  >
                    <ShieldCheck size={16} />
                    {t("View Evidence", "عرض الأدلة")} ·{" "}
                    {number(a.reviewIds.length)}{" "}
                    {t("supporting reviews", "مراجعات داعمة")}
                    <ArrowUpRight size={15} />
                  </button>
                  <div className="angle-actions">
                    <button
                      className="button primary"
                      onClick={() => setAngle(a)}
                    >
                      {t("View Angle", "عرض الزاوية")}
                      <ArrowUpRight size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title={t("Copy Hook", "نسخ الجملة الافتتاحية")}
                      aria-label={t("Copy Hook", "نسخ الجملة الافتتاحية")}
                      onClick={() => void copied(a.hook)}
                    >
                      <Copy size={17} />
                    </button>
                    <button
                      className={`icon-button ${a.saved ? "is-saved" : ""}`}
                      title={t("Save", "حفظ")}
                      aria-label={
                        a.saved
                          ? t("Unsave angle", "إلغاء حفظ الزاوية")
                          : t("Save angle", "حفظ الزاوية")
                      }
                      aria-pressed={a.saved}
                      disabled={!!busy}
                      onClick={() => void mutate("save", a.id)}
                    >
                      <Bookmark
                        size={17}
                        fill={a.saved ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {savedOnly && !p.angles.some((a) => a.saved) && (
            <Empty
              title={t("No saved angles yet", "لم تحفظ أي زاوية بعد")}
              description={t(
                "Use the bookmark on any angle to keep it here.",
                "استخدم علامة الحفظ على أي زاوية لتظهر هنا.",
              )}
            />
          )}
          <p className="score-explainer">
            {t(
              "Evidence Score combines frequency (35%), consistency (25%), emotional language (15%), specificity (15%) and usability (10%), with small-sample caps. It does not predict advertising performance.",
              "درجة الأدلة تجمع التكرار (٣٥٪)، والاتساق (٢٥٪)، واللغة العاطفية (١٥٪)، والتحديد (١٥٪)، وقابلية الاستخدام (١٠٪)، مع سقف للعينات الصغيرة. ولا تتنبأ بأداء الإعلان.",
            )}
          </p>
        </>
      )}
      <Modal
        open={!!angle}
        onClose={() => setAngle(null)}
        title={angle?.name || ""}
        ar={ar}
        description={t(
          "Generated marketing concept grounded in customer evidence.",
          "فكرة تسويقية مولّدة ومستندة إلى أدلة العملاء.",
        )}
      >
        {angle && (
          <div className="angle-detail">
            {localError && (
              <div className="error-banner" role="alert">
                {localizeError(localError, ar)}
              </div>
            )}
            <div className="detail-meta">
              <span className={`score ${angle.strength}`}>
                <ShieldCheck size={16} />
                {number(angle.score)}/100 · {strengths[angle.strength]}
              </span>
              <button
                className="button"
                onClick={() => {
                  setEvidence({ title: angle.name, ids: angle.reviewIds });
                  setAngle(null);
                }}
              >
                {t("View Evidence", "عرض الأدلة")} (
                {number(angle.reviewIds.length)})
              </button>
            </div>
            {[
              {
                label: t("Customer insight", "رؤية العميل"),
                text: angle.insight,
              },
              {
                label: t(
                  "Target persona · hypothesis",
                  "الشريحة المستهدفة · فرضية",
                ),
                text: angle.persona,
              },
              { label: t("Main hook", "الجملة الافتتاحية"), text: angle.hook },
              {
                label: t("Alternative hooks", "افتتاحيات بديلة"),
                text: angle.alternativeHooks.join("\n"),
              },
              { label: t("Short ad copy", "نص إعلاني قصير"), text: angle.copy },
              { label: t("UGC concept", "فكرة محتوى منشئ"), text: angle.ugc },
              {
                label: t("First three seconds", "أول ثلاث ثوانٍ"),
                text: angle.firstThreeSeconds,
              },
              {
                label: t("Call to action", "الدعوة لاتخاذ إجراء"),
                text: angle.cta,
              },
            ].map((item) => (
              <div className="copy-section" key={item.label}>
                <div>
                  <h3>{item.label}</h3>
                  <button
                    className="icon-button"
                    aria-label={`${t("Copy", "نسخ")} ${item.label}`}
                    onClick={() => void copied(item.text)}
                  >
                    <Copy size={15} />
                  </button>
                </div>
                <p dir="auto">{item.text}</p>
              </div>
            ))}
            <div className="followup-actions">
              <button
                className="button"
                disabled={!!busy}
                onClick={() => void mutate("hooks", angle.id)}
              >
                {busy === `hooks:${angle.id}` ? (
                  <Spinner />
                ) : (
                  <Sparkles size={16} />
                )}{" "}
                {t("Generate More Hooks", "توليد افتتاحيات إضافية")}
              </button>
              <button
                className="button"
                disabled={!!busy}
                onClick={() => void mutate("ugc", angle.id)}
              >
                {busy === `ugc:${angle.id}` ? (
                  <Spinner />
                ) : (
                  <FileText size={16} />
                )}{" "}
                {t("Generate UGC Script", "توليد نص محتوى منشئ")}
              </button>
            </div>
            {p.followups
              .filter((f) => f.angleId === angle.id)
              .map((f) => (
                <div className="copy-section followup" key={f.id}>
                  <div>
                    <h3>
                      {f.kind === "hooks"
                        ? t("Additional hooks", "افتتاحيات إضافية")
                        : t("UGC script concept", "فكرة نص محتوى منشئ")}
                    </h3>
                    <button
                      className="icon-button"
                      aria-label={t("Copy content", "نسخ المحتوى")}
                      onClick={() => void copied(f.content)}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <p dir="auto">{f.content}</p>
                  <span className="hint">
                    {t(
                      "Generated content · linked to",
                      "محتوى مولّد · مرتبط بـ",
                    )}{" "}
                    {number(f.reviewIds.length)} {t("reviews", "مراجعات")}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Modal>
      <Modal
        open={!!evidence}
        onClose={() => setEvidence(null)}
        title={t("The evidence behind the insight", "الأدلة وراء النتيجة")}
        description={evidence?.title}
        ar={ar}
      >
        <div className="evidence-reviews">
          {localError && (
            <div className="error-banner" role="alert">
              {localizeError(localError, ar)}
            </div>
          )}
          {p.reviews
            .filter((r) => evidence?.ids.includes(r.id))
            .map((review, index) => (
              <article className="evidence-review" key={review.id}>
                <div className="review-meta">
                  <span>
                    <Check size={15} />{" "}
                    {t("Original review", "المراجعة الأصلية")}{" "}
                    {number(index + 1)}
                  </span>
                  <span>
                    {review.rating
                      ? `${review.rating}/5 ★`
                      : t("No rating", "دون تقييم")}
                  </span>
                </div>
                <blockquote dir="auto">{review.text}</blockquote>
                <div className="review-source">
                  <span>
                    {review.source} {review.date ? `· ${review.date}` : ""}
                  </span>
                  <code>{review.id}</code>
                </div>
                {translations[review.id] ? (
                  <div className="translation">
                    <strong>
                      {t(
                        "AI translation · not the original quote",
                        "ترجمة آلية · ليست النص الأصلي",
                      )}
                    </strong>
                    <p dir="auto">{translations[review.id]}</p>
                  </div>
                ) : (
                  <button
                    className="text-button"
                    disabled={!!busy}
                    onClick={() =>
                      void mutate("translate", undefined, review.id)
                    }
                  >
                    {busy === `translate:${review.id}` ? (
                      <Spinner />
                    ) : (
                      <Languages size={15} />
                    )}{" "}
                    {t("Translate to output language", "ترجمة إلى لغة النتائج")}
                  </button>
                )}
              </article>
            ))}
        </div>
      </Modal>
    </>
  );
}
