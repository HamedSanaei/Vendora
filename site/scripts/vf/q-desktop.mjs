// Desktop 1440 exploration of /fa/account key elements.
const byText = (d, t) => d.els.find((e) => e.txt === t) ?? null;
const byCls = (d, c) => d.els.find((e) => e.cls?.includes(c)) ?? null;

export function run(d, out) {
  out("vd-container", byCls(d, "vd-container"));
  out("breadcrumb nav", byCls(d, "breadcrumb"));
  out("page title h1", byText(d, "حساب کاربری"));
  out("sidebar aside", byCls(d, "lg:order-1") ? null : null);
  // sidebar card = aside with account nav
  const aside = d.els.find((e) => e.tag === "aside");
  out("sidebar aside", aside);
  const avatar = d.els.find((e) => e.cls?.includes("rounded-full") && e.w > 90 && e.w < 130);
  out("avatar ~108", avatar);
  const menuList = d.els.find((e) => e.tag === "ul" && e.h > 300 && e.w < 320);
  out("menu list", menuList);
  const menuItem = d.els.find(
    (e) => e.tag === "a" && (e.txt === "سفارش‌ها" || e.txt === "نمای کلی"),
  );
  out("menu item", menuItem);
  const activeItem = d.els.find((e) => e.bg?.includes("230") && e.h > 30 && e.h < 60 && e.tag === "a");
  out("active item(bg tint)", activeItem);
  const logout = byText(d, "خروج از حساب");
  out("logout btn", logout);

  const greetingTitle = byText(d, "سلام، کاربر وندورا");
  out("greeting h2", greetingTitle);
  const greetCard = greetingTitle
    ? [...d.els].reverse().find((e) => e.y <= greetingTitle.y && e.x <= greetingTitle.x && e.bg === "rgb(255, 255, 255)" && e.w > 500)
    : null;
  out("greeting card", greetCard);
  const badge = byText(d, "عضو فعال");
  out("member badge", badge);
  out("club card(#004D3A)", d.els.find((e) => e.bg?.startsWith("rgb(0, 77, 58)") || e.bg?.startsWith("rgb(0, 77")));
  out("points text", byText(d, "۲۴۰ امتیاز"));
  const qaCard = d.els.find((e) => e.bg === "rgb(246, 250, 248)" && e.w > 200 && e.w < 400 && e.h > 100);
  out("quick action card", qaCard);
  const ordersCard = d.els.find(
    (e) => e.bg === "rgb(255, 255, 255)" && e.bc && e.bw !== "0px" && e.w > 900,
  );
  out("recent orders card", ordersCard);
  const rowCode = byText(d, "سفارش VD-۱۰۴۸");
  out("order row code", rowCode);
  const detailsBtns = d.els.filter((e) => e.txt === "جزئیات");
  out("details button", detailsBtns[0]);
  const support = d.els.find((e) => e.bg?.includes("230, 248") || e.bg?.includes("230"));
  out("support band(tint)", support);
  const sectionH2 = byText(d, "دسترسی سریع");
  out("section h2", sectionH2);
  const editLink = byText(d, "ویرایش پروفایل ←");
  out("edit profile link", editLink);
}
