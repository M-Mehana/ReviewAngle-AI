"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>Something interrupted this view · حدث خطأ</h1>
      <p>
        Your saved projects remain available. Try loading the view again.
        <br />
        مشاريعك المحفوظة متاحة. جرّب تحميل الصفحة مرة أخرى.
      </p>
      <button className="button primary" onClick={reset}>
        Try again · إعادة المحاولة
      </button>
    </main>
  );
}
