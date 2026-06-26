export default function validateOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (
      process.env.NODE_ENV !== 'production' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true;
    }

    const allowedHosts = (
      process.env.ALLOWED_HOSTS?.split(',') ?? []
    ).map((h) => h.trim().toLowerCase());

    return allowedHosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}