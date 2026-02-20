import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/server-auth';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out' }, { status: 200 });
  clearAuthCookie(response);
  return response;
}
