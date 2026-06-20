const locales = new Set(["fa", "en"]);

export default async function LocaleLayout({ children, params }) {
  const resolvedParams = await params;
  const locale = locales.has(resolvedParams.locale) ? resolvedParams.locale : "fa";

  return (
    <div lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      {children}
    </div>
  );
}
