export const outputLanguages = ["en", "ar", "ar-EG", "ar-SA"] as const;
export type OutputLanguage = (typeof outputLanguages)[number];
export function direction(language: string): "rtl" | "ltr" {
  return language.startsWith("ar") ? "rtl" : "ltr";
}
export function detectLanguage(text: string): string {
  const ar = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const en = (text.match(/[a-z]/gi) || []).length;
  if (ar > 0 && en > 0 && Math.min(ar, en) / Math.max(ar, en) > 0.15)
    return "mixed";
  return ar > en ? "ar" : en > 0 ? "en" : "und";
}
export const languageName: Record<OutputLanguage, string> = {
  en: "English",
  ar: "العربية الفصحى",
  "ar-EG": "العربية المصرية",
  "ar-SA": "العربية الخليجية / السعودية",
};
export function localizationPrompt(lang: OutputLanguage) {
  return {
    en: "Write natural English.",
    ar: "اكتب بالعربية الفصحى الواضحة بأسلوب تسويقي طبيعي.",
    "ar-EG":
      "اكتب بالمصري الطبيعي من غير ترجمة حرفية أو مبالغة. استخدم تعبيرات مصرية مناسبة.",
    "ar-SA": "اكتب بلهجة سعودية خليجية طبيعية ومحترمة، مو ترجمة حرفية.",
  }[lang];
}

export function localizeError(message: string, arabic: boolean) {
  if (!arabic || /[\u0600-\u06ff]/.test(message)) return message;
  const translations: [RegExp, string][] = [
    [
      /translation requires/i,
      "الترجمة تحتاج إلى حساب OpenAI مهيّأ. يمكنك مراجعة النص الأصلي الآن.",
    ],
    [
      /synthetic fixtures|bundled synthetic|fixture provider/i,
      "العرض المحلي يحلل الأمثلة الصناعية المرفقة فقط. هيّئ Supabase وOpenAI لتحليل مراجعاتك الحقيقية.",
    ],
    [
      /CSV|column/i,
      "تعذّرت قراءة الملف أو تحديد عمود النص. تحقّق من تنسيق CSV واختر عمود نص المراجعة، ثم أعد المعاينة.",
    ],
    [
      /too large|at most|smaller|too long|6,000/i,
      "البيانات أكبر من الحد المسموح. قسّمها إلى ملفات أصغر، بحد أقصى ٢٠٠ مراجعة و٢ ميجابايت لكل ملف.",
    ],
    [
      /session|sign in|sign-in/i,
      "تعذّر التحقق من تسجيل الدخول. راجع بريدك أو رمز الدخول ثم سجّل الدخول مجدداً.",
    ],
    [
      /allowance is used up/i,
      "استهلكت الحد الشهري المجاني. قلّل حجم المجموعة أو عُد الشهر القادم.",
    ],
    [
      /Too many requests|already processing|another request|reserve this analysis/i,
      "توجد طلبات قيد المعالجة. انتظر دقيقة ثم تابع التحليل من المشروع المحفوظ.",
    ],
    [
      /manual import|public|source|redirect|URL|verification|page|HTML/i,
      "تعذّر استيراد هذا المصدر تلقائياً. استخدم صفحة عامة مسموحاً بها أو الصق المراجعات أو ارفع ملف CSV.",
    ],
    [
      /evidence|quote|unknown|extraction/i,
      "تعذّر ربط بعض النتائج بأدلة موثوقة. أعد محاولة هذه المرحلة أو أضف مراجعات أكثر تفصيلاً.",
    ],
    [
      /No usable|No reviews|no data/i,
      "لم نجد مراجعات قابلة للتحليل. أضف نصوصاً مفصلة ثم أعد المعاينة.",
    ],
    [
      /database|Supabase|configuration|environment/i,
      "تعذّر الاتصال بالخدمة. تحقّق من إعداد Supabase وOpenAI وتطبيق ترحيل قاعدة البيانات ثم أعد المحاولة.",
    ],
    [
      /AI|model|API|rate limit/i,
      "تعذّر إكمال خطوة الذكاء الاصطناعي. تحقّق من إعداد الخدمة وحدود الاستخدام ثم تابع من المشروع المحفوظ.",
    ],
  ];
  return (
    translations.find(([pattern]) => pattern.test(message))?.[1] ||
    "تعذّر إكمال الإجراء. أعد المحاولة؛ يمكنك فتح المشروع المحفوظ من «كل المشاريع»."
  );
}
