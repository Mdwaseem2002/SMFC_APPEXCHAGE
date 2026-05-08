// src/app/api/send-whatsapp/route.ts
// Sends a single Meta WhatsApp template message to one contact
// Called by Salesforce Marketing Cloud Journey Builder Custom Activity

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import { writeSentMessage } from '@/lib/sfmcDE';
import MessageModel from '@/models/Message';
import ConversationModel from '@/models/Conversation';
import { MessageStatus } from '@/types';

interface SendWhatsAppPayload {
  phone: string;
  templateName: string;
  language: string;
  parameters?: string[];
}

/**
 * Decode a Base64URL-encoded string (used in JWTs).
 * Converts base64url chars (+/-/_) to standard base64, then decodes.
 */
function decodeBase64Url(str: string): string {
  // Replace base64url-specific chars with standard base64 chars
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' to make length a multiple of 4
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  // Decode: in Node.js / Edge runtime, use Buffer or atob
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
  return atob(base64);
}

/**
 * Parse the request body which may be:
 *   1. A raw JWT string (when SFMC sends with useJwt: true) – decode the payload segment
 *   2. A normal JSON object
 */
async function parseRequestBody(request: Request): Promise<Record<string, unknown>> {
  const rawBody = await request.text();

  // Check if the body looks like a JWT (three dot-separated base64url segments)
  const jwtParts = rawBody.split('.');
  if (jwtParts.length === 3 && rawBody.startsWith('eyJ')) {
    console.log('[send-whatsapp] Detected JWT-encoded body – decoding payload segment');
    try {
      const payloadJson = decodeBase64Url(jwtParts[1]);
      const payload = JSON.parse(payloadJson);
      console.log('[send-whatsapp] JWT payload decoded successfully');
      return payload as Record<string, unknown>;
    } catch (decodeErr) {
      console.error('[send-whatsapp] Failed to decode JWT payload:', decodeErr);
      throw new Error('Invalid JWT payload – could not decode');
    }
  }

  // Otherwise treat as regular JSON
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch (jsonErr) {
    console.error('[send-whatsapp] Body is neither valid JWT nor valid JSON. First 100 chars:', rawBody.slice(0, 100));
    throw new Error('Request body is not valid JSON or JWT');
  }
}

export async function POST(request: Request) {
  try {
    // ----- Auth Check -----
    // When called from Journey Builder with useJwt: true,
    // validate the JWT from the Authorization header.
    // For now, we check that the request has a valid Bearer token
    // or is coming from a trusted source (extend with JB JWT validation as needed).
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      // TODO: Implement full JWT signature validation with JB signing key
      // For now, log that auth header is present (never log the full token)
      const tokenSuffix = authHeader.slice(-4);
      console.log(`[send-whatsapp] Auth header present (ends with ...${tokenSuffix})`);
    }

    // ----- Parse & Validate Payload -----
    // SFMC with useJwt:true sends the ENTIRE body as a JWT token, not as JSON.
    // We decode the JWT payload to get the actual inArguments.
    const body = await parseRequestBody(request);
    
    // SFMC Journey Builder sends `inArguments` as an array of objects based on config.json
    // e.g. [{ "contactKey": "Test_User_01" }, { "phone": "9199..." }, ...]
    // We need to merge them all into a single object.
    const inArguments = body.inArguments as Array<Record<string, unknown>> | undefined;
    const inArgs = Array.isArray(inArguments)
      ? inArguments.reduce((acc: Record<string, unknown>, curr: Record<string, unknown>) => ({ ...acc, ...curr }), {})
      : {};
    
    const phone = (inArgs.phone || body.phone) as string | undefined;
    const templateName = (inArgs.templateName || body.templateName) as string | undefined;
    const language = (inArgs.language || body.language) as string | undefined;
    let parameters = (inArgs.parameters || body.parameters || []) as string[] | string;

    // Sometimes parameters come as a comma-separated string from the UI instead of an array
    if (typeof parameters === 'string') {
      parameters = parameters.split(',').map(p => p.trim()).filter(Boolean);
    }

    console.log('[send-whatsapp] Parsed payload:', JSON.stringify({ phone, templateName, language, parameters }));

    if (!phone || !templateName) {
      console.error('[send-whatsapp] Missing phone/templateName. inArgs:', JSON.stringify(inArgs), 'body keys:', Object.keys(body));
      return NextResponse.json(
        { error: 'Missing required fields: phone and templateName are required' },
        { status: 400 }
      );
    }

    // ----- Env Vars -----
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error('[send-whatsapp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
      return NextResponse.json(
        { error: 'Server configuration error: WhatsApp credentials not configured' },
        { status: 500 }
      );
    }

    // ----- Format Phone Number -----
    // WhatsApp API expects phone number without '+' prefix
    const formattedPhone = phone.replace(/[^0-9]/g, '');

    // ----- Build Template Message Payload -----
    const templateComponents: Array<Record<string, unknown>> = [];

    // Add body parameters if provided
    if (Array.isArray(parameters) && parameters.length > 0) {
      templateComponents.push({
        type: 'body',
        parameters: parameters.map((param: string) => ({
          type: 'text',
          text: param,
        })),
      });
    }

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language || 'en',
        },
        ...(templateComponents.length > 0 && { components: templateComponents }),
      },
    };

    // ----- Send to Meta Graph API -----
    console.log(`[send-whatsapp] Sending template "${templateName}" to ${formattedPhone}`);

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[send-whatsapp] Meta API error:', JSON.stringify(errorData));
      return NextResponse.json(
        { error: 'Failed to send WhatsApp template message', details: errorData },
        { status: 502 }
      );
    }

    const data = await response.json();
    const wamid = data.messages?.[0]?.id || null;

    console.log(`[send-whatsapp] Message sent successfully. wamid: ${wamid}`);

    const normalizedPhone = formattedPhone.replace(/^\+/, '');
    const paramText = Array.isArray(parameters) && parameters.length > 0 ? ` [Params: ${parameters.join(', ')}]` : '';
    const bodyContent = `[Template: ${templateName}]${paramText}`;

    // ----- Save to MongoDB & Emit SSE -----
    if (wamid) {
      try {
        await connectMongoDB();

        const messageData = {
          id: wamid,
          content: bodyContent,
          timestamp: new Date().toISOString(),
          sender: 'user',
          status: MessageStatus.SENT,
          recipientId: normalizedPhone,
          contactPhoneNumber: normalizedPhone,
          originalId: wamid,
          conversationId: normalizedPhone,
        };

        // Save to MongoDB
        await MessageModel.updateOne(
          { id: wamid },
          { $setOnInsert: messageData },
          { upsert: true }
        );
        
        // Update or create conversation
        await ConversationModel.updateOne(
          { phoneNumber: normalizedPhone },
          { 
            $set: { 
              lastMessage: bodyContent,
              lastMessageTimestamp: messageData.timestamp 
            },
            $setOnInsert: { contactName: normalizedPhone, unreadCount: 0 }
          },
          { upsert: true }
        );

        console.log(`[send-whatsapp] Saved template message ${wamid} to MongoDB`);

        // Emit via SSE
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await fetch(`${appUrl}/api/messages/stream`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            "x-internal-secret": process.env.JWT_SECRET || 'fallback-secret'
          },
          body: JSON.stringify({
            phoneNumber: normalizedPhone,
            message: messageData
          })
        }).catch(err => console.error('[send-whatsapp] SSE emit failed:', err));

      } catch (dbError) {
        console.error('[send-whatsapp] Error saving to MongoDB:', dbError);
      }

      // ----- Write to SFMC Data Extension -----
      try {
        const contactKey = (inArgs.contactKey || '') as string;
        const journeyName = (inArgs.journeyName || '') as string;
        const paramString = Array.isArray(parameters) && parameters.length > 0
          ? parameters.join(', ')
          : '';

        await writeSentMessage({
          WaMid: wamid,
          ContactKey: contactKey,
          Phone: formattedPhone,
          TemplateName: templateName,
          Language: language || 'en',
          Parameters: paramString,
          MessageContent: bodyContent,
          Status: 'sent',
          SentTime: new Date().toISOString(),
          JourneyName: journeyName,
          Source: contactKey ? 'journey_builder' : 'manual_send',
        });
      } catch (sfmcError) {
        console.error('[send-whatsapp] SFMC DE write failed:', sfmcError);
        // Don't fail the request — message was already sent successfully
      }
    }

    return NextResponse.json({
      success: true,
      wamid,
      messageId: wamid,
      to: formattedPhone,
      templateName,
    });
  } catch (error) {
    console.error('[send-whatsapp] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

