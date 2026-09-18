export function cleanText(el) {
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

export function cleanTextNoTooltip(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone
    .querySelectorAll(
      '[data-test="UpCTooltip"], [data-test*="tooltip"], .air3-tooltip-body, .air3-popper-content, [role="tooltip"], [class*="tooltip"], .air3-popper, [data-popper-placement]'
    )
    .forEach((node) => node.remove());
  let text = clone.textContent.replace(/\s+/g, " ").trim();
  text = text.replace(/Close the tooltip\b[^.]*?\.\s*/g, "");
  text = text.replace(/Close the tooltip\s*/g, "");
  return text.trim();
}

export function queryFirst(panel, ...selectors) {
  for (const selector of selectors) {
    const el = panel.querySelector(selector);
    if (el) return el;
  }
  return null;
}

export function stripTooltipNoise(value) {
  if (typeof value === "string") {
    return value
      .replace(/Close the tooltip\b[^.]*?\.\s*/g, "")
      .replace(/Close the tooltip\s*/g, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(stripTooltipNoise);
  }
  return value;
}
