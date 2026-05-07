import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });

    const { name, email, category, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "必須項目が不足しています。" },
        { status: 400 }
      );
    }

    const saved = await prisma.contactMessage.create({
      data: {
        name,
        email,
        category: category || "general",
        message,
      },
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

