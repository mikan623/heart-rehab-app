import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, message, accessToken } = await request.json();

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    } else {
      throw new Error('LINE API request failed');
    }
  } catch (error) {
    console.error('LINE API Error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}