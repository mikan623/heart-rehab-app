import { NextRequest, NextResponse } from "next/server";
import prisma, { ensurePrismaConnection } from "@/lib/prisma";
import { getAuthContext } from "@/lib/server-auth";

// 招待リンク作成（患者側）
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    await ensurePrismaConnection();

    const patientId = auth.userId;

    // 認証済みユーザーのみ招待を作成できる
    const user = await prisma.user.findUnique({
      where: { id: patientId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日後

    const invite = await prisma.familyInvite.create({
      data: {
        patientId,
        expiresAt,
      },
    });

    return NextResponse.json({
      inviteId: invite.id,
      expiresAt: invite.expiresAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ FamilyInvite POST error:", error);
    return NextResponse.json(
      { error: "Failed to create invite", details: message },
      { status: 500 }
    );
  }
}

// 招待情報取得（家族側）
export async function GET(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    await ensurePrismaConnection();

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("familyInviteId");

    if (!inviteId) {
      return NextResponse.json(
        { error: "familyInviteId is required" },
        { status: 400 }
      );
    }

    const invite = await prisma.familyInvite.findUnique({
      where: { id: inviteId },
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found", valid: false },
        { status: 404 }
      );
    }

    const now = new Date();
    const isExpired = now > invite.expiresAt;

    return NextResponse.json({
      valid: !invite.used && !isExpired,
      patientId: invite.patientId,
      patientName: invite.patient?.name ?? null,
      expiresAt: invite.expiresAt,
      used: invite.used,
      isExpired,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ FamilyInvite GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite", details: message },
      { status: 500 }
    );
  }
}

// 招待リンクを「使用済み」にする（任意）
export async function PATCH(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    await ensurePrismaConnection();

    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.familyInvite.update({
      where: { id: inviteId },
      data: { used: true },
    });

    return NextResponse.json({ success: true, inviteId: updated.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ FamilyInvite PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update invite", details: message },
      { status: 500 }
    );
  }
}










