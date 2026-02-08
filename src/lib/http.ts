export async function parseJsonOrThrow(response: Response) {
  if (response.ok) {
    return response.json();
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') {
      message = body.detail;
    }
  } catch {
    // ignore parse errors
  }

  throw new Error(message);
}
