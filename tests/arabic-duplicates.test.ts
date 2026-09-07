import { expect, it } from "vitest";
import { prepareReviews } from "../src/lib/ingestion";

it("flags long Arabic copies despite elongation, spacing and small spelling differences", () => {
  const original =
    "اشتريت مصباح المكتب الأسبوع الماضي وكانت التجربة جميلة جدا الإضاءة مناسبة للقراءة مساء والقاعدة ثابتة على الطاولة وسأطلب واحدا آخر للمكتب";
  const variant =
    "اشتريت مصباح المكتب الاسبوع الماضي وكانت التجربة جميلة جداااا الاضاءة مناسبةللقراءة مساء والقاعدة ثابتة على الطاولة وساطلب واحدا اخر للمكتب";
  const result = prepareReviews([{ text: original }, { text: variant }]);
  expect(result.reviews[1].nearDuplicateOf).toBe(result.reviews[0].id);
  expect(result.reviews[1].normalized).toBe(variant);
  expect(result.reviews[1].text).toBe(variant);
});

it("keeps short praise, distinct Arabic experiences and changed negation separate", () => {
  const result = prepareReviews([
    { text: "جميل جدااا" },
    { text: "جميل جدا" },
    {
      text: "اشتريت مصباح المكتب الأسبوع الماضي والإضاءة مناسبة للقراءة والقاعدة ثابتة جدا على الطاولة في غرفة العمل",
    },
    {
      text: "اشتريت مصباح المكتب الأسبوع الماضي والإضاءة مش مناسبة للقراءة والقاعدة ثابتة جدا على الطاولة في غرفة العمل",
    },
    {
      text: "اشتريت مصباح المكتب للعمل لكن الإضاءة ضعيفة والقاعدة تهتز كثيرا ولا أنصح به للقراءة في المساء",
    },
  ]);
  expect(result.reviews.every((r) => !r.nearDuplicateOf)).toBe(true);
});
