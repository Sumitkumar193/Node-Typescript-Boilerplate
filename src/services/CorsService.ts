export default function validateOrigin(origin: string): boolean {
  if (
    process.env.NODE_ENV !== 'production' &&
    (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))
  ) {
    return true;
  }

  const allowedOrigins =
    process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [];

  return allowedOrigins.includes(origin);
}
