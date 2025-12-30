export async function readJsonOrThrow<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // 空ボディ
  if (!text) {
    // @ts-expect-error - allow returning empty object for convenience
    return {} as T;
  }

  // Content-Type が JSON の場合は通常パース
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw new Error(`JSON parse failed (content-type: ${contentType}, status: ${res.status}): ${(e as any)?.message || e}`);
    }
  }

  // JSON 以外（HTMLなど）を誤って .json() しないように、内容の先頭だけ出す
  const head = text.slice(0, 140).replace(/\s+/g, ' ').trim();
  throw new Error(`Expected JSON but got non-JSON (content-type: ${contentType || 'unknown'}, status: ${res.status}): ${head}`);
}

export async function readJsonOrNull<T = any>(res: Response): Promise<T | null> {
  try {
    return await readJsonOrThrow<T>(res);
  } catch {
    return null;
  }
}


