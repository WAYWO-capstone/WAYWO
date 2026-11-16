export function scrollToUpdateInHistory(
  updateId: string,
): (() => void) | undefined {
  const targetElement = document.getElementById(`update-${updateId}`);
  const scrollContainer = targetElement?.closest<HTMLElement>(
    "[data-update-history-scroll-container]",
  );
  if (!targetElement || !scrollContainer) return undefined;

  const targetRect = targetElement.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const visibleTop = containerRect.top + 12;
  const visibleBottom = containerRect.bottom - 12;
  const scrollDelta =
    targetRect.top < visibleTop
      ? targetRect.top - visibleTop
      : targetRect.bottom > visibleBottom
        ? targetRect.bottom - visibleBottom
        : 0;
  const currentScrollTop = scrollContainer.scrollTop;
  const maxScroll = Math.max(
    0,
    scrollContainer.scrollHeight - scrollContainer.clientHeight,
  );
  const top = Math.max(
    0,
    Math.min(maxScroll, currentScrollTop + scrollDelta),
  );
  const highlightClasses = [
    "bg-brand-rust/10",
    "ring-2",
    "ring-brand-garnet",
    "ring-offset-2",
  ];

  targetElement.classList.add(...highlightClasses);
  if (top !== currentScrollTop) {
    scrollContainer.scrollTo?.({ top, behavior: "smooth" });
  }
  targetElement.focus({ preventScroll: true });

  const timeoutId = window.setTimeout(() => {
    targetElement.classList.remove(...highlightClasses);
  }, 2500);
  return () => {
    window.clearTimeout(timeoutId);
    targetElement.classList.remove(...highlightClasses);
  };
}
