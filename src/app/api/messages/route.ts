// src/app/api/messages/route.ts
import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import MessageModel from '@/models/Message';
import ConversationModel from '@/models/Conversation';
import { Message, MessageStatus } from '@/types';

// Make sure connection is established only once
let isConnected = false;

// Longer timeout threshold
const TIMEOUT_MS = 15000;

// Ensure database connection
async function ensureConnection() {
  if (!isConnected) {
    await connectMongoDB();
    isConnected = true;
  }
}

export async function POST(request: Request) {
  try {
    // Add timeout handling with increased timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timed out')), TIMEOUT_MS);
    });

    const dbOperation = async () => {
      // Ensure connection is established
      await ensureConnection();

      const body = await request.json();
      const { phoneNumber, message } = body;

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return NextResponse.json(
          { error: 'Invalid or missing phone number' },
          { status: 400 }
        );
      }
      
      const normalizedPhone = phoneNumber.replace(/^\+/, '');

      if (!message || typeof message !== 'object') {
        return NextResponse.json(
          { error: 'Invalid or missing message' },
          { status: 400 }
        );
      }

      // Prepare message data
      const messageId = message.id || `generated_${Date.now()}`;
      const messageData: Partial<Message> = {
        id: messageId,
        content: message.text?.body || message.content || '',
        timestamp: message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        sender: message.from === 'user' ? 'user' : 'contact',
        status: message.status || MessageStatus.DELIVERED,
        recipientId: normalizedPhone,
        contactPhoneNumber: normalizedPhone,
        originalId: messageId,
        conversationId: normalizedPhone,
        mediaType: message.mediaType || 'text',
        mediaId: message.mediaId,
        mimeType: message.mimeType,
        filename: message.filename,
        caption: message.caption,
      };

      try {
        const result = await MessageModel.updateOne(
          { id: messageId },
          { 
            $setOnInsert: messageData,
            $set: { status: messageData.status } // Update status on subsequent webhook hits
          }, 
          { upsert: true, lean: true }
        );

        // Update or create conversation
        await ConversationModel.updateOne(
          { phoneNumber: normalizedPhone },
          { 
            $set: { 
              lastMessage: messageData.content,
              lastMessageTimestamp: messageData.timestamp 
            },
            $setOnInsert: { contactName: normalizedPhone, unreadCount: 0 }
          },
          { upsert: true }
        );

        // Send response for webhook
        return NextResponse.json({
          success: true,
          message: messageData,
          operation: result.upsertedId ? 'created' : 'exists',
        });
      } catch (saveError: unknown) {
        if (typeof saveError === 'object' && saveError !== null && 'code' in saveError) {
          const errorWithCode = saveError as { code: number };
          if (errorWithCode.code === 11000) {
            return NextResponse.json(
              { error: 'Duplicate message', success: false },
              { status: 409 }
            );
          }
        }

        if (saveError instanceof Error) {
          console.error('Message Save Error:', saveError);
          return NextResponse.json(
            {
              error: 'Error saving message',
              success: false,
              details: saveError.message,
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: 'Unknown error occurred', success: false },
          { status: 500 }
        );
      }
    };

    // Race between database operation and timeout
    return await Promise.race([dbOperation(), timeoutPromise]);
  } catch (error: unknown) {
    console.error('Message Storage Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Add timeout handling with increased timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timed out')), TIMEOUT_MS);
    });

    const dbOperation = async () => {
      // Ensure connection is established
      await ensureConnection();

      const { searchParams } = new URL(request.url);
      const phoneNumber = searchParams.get('phoneNumber');
      const conversationId = searchParams.get('conversationId') || phoneNumber;
      const afterTimestamp = searchParams.get('afterTimestamp');
      
      // Add limit parameter with a reasonable default
      const limit = Number(searchParams.get('limit') || '500');

      if (!conversationId || typeof conversationId !== 'string') {
        return NextResponse.json(
          { error: 'Valid conversation ID or phone number is required' },
          { status: 400 }
        );
      }
      
      const normalizedConversationId = conversationId.replace(/^\+/, '');

      // Build robust query that matches on any phone-related field 
      // This ensures old messages stored before conversationId was added are still found
      const phoneQuery = {
        $or: [
          { conversationId: normalizedConversationId },
          { contactPhoneNumber: normalizedConversationId },
          { recipientId: normalizedConversationId }
        ]
      };
      const query: Record<string, unknown> = { ...phoneQuery };
      if (afterTimestamp) {
        query.timestamp = { $gt: new Date(afterTimestamp).toISOString() };
      }

      // Create a more efficient projection to only retrieve needed fields
      const projection = {
        _id: 0,
        id: 1,
        content: 1,
        timestamp: 1, 
        sender: 1,
        status: 1,
        conversationId: 1,
        mediaType: 1,
        mediaId: 1,
        mimeType: 1,
        filename: 1,
        caption: 1
      };

      // Retrieve messages with optimized query
      const messages = await MessageModel.find(query, projection)
        .sort({ timestamp: 1 })
        .limit(limit)
        .lean()
        .exec(); // Add exec() for explicit promise resolution

      return NextResponse.json({
        success: true,
        messages,
        count: messages.length,
      });
    };

    // Race between database operation and timeout
    return await Promise.race([dbOperation(), timeoutPromise]);
  } catch (error: unknown) {
    console.error('Error retrieving messages:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}