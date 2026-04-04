export class SecondarySidebarAccessibilityService {
  getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) {
      return [];
    }

    return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hasAttribute('disabled'));
  }

  getLinkElements(container: HTMLElement): HTMLAnchorElement[] {
    return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[data-secondary-link="true"]'));
  }
}
