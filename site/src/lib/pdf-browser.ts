/** Reserves a user-initiated PDF viewer before awaiting HTTP, so browsers do not block it as an unsolicited popup. */
export function preparePdfPrintWindow(openWindow: () => Window | null = () => window.open("about:blank", "_blank")): Window {
  const target = openWindow();
  if (!target) throw new Error("PDF_POPUP_BLOCKED");
  target.opener = null;
  return target;
}
