import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { contactSchema, parseBody } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const parsed = await parseBody(request, contactSchema);
    if (parsed.error) return parsed.error;
    const { name, email, category, message } = parsed.data;

    const saved = await prisma.contactMessage.create({
      data: { name, email, category, message },
    });

    console.log("📩 お問い合わせ受信:", saved.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("❌ お問い合わせ処理エラー:", error);
    return NextResponse.json(
      { error: "お問い合わせの送信に失敗しました。" },
      { status: 500 }
    );
  }
}
