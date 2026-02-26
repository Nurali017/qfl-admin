export async function parseJsonOrThrow(response: Response) {
  if (response.ok) {
    return response.json();
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      const parts = body.detail
        .map((item: unknown) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as {
            loc?: unknown;
            msg?: unknown;
          };
          const loc = Array.isArray(record.loc)
            ? record.loc.map((value) => String(value)).join('.')
            : null;
          const msg = typeof record.msg === 'string' ? record.msg : null;
          if (loc && msg) {
            return `${loc}: ${msg}`;
          }
          return msg;
        })
        .filter((part: string | null): part is string => Boolean(part));
      if (parts.length > 0) {
        message = parts.join('; ');
      }
    } else if (typeof body.message === 'string') {
      message = body.message;
    }
  } catch {
    // ignore parse errors
  }

  throw new Error(message);
}
