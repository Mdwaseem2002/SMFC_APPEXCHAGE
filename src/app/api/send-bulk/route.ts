// src/app/api/send-bulk/route.ts
// Bulk WhatsApp template message sender with rate limiting
// Respects Meta rate limit: max 1000 messages per minute

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import MessageModel from '@/models/Message';
import ConversationModel from '@/models/Conversation';
import { MessageStatus } from '@/types';

interface BulkContact {
  phone: string;
  templateName: string;
  language: string;
  parameters?: string[];
  headerImageUrl?: string;
}

interface BulkResult {
  phone: string;
  wamid: string | null;
  success: boolean;
  error?: string;
}

// Rate limit: 1000 messages per minute = ~60ms between messages
const RATE_LIMIT_BATCH_SIZE = 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const DELAY_BETWEEN_MESSAGES_MS = Math.ceil(RATE_LIMIT_WINDOW_MS / RATE_LIMIT_BATCH_SIZE); // ~60ms

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    // ----- Parse & Validate Payload -----
    const body = await request.json();
    const { contacts } = body as { contacts: BulkContact[] };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty contacts array. Payload must be { contacts: [...] }' },
        { status: 400 }
      );
    }

    // ----- Env Vars -----
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error('[send-bulk] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
      return NextResponse.json(
        { error: 'Server configuration error: WhatsApp credentials not configured' },
        { status: 500 }
      );
    }

    console.log(`[send-bulk] Processing ${contacts.length} contacts`);

    // ----- Send Messages with Rate Limiting -----
    const results: BulkResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Validate individual contact
      if (!contact.phone || !contact.templateName) {
        results.push({
          phone: contact.phone || 'unknown',
          wamid: null,
          success: false,
          error: 'Missing phone or templateName',
        });
        failCount++;
        continue;
      }

      // Format phone number (remove non-digits)
      const formattedPhone = contact.phone.replace(/[^0-9]/g, '');

      // Build template components
      const templateComponents: Array<Record<string, unknown>> = [];
      
      // 1. Check for Header Media
      if (contact.headerImageUrl) {
        templateComponents.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: {
                link: contact.headerImageUrl
              }
            }
          ]
        });
      }

      // 2. Check for Body Text
      if (contact.parameters && contact.parameters.length > 0) {
        templateComponents.push({
          type: 'body',
          parameters: contact.parameters.map((param) => ({
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
          name: contact.templateName,
          language: {
            code: contact.language || 'en',
          },
          ...(templateComponents.length > 0 && { components: templateComponents }),
        },
      };

      try {
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
          console.error(`[send-bulk] Failed for ${formattedPhone}:`, JSON.stringify(errorData));
          results.push({
            phone: formattedPhone,
            wamid: null,
            success: false,
            error: errorData?.error?.message || 'Meta API error',
          });
          failCount++;
        } else {
          const data = await response.json();
          const wamid = data.messages?.[0]?.id || null;
          results.push({
            phone: formattedPhone,
            wamid,
            success: true,
          });
          successCount++;

          // ----- Save to MongoDB & Emit SSE -----
          if (wamid) {
            try {
              await connectMongoDB();
              const normalizedPhone = formattedPhone.replace(/^\+/, '');
              
              const paramText = contact.parameters && contact.parameters.length > 0 
                ? ` [Params: ${contact.parameters.join(', ')}]` : '';
              const bodyContent = `[Template: ${contact.templateName}]${paramText}`;

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

              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              fetch(`${appUrl}/api/messages/stream`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  "x-internal-secret": process.env.JWT_SECRET || 'fallback-secret'
                },
                body: JSON.stringify({
                  phoneNumber: normalizedPhone,
                  message: messageData
                })
              }).catch(err => console.error('[send-bulk] SSE emit failed:', err));
            } catch (dbError) {
              console.error(`[send-bulk] Error saving to MongoDB for ${formattedPhone}:`, dbError);
            }
          }
        }
      } catch (sendError) {
        console.error(`[send-bulk] Exception for ${formattedPhone}:`, sendError);
        results.push({
          phone: formattedPhone,
          wamid: null,
          success: false,
          error: String(sendError),
        });
        failCount++;
      }

      // Rate limiting: delay between messages (skip delay on last message)
      if (i < contacts.length - 1) {
        await delay(DELAY_BETWEEN_MESSAGES_MS);
      }

      // Log progress every 100 messages
      if ((i + 1) % 100 === 0) {
        console.log(`[send-bulk] Progress: ${i + 1}/${contacts.length} processed`);
      }
    }

    console.log(`[send-bulk] Complete: ${successCount} success, ${failCount} failed out of ${contacts.length} total`);

    return NextResponse.json({
      total: contacts.length,
      success: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('[send-bulk] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
