import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 旧: ルールベース生成（フォールバック用）
function buildRuleBasedAdvice(input: {
  systolic?: string; diastolic?: string; pulse?: string; weight?: string;
}) {
  const s = parseInt(input.systolic ?? '');
  const d = parseInt(input.diastolic ?? '');
  const p = parseInt(input.pulse ?? '');
  const w = parseFloat(input.weight ?? '');

  const out: string[] = [];
  if (Number.isFinite(s) && Number.isFinite(d)) {
    if (s >= 140 || d >= 90) out.push('⚠️ 血圧が高めです。塩分を控え、軽い有酸素運動を継続しましょう。');
    else if (s < 90 || d < 60) out.push('💡 血圧が低めです。水分と休息を心がけ、立ちくらみに注意してください。');
    else out.push('✅ 血圧は概ね良好です。この調子を維持しましょう。');
  }
  if (Number.isFinite(p)) {
    if (p > 100) out.push('⚠️ 脈拍が高めです。深呼吸やストレッチでクールダウンを。');
    else if (p < 60) out.push('💡 脈拍が低めです。気になる場合は医師へ相談を。');
    else out.push('✅ 脈拍は安定しています。');
  }
  if (Number.isFinite(w)) {
    out.push('🍽 食事は主食・主菜・副菜のバランスを意識しましょう。');
  }
  return out.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // A) 直接プロンプト指定（推奨）
    const prompt: string | undefined = body?.prompt;

    // B) 互換: 既存の healthData + profile からプロンプト生成
    const healthData = body?.healthData;
    const profile = body?.profile;

    // ルールベースモードを強制
    const hfToken = null;
    const useHF = false; // 明示的にfalseに設定

    console.log('🔑 AI Mode: Rule-based (Hugging Face disabled)');

    // プロンプト自動生成（旧クライアント互換）
    const autoPrompt =
      `患者プロフィール:
      - 年齢: ${profile?.age || '未設定'}歳
      - 性別: ${profile?.gender || '未設定'}
      - 身長: ${profile?.height || '未設定'}cm
      - 目標体重: ${profile?.targetWeight || '未設定'}kg
      - 疾患: ${Array.isArray(profile?.diseases) ? profile.diseases.join('、') : 'なし'}

      直近の記録の例:
      - 血圧/脈拍/体重/運動/食事などを踏まえて、
      循環器リハビリの指導員として、日本語で具体的かつ短く行動可能なアドバイスを出力してください。`;

    // 旧データから簡易バイタル抽出（フォールバックで使用）
    const latestDate = healthData?.summary?.latestDate;
    const latestRecord = latestDate ? (
      healthData?.records?.[latestDate] &&
      Object.values(healthData.records[latestDate] as Record<string, any>)[0]
    ) : undefined;

    // Hugging Face呼び出し
    if (useHF) {
      const text = prompt || autoPrompt;
      const models = [
        'gpt2',
        'EleutherAI/gpt-neo-125m',
        'facebook/bart-large-cnn',
      ];

      let lastErr: any = null;

      for (const model of models) {
        try {
          const resp = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: text,
              parameters: { max_length: 220, temperature: 0.7, do_sample: true },
            }),
          });

          if (!resp.ok) {
            const detail = await resp.text();
            console.log(`HF ${model} ${resp.status} body:`, detail);
            lastErr = new Error(`HF ${model} ${resp.status}`);
            continue;
          }

          const data = await resp.json();
          if (data?.error) {
            lastErr = new Error(data.error);
            continue;
          }

          const advice = data?.[0]?.generated_text || 'アドバイスを生成できませんでした。';
          return NextResponse.json({ success: true, advice, model });
        } catch (e) {
          lastErr = e;
        }
      }

      return NextResponse.json(
        { success: false, error: lastErr?.message || 'Hugging Face呼び出しに失敗しました。' },
        { status: 503 }
      );
    }

    // ルールベース（トークン未設定時の無料フォールバック）
    const advice = buildRuleBasedAdvice({
      systolic: latestRecord?.bloodPressure?.systolic,
      diastolic: latestRecord?.bloodPressure?.diastolic,
      pulse: latestRecord?.pulse,
      weight: latestRecord?.weight,
    });

    return NextResponse.json({ success: true, advice, model: 'rule-based' });
  } catch (e: any) {
    console.error('❌ Advice API Error:', {
      message: e.message,
      stack: e.stack,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'アドバイス生成中にエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? e.message : undefined
      },
      { status: 500 }
    );
  }
}