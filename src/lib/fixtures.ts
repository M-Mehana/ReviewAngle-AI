import type { RawReview } from "./ingestion";
const en = [
  "I take this bottle on my morning commute. The lid does not leak in my work bag and my coffee stays warm until lunch.",
  "Finally a bottle that does not leak! I carry it to the office every day. Cleaning the narrow opening is difficult though.",
  "My coffee stays warm during long shifts. I was worried about the price, but using it every day makes it worthwhile.",
  "The bottle fits my car cup holder. It does not leak when I cycle to work, which is such a relief.",
  "I love how my coffee stays warm. The lid is hard to clean and I would like a spare seal in the box.",
  "I bought it for the gym. It feels heavy in a small bag, but the water stays cold throughout my workout.",
  "The delivery arrived three days late. The bottle itself does not leak and the packaging protected it well.",
  "Customer support sent a replacement lid quickly. I wish there were more colors and a wider opening for cleaning.",
  "I was worried about the price compared with my old travel mug. This one does not leak in my laptop bag.",
  "The narrow opening is difficult to clean. Please make the lid easier to take apart; I use it for coffee every day.",
  "It fits my car cup holder perfectly and the water stays cold on road trips. I did not expect it to work so well for travel.",
  "I love the secure lid for my commute. It feels heavy when full and the delivery box had too much plastic.",
];
const ar = [
  "باخد الزجاجة معايا الشغل كل يوم. الغطا محكم ومش بتسرب في الشنطة والقهوة بتفضل سخنة لحد الضهر.",
  "أخيراً زجاجة مش بتسرب! بستخدمها في المواصلات بس الفتحة الضيقة صعبة في التنظيف.",
  "القهوة بتفضل سخنة طول الشيفت. كنت قلقان من السعر بس استخدامي اليومي خلاني أحس إنها تستاهل.",
  "الزجاجة مناسبة لحامل الأكواب في السيارة وما تسرب في الشنطة. ارتحت من الخوف على اللابتوب.",
  "مبسوطة إن القهوة بتفضل سخنة بس الغطا صعب في التنظيف. ياريت تضيفوا جلدة احتياطية مع العلبة.",
  "اشتريتها للنادي والمياه بتفضل باردة طول التمرين. بس الزجاجة تقيلة في الشنطة الصغيرة.",
  "التوصيل اتأخر ثلاثة أيام لكن الزجاجة مش بتسرب والتغليف حماها كويس.",
  "خدمة العملاء بعتوا غطا بديل بسرعة. نفسي في ألوان أكتر وفتحة أوسع للتنظيف.",
  "كنت متردد بسبب السعر مقارنة بالمج القديم. أهم حاجة إنها مش بتسرب جنب اللابتوب.",
  "الفتحة الضيقة صعبة في التنظيف. محتاجين غطا يتفك بسهولة لأني بستخدمها للقهوة كل يوم.",
  "مناسبة لحامل الأكواب في السيارة والمياه بتفضل باردة في السفر. فادتني في الرحلات أكتر مما توقعت.",
  "مرتاح للغطا المحكم في المشاوير لكن الزجاجة تقيلة وهي مليانة والكرتونة فيها بلاستيك كتير.",
];
export function fixtures(kind: "en" | "ar" | "mixed"): RawReview[] {
  const texts =
    kind === "en"
      ? en
      : kind === "ar"
        ? ar
        : en.slice(0, 6).concat(ar.slice(6));
  return texts.map((text, i) => ({
    text,
    rating: [5, 4, 5, 5, 4, 3, 3, 4, 4, 2, 5, 3][i],
    date: `2026-08-${String(i + 10).padStart(2, "0")}`,
    source: "Synthetic demo · Daily Carry Bottle",
  }));
}
export function isFixture(text: string) {
  return [...en, ...ar].includes(text);
}
