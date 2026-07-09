import { NextResponse } from 'next/server';
import { writeSentMessage } from '@/lib/sfmcDE';
import connectMongoDB from '@/lib/mongodb';
import MessageModel from '@/models/Message';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, message, mediaId, mediaType, mimeType, filename, localId } = body;

    // Always prefer server-side env (updated in real-time via /api/save-env)
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || body.accessToken;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || body.phoneNumberId;

    if (!to || (!message && !mediaId) || !accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Format the phone number to remove '+' if present, as WhatsApp API expects it without '+'
    const formattedPhone = to.replace('+', '');

    // Construct Meta payload
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
    };

    if (mediaId && mediaType) {
      payload.type = mediaType;
      payload[mediaType] = { id: mediaId };
      if (message) {
        payload[mediaType].caption = message;
      }
      if (filename && mediaType === 'document') {
        payload[mediaType].filename = filename;
      }
    } else {
      payload.type = 'text';
      payload.text = { preview_url: false, body: message || '' };
    }

    // Send message to WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to send message', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const wamid = data?.messages?.[0]?.id;

    if (wamid) {
      const sentMessageData = {
        id: wamid,
        localId,
        content: message || `[Media: ${mediaType}]`,
        timestamp: new Date().toISOString(),
        sender: 'user',
        status: 'sent',
        recipientId: formattedPhone,
        contactPhoneNumber: formattedPhone,
      };

      // Write to SFMC Data Extension
      try {
        await writeSentMessage({
          WaMid: wamid,
          Phone: formattedPhone,
          MessageContent: message || `[Media: ${mediaType}]`,
          Status: 'sent',
          SentTime: new Date().toISOString(),
          Source: 'manual_send',
        });
      } catch (sfmcError) {
        console.error('[send-message] SFMC DE write failed:', sfmcError);
      }

      // Write directly to MongoDB for persistence (bypassing internal HTTP fetch)
      try {
        await connectMongoDB();
        await MessageModel.updateOne(
          { id: wamid },
          { 
            $setOnInsert: {
              id: wamid,
              timestamp: new Date().toISOString(),
              sender: 'user',
              status: 'sent',
              recipientId: formattedPhone,
              contactPhoneNumber: formattedPhone,
              originalId: wamid,
              conversationId: formattedPhone,
            },
            $set: {
              content: message || `[Media: ${mediaType}]`,
              mediaType: mediaType || 'text',
              mediaId: mediaId,
              mimeType: mimeType,
              filename: filename
            }
          },
          { upsert: true }
        );
      } catch (mongoError) {
        console.error('[send-message] Direct MongoDB write failed:', mongoError);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Broadcast via SSE for real-time UI updates
      // Per-phone SSE stream (updates the active chat window)
      fetch(`${appUrl}/api/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.JWT_SECRET || 'fallback-secret',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          message: sentMessageData,
        }),
      }).catch(err => console.error('[send-message] SSE per-phone emit failed:', err));

      // Global SSE stream (updates notifications and other chat views)
      fetch(`${appUrl}/api/messages/stream/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.JWT_SECRET || 'fallback-secret',
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          message: sentMessageData,
        }),
      }).catch(err => console.error('[send-message] SSE global emit failed:', err));
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}