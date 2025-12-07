import { NextRequest, NextResponse } from 'next/server';

const HF_MODEL_ID = process.env.HF_MODEL_ID || '';
const HF_API_TOKEN = process.env.HF_API_TOKEN || '';

export async function POST(request: NextRequest) {
  try {
    if (!HF_MODEL_ID || !HF_API_TOKEN) {
      console.error('❌ Hugging Face 環境変数が未設定です');
      return NextResponse.json(
        { error: 'Hugging Face API is not configured' },
        { status: 500 }
      );
    }

    const { recordText } = await request.json();

    if (!recordText || typeof recordText !== 'string') {
      return NextResponse.json(
        { error: 'recordText is required' },
        { status: 400 }
      );
    }

    const systemPrompt = [
      'あなたは心臓リハビリ中の患者さん向けに、',
      'やさしく分かりやすく日本語でアドバイスをするAIです。',
      '以下の健康記録を読んで、',
      '1) 全体の簡単なまとめ（2〜3行）',
      '2) 今日の良いポイント（箇条書きで2〜3個）',
      '3) 明日への一言アドバイス（1〜2行）',
      'を出力してください。',
      '医学的な診断や病名の断定は行わず、「一般的な傾向」としてコメントしてください。',
    ].join('\n');

    const prompt = `${systemPrompt}\n\n=== 健康記録 ===\n${recordText}\n\n=== 出力 ===`;

    // 📝 2025以降の仕様変更に対応: api-inference.huggingface.co → router.huggingface.co
    const response = await fetch(
      `https://router.huggingface.co/models/${HF_MODEL_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 350,
            temperature: 0.4,
            do_sample: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Hugging Face API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get advice from AI' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // text-generation系モデルの典型的なレスポンス: [{ generated_text: "..." }]
    let advice = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      advice = data[0].generated_text as string;
      // プロンプト部分を取り除く（生成部分だけにするための簡易処理）
      const idx = advice.lastIndexOf('=== 出力 ===');
      if (idx !== -1) {
        advice = advice.slice(idx + '=== 出力 ==='.length).trim();
      }
    } else if (typeof data === 'string') {
      advice = data;
    } else {
      advice = JSON.stringify(data);
    }

    return NextResponse.json({ advice });
  } catch (error: any) {
    console.error('❌ /api/ai/advice error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


