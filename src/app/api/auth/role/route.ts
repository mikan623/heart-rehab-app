import { NextRequest, NextResponse } from "next/server";
import prisma, { ensurePrismaConnection } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return NextResponse.json({ role: user?.role || "patient" });
  } catch (e: any) {
    console.error("❌ /api/auth/role GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = body?.userId as string | undefined;
    const role = body?.role as string | undefined;

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    if (role !== "patient" && role !== "medical") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { role: true },
    });

    return NextResponse.json({ role: user.role });
  } catch (e: any) {
    console.error("❌ /api/auth/role POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


