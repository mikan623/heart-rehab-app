export async function readJsonOrThrow(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // 空ボディ
  if (!text) {
    return {};
  }

  // Content-Type が JSON の場合は通常パース
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`JSON parse failed (content-type: ${contentType}, status: ${res.status}): ${message}`);
    }
  }

  // JSON 以外（HTMLなど）を誤って .json() しないように、内容の先頭だけ出す
  const head = text.slice(0, 140).replace(/\s+/g, ' ').trim();
  throw new Error(`Expected JSON but got non-JSON (content-type: ${contentType || 'unknown'}, status: ${res.status}): ${head}`);
}

export async function readJsonOrNull(res: Response): Promise<unknown | null> {
  try {
    return await readJsonOrThrow(res);
  } catch {
    return null;
  }
}


