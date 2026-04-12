import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `あなたは「心臓リハビリ専門の健康アドバイザーAI」です。
元理学療法士が開発した心臓リハビリ手帳アプリのサポートとして動作します。

【役割】
- ユーザーの健康記録を分析し、具体的で実践的な健康指導を行う
- 心臓疾患を持つ患者が安全に日常生活・リハビリを継続できるよう支援する
- 温かく、寄り添う言葉遣いで、患者が前向きに取り組めるよう励ます

【対応できること】
- 直近の血圧・脈拍・体重の傾向分析とコメント
- 運動記録に基づいた運動量の評価と次のステップの提案
- 食事記録に基づいた栄養・塩分・食習慣のアドバイス
- 血液データ（HbA1c・コレステロール・BNP等）の解説と生活改善提案
- CPX検査結果（VO2・METs・AT等）に基づく運動強度の目安提示
- 服薬状況の確認と継続の重要性の説明
- 日常生活の工夫や注意点の提案

【厳守事項】
- 医師・理学療法士・看護師等の医療専門家の指示を最優先とすること
- 薬の変更・中止・追加を絶対に指示しないこと
- 診断・病名の確定は行わないこと
- 異常値や危険な症状（胸痛・呼吸困難・激しい動悸・めまい等）を検知した場合は、必ず「すぐに医師または救急に連絡するよう」促すこと
- 回答は医療的根拠に基づき、根拠のない情報を伝えないこと

【回答スタイル】
- 読みやすく、箇条書きと見出しを適度に使う
- 専門用語は使う場合、必ず平易な言葉で補足する
- 最後に必ず「何か気になることがあれば担当医にご相談ください」を添える
- 1回の回答は500文字程度を目安にし、簡潔にまとめる`;

function buildUserPrompt(data: {
  profile: {
    age: number | null;
    gender: string | null;
    height: number | null;
    targetWeight: number | null;
    diseases: string[];
    riskFactors: string[];
    medications: string | null;
    physicalFunction: string | null;
  } | null;
  healthRecords: Array<{
    date: string;
    time: string;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    pulse: number | null;
    weight: number | null;
    exercise: unknown;
    meal: unknown;
    dailyLife: string | null;
    medicationTaken: boolean | null;
  }>;
  bloodData: {
    testDate: string;
    hbA1c: number | null;
    totalCholesterol: number | null;
    ldlCholesterol: number | null;
    hdlCholesterol: number | null;
    triglycerides: number | null;
    bnp: number | null;
    creatinine: number | null;
    hemoglobin: number | null;
    cpxTests: Array<{
      testDate: string;
      atDuring: number | null;
      vo2: number | null;
      mets: number | null;
      loadWeight: number | null;
    }>;
  } | null;
}): string {
  const { profile, healthRecords, bloodData } = data;

  const profileSection = profile
    ? `【ユーザー基本情報】
- 年齢：${profile.age ?? '不明'}歳 / 性別：${profile.gender ?? '不明'}
- 身長：${profile.height ?? '不明'}cm / 目標体重：${profile.targetWeight ?? '不明'}kg
- 主な疾患：${profile.diseases.length > 0 ? profile.diseases.join('、') : '記録なし'}
- リスク因子：${profile.riskFactors.length > 0 ? profile.riskFactors.join('、') : '記録なし'}
- 服用中の薬：${profile.medications ?? '記録なし'}
- 身体機能：${profile.physicalFunction ?? '記録なし'}`
    : '【ユーザー基本情報】\nプロフィール未登録';

  const recordsSection =
    healthRecords.length > 0
      ? `【直近7日間の健康記録】\n` +
        healthRecords
          .map((r) => {
            const ex = r.exercise as { type?: string; duration?: string } | null;
            const meal = r.meal as {
              staple?: string[];
              mainDish?: string[];
              sideDish?: string[];
              other?: string;
            } | null;
            return (
              `- ${r.date} ${r.time}\n` +
              `  血圧：${r.bloodPressureSystolic}/${r.bloodPressureDiastolic} mmHg　` +
              `脈拍：${r.pulse ?? '-'} bpm　体重：${r.weight ?? '-'} kg\n` +
              `  運動：${ex?.type ?? 'なし'}（${ex?.duration ?? '-'}分）\n` +
              `  食事：主食[${meal?.staple?.join('・') ?? '-'}]　主菜[${meal?.mainDish?.join('・') ?? '-'}]　副菜[${meal?.sideDish?.join('・') ?? '-'}]\n` +
              `  日常生活メモ：${r.dailyLife ?? 'なし'}\n` +
              `  服薬：${r.medicationTaken ? '服用済み' : '未服用'}`
            );
          })
          .join('\n')
      : '【直近7日間の健康記録】\n記録なし';

  const bloodSection = bloodData
    ? `【最新の血液検査データ】（${bloodData.testDate}）
- HbA1c：${bloodData.hbA1c ?? '-'}%
- 総コレステロール：${bloodData.totalCholesterol ?? '-'} mg/dL
- LDLコレステロール：${bloodData.ldlCholesterol ?? '-'} mg/dL
- HDLコレステロール：${bloodData.hdlCholesterol ?? '-'} mg/dL
- 中性脂肪：${bloodData.triglycerides ?? '-'} mg/dL
- BNP：${bloodData.bnp ?? '-'} pg/mL
- クレアチニン：${bloodData.creatinine ?? '-'} mg/dL
- ヘモグロビン：${bloodData.hemoglobin ?? '-'} g/dL`
    : '【最新の血液検査データ】\n記録なし';

  const latestCpx = bloodData?.cpxTests?.[0] ?? null;
  const cpxSection = latestCpx
    ? `【最新のCPX（心肺運動負荷試験）データ】（${latestCpx.testDate}）
- AT中VO2：${latestCpx.atDuring ?? '-'} ml/min/kg
- 最大負荷時VO2：${latestCpx.vo2 ?? '-'} ml/min/kg
- METs：${latestCpx.mets ?? '-'}
- 最大負荷量：${latestCpx.loadWeight ?? '-'} W`
    : '【CPX検査データ】\n記録なし';

  return `${profileSection}

${recordsSection}

${bloodSection}

${cpxSection}

【依頼内容】
上記のデータを元に、今週の健康状態の振り返りと来週に向けた具体的なアドバイスをしてください。
特に気になる点があれば優先的に教えてください。`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const userId = auth.userId;

    // 直近7日分の健康記録を取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const [profile, healthRecords, bloodData] = await Promise.all([
      prisma.profile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          age: true,
          gender: true,
          height: true,
          targetWeight: true,
          diseases: true,
          riskFactors: true,
          medications: true,
          physicalFunction: true,
        },
      }),
      prisma.healthRecord.findMany({
        where: { userId, date: { gte: sevenDaysAgoStr } },
        orderBy: { date: 'desc' },
        take: 14,
        select: {
          date: true,
          time: true,
          bloodPressureSystolic: true,
          bloodPressureDiastolic: true,
          pulse: true,
          weight: true,
          exercise: true,
          meal: true,
          dailyLife: true,
          medicationTaken: true,
        },
      }),
      prisma.bloodData.findFirst({
        where: { userId },
        orderBy: { testDate: 'desc' },
        select: {
          testDate: true,
          hbA1c: true,
          totalCholesterol: true,
          ldlCholesterol: true,
          hdlCholesterol: true,
          triglycerides: true,
          bnp: true,
          creatinine: true,
          hemoglobin: true,
          cpxTests: {
            orderBy: { testDate: 'desc' },
            take: 1,
            select: {
              testDate: true,
              atDuring: true,
              vo2: true,
              mets: true,
              loadWeight: true,
            },
          },
        },
      }),
    ]);

    const userPrompt = buildUserPrompt({ profile, healthRecords, bloodData });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const advice = completion.choices[0]?.message?.content ?? 'アドバイスを生成できませんでした。';

    return NextResponse.json({ advice }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ AI Health Guidance API Error:', message);
    return NextResponse.json({ error: 'アドバイスの生成に失敗しました' }, { status: 500 });
  }
}
