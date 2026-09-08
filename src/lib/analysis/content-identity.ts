// These expressions operate on comparison-normalized text supplied by guardrails.
export const targetAliases: Record<string, RegExp> = {
  nails:
    /\bnails?\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:اظافر|ظفر|ضوافر|ضوفر|ضفر)(?:ي|ك|ها)?(?= |$)/,
  lashes:
    /\b(?:eye)?lash(?:es)?\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:رموش|رمش)(?:ي|ك|ها)?(?= |$)/,
  brows:
    /\b(?:eye)?brows?\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?حواجب(?:ي|ك|ها)?(?= |$)/,
  hair: /\bhair\b|\bscalp\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:شعر|فروه)(?:ي|ك|ها)?(?= |$)/,
  skin: /\bskin\b|\bface\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:بشره|وجه)(?:ي|ك|ها)?(?= |$)/,
  lips: /\blips?\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:شفاه|شفايف)(?:ي|ك|ها)?(?= |$)/,
  eyes: /\beyes?\b|under eye|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:عين|عينين)(?:ي|ك|ها)?(?= |$)/,
  hands:
    /\bhands?\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:يد|ايد|ايدين)(?:ي|ك|ها)?(?= |$)/,
  feet: /\b(?:foot|feet)\b|(?:^| )(?:و|ف)?(?:لل|بال|ل|ب|ال)?(?:قدم|قدمين)(?:ي|ك|ها)?(?= |$)/,
};
export function targetConcepts(text: string) {
  return Object.entries(targetAliases)
    .filter(([, re]) => re.test(text))
    .map(([key]) => key);
}
export function experientialTestimony(text: string) {
  // A direction to fabricate a speaker's history is testimony too, even without "I".
  const personalNarration =
    /(?:person|creator|presenter|speaker).{0,65}(?:personal experience|own experience)|(?:شخص|مقدم|صانع|موديل).{0,70}(?:تجربته|تجربتها|تعليق شخصي)|(?:يحكي|بيحكي|تحكي|بتحكي|يسرد|يروي).{0,30}تجرب(?:ته|تها) الشخصيه/;
  const firstPerson =
    /\bi (?:have |had |already |personally )?(?:used|tried|bought|applied|noticed|saw|experienced)\b|\bafter (?:i )?using (?:it|this|the product)\b|\bmy (?:lashes|nails|skin|hair|brows).{0,25}(?:changed|grew|became|improved)|\b(?:it|this) worked for me\b|(?:^| )(?:انا )?(?:جربته|جربتها|استخدمته|استخدمتها|اشتريته|اشتريتها|حطيته|حطيتها|استعملته|استعملتها)(?= |$)|(?:^| )(?:جربت|استخدمت|اشتريت|استعملت) (?:المنتج|السيروم|ده|دي)|لاحظت.{0,15}(?:نتيج|فرق)|فرق معايا|رموشي بقت|تجربتي مع/;
  // Neutral instructions/hypotheticals do not become experiential claims unless
  // they explicitly put first-person history in the speaker's mouth.
  return firstPerson.test(text) || personalNarration.test(text);
}
export type CreativeDevice =
  | "product-display"
  | "objection-answer"
  | "educational"
  | "review-card"
  | "talking-head"
  | "routine-demo"
  | "close-up"
  | "mirror"
  | "before-after"
  | "unboxing"
  | "comparison"
  | "pov"
  | "text-led"
  | "lifestyle"
  | "unknown";
export function creativeDevice(text: string): CreativeDevice {
  if (presentsCustomerProof(text)) return "review-card";
  text = text.replace(
    /(?:من غير|بدون|دون|بلا)\s+(?:عرض\s+|اظهار\s+)?(?:اي\s+)?(?:اقتباس[\u0600-\u06ff]*|مراجعات|بطاقه مراجعات)/g,
    "",
  );
  // Quote-led executions are one family, irrespective of props, typography or
  // whether the original review is on paper, a mirror or the screen.
  if (
    /اقتباس|اقتباسين|اقتباسات|قصاصه.{0,40}(?:عباره|مراجع)|(?:review|customer|testimonial).{0,25}(?:quote|quotation|text)|(?:quote|quotation).{0,25}(?:review|customer)|كلمات.{0,20}(?:مراجعه|اقتباس)/.test(
      text,
    )
  )
    return "review-card";
  if (
    /objection|question.{0,20}answer|سؤال.{0,25}(?:اجابه|رد)|يرد.{0,20}سؤال/.test(
      text,
    )
  )
    return "objection-answer";
  if (/educational|explainer|شرح توضيحي|رسم توضيحي/.test(text))
    return "educational";
  if (
    /review card|testimonial card|review overlay|screenshot.{0,25}review|بطاقه.{0,20}(?:مراجع|تقييم)|(?:نص|عباره|كلام).{0,25}(?:المراجعه|التقييم).{0,70}(?:الشاشه|يظهر|ظهور)|(?:اظهار|ظهور|عرض).{0,20}(?:عباره|نص|كلام).{0,25}(?:مراجعه|تقييم)|(?:رأي|راي) عميله/.test(
      text,
    )
  )
    return "review-card";
  if (
    /من فوق|من اعلي|overhead|flat lay|flatlay|top down|(?:قطعه|منتج|قماش).{0,35}(?:مفرود|ترابيزه|سطح بسيط)|(?:مفرود).{0,30}(?:سطح|طاول)/.test(
      text,
    )
  )
    return "product-display";
  if (/before and after|before after|قبل وبعد|قبل و بعد/.test(text))
    return "before-after";
  if (
    /unbox|gift box|wrapping a gift|فتح.{0,15}(?:علبه|طرد)|تغليف هديه/.test(
      text,
    )
  )
    return "unboxing";
  if (/mirror|مرايه|مراه/.test(text)) return "mirror";
  if (/pov|وجهه نظر/.test(text)) return "pov";
  if (/compar|مقارنه|تقسيم الشاشه|جانب.{0,10}جانب/.test(text))
    return "comparison";
  if (/routine|demo|روتين|تطبيق|طريقه الاستخدام|خطوات استخدام/.test(text))
    return "routine-demo";
  if (/talking head|presenter|متحدث|مقدم.{0,20}الكاميرا/.test(text))
    return "talking-head";
  if (
    /close up|closeup|macro|لقطه قريبه|لقطات قريبه|عن قرب|تفاصيل الخياطه/.test(
      text,
    )
  )
    return "close-up";
  if (/text led|نص كبير|نص متحرك/.test(text)) return "text-led";
  if (/lifestyle|sofa|bedtime|كنبه|روتين البيت|باب البيت/.test(text))
    return "lifestyle";
  return "unknown";
}
// Comparison-normalized generated prose only. Never apply to stored evidence.
export function presentsCustomerProof(text: string) {
  const affirmative = text.replace(
    /(?:من غير|بدون|دون|بلا)\s+(?:عرض\s+|اظهار\s+|قراءه\s+)?(?:اي\s+)?(?:اقتباس[\u0600-\u06ff]*|مراجعات|بطاقه مراجعات|تجربه شخصيه)/g,
    "",
  );
  return /اقتباس|مراجع(?:ه|ات|تان|تين)|اراء العملاء|راي عميل|(?:قالت?|بتقول|بيقول)\s+(?:ال)?عميل|عميل[\u0600-\u06ff]*\s+(?:قال|بتقول|بيقول)|تجربه\s+(?:ال)?عميل|تعليق\s+(?:ال)?عميل|العملاء بيقولوا|الناس بتقول|زي ما قالت|واحده جربته وقالت|(?:عرض|قراءه|يقرأ|يقرا|تقرأ|تقرا|تفسير).{0,30}(?:تعليقات|تقييمات)|(?:نجوم|تقييم).{0,25}(?:عميل|شاشه|اثبات)|(?:customer|testimonial|review|star rating|comment).{0,30}(?:quote|card|read|screen|overlay|interpret|says?|said|proof)|(?:read|interpret|show|display).{0,30}(?:review|customer comment)|customer (?:says?|said)|review(?:s)? (?:say|said)/.test(
    affirmative,
  );
}
