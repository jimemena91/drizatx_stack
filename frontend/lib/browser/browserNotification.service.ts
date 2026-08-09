const DEFAULT_TITLE = "DrizaTx";
const DEFAULT_FAVICON = "/drizatx-icon-512.png";

class BrowserNotificationService {
  private waitingCount = 0;
  private originalTitle: string | null = null;
  private updateVersion = 0;
  private originalFavicon: string | null = null;

  updateWaitingCount(count: number) {
    if (typeof document === "undefined") return;

    const normalizedCount = Math.max(0, Math.floor(count));
    this.waitingCount = normalizedCount;

    this.captureOriginalState();

    if (normalizedCount === 0) {
      this.restore();
      return;
    }

    document.title = `(${normalizedCount}) ${DEFAULT_TITLE}`;
    this.updateFaviconWithBadge(normalizedCount);
  }

  restore() {
    if (typeof document === "undefined") return;

    document.title = DEFAULT_TITLE;
    this.updateVersion += 1;

    const favicon = this.getOrCreateFavicon();
    favicon.href = this.originalFavicon || DEFAULT_FAVICON;

    this.waitingCount = 0;
  }

  getWaitingCount() {
    return this.waitingCount;
  }

  private captureOriginalState() {
    if (this.originalTitle === null) {
      this.originalTitle = document.title || DEFAULT_TITLE;
    }

    if (this.originalFavicon === null) {
      this.originalFavicon =
        this.getExistingFavicon()?.href || DEFAULT_FAVICON;
    }
  }

  private getExistingFavicon() {
    return document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  }

  private getOrCreateFavicon() {
    const existing = this.getExistingFavicon();
    if (existing) return existing;

    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = DEFAULT_FAVICON;
    document.head.appendChild(link);

    return link;
  }

  private updateFaviconWithBadge(count: number) {
    const version = ++this.updateVersion;
    const image = new Image();
    image.src = DEFAULT_FAVICON;

    image.onload = () => {
      if (version !== this.updateVersion) return;
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.drawImage(image, 0, 0, size, size);

      const badgeRadius = 18;
      const badgeX = size - badgeRadius;
      const badgeY = badgeRadius;

      context.beginPath();
      context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
      context.fillStyle = "#dc2626";
      context.fill();

      context.fillStyle = "#ffffff";
      context.font = "bold 22px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      const label = count > 99 ? "99+" : String(count);
      context.fillText(label, badgeX, badgeY + 1);

      this.getOrCreateFavicon().href = canvas.toDataURL("image/png");
    };
  }
}

export const browserNotificationService = new BrowserNotificationService();
