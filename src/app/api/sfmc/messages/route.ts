// src/app/api/sfmc/messages/route.ts
// Fetches messages from SFMC Data Extensions:
//   WhatsApp_Sent_Messages (outbound from Journey Builder)
//   WhatsApp_Received_Messages (inbound replies to SFMC messages)

import { NextRequest, NextResponse } from 'next/server';
import { getSfmcAccessToken, invalidateSfmcToken } from '@/lib/sfmcAuth';

interface SfmcMessage {
  id: string;
  direction: 'sent' | 'received';
  body: string;
  timestamp: string;
  contactKey: string;
  journeyName: string;
  templateName: string;
  status: string;
  source: 'sfmc';
  // Extra fields for the analytics table
  language?: string;
  parameters?: string;
  phone?: string;
  contactName?: string;
  messageType?: string;
  wamid?: string;
}

async function fetchDeRows(deKey: string, accessToken: string): Promise<any[]> {
  const restBase = (process.env.SFMC_REST_BASE_URI || '').replace(/\/$/, '');
  if (!restBase) throw new Error('SFMC_REST_BASE_URI not configured');

  // Use the Data Extension rowset endpoint
  const url = `${restBase}/data/v1/customobjectdata/key/${deKey}/rowset?$pageSize=2500`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    invalidateSfmcToken();
    throw new Error('SFMC token expired');
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`[SFMC Messages] Failed to fetch ${deKey}:`, response.status, text);
    throw new Error(`SFMC DE fetch failed (${response.status})`);
  }

  const data = await response.json();
  return data.items || [];
}

function getFieldValue(row: any, fieldName: string): string {
  const lowerKey = fieldName.toLowerCase();
  
  const searchObj = (obj: any) => {
    if (!obj) return null;
    const key = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return key ? obj[key] : null;
  };

  return searchObj(row.keys) || searchObj(row.values) || searchObj(row) || '';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactKey = searchParams.get('contactKey');

    const { access_token } = await getSfmcAccessToken();

    // Fetch both DEs in parallel
    const [sentRows, receivedRows] = await Promise.all([
      fetchDeRows('WhatsApp_Sent_Messages', access_token).catch(err => {
        console.error('[SFMC Messages] Sent DE error:', err.message);
        return [];
      }),
      fetchDeRows('WhatsApp_Received_Messages', access_token).catch(err => {
        console.error('[SFMC Messages] Received DE error:', err.message);
        return [];
      }),
    ]);

    // Transform sent messages
    const sentMessages: SfmcMessage[] = sentRows.map((row: any, i: number) => {
      const phone = getFieldValue(row, 'Phone');
      const wamid = getFieldValue(row, 'WaMid');
      return {
        id: wamid || `sfmc-sent-${i}`,
        direction: 'sent' as const,
        body: getFieldValue(row, 'MessageContent') || `[Template: ${getFieldValue(row, 'TemplateName')}]`,
        timestamp: getFieldValue(row, 'SentTime') || new Date().toISOString(),
        contactKey: getFieldValue(row, 'ContactKey') || phone,
        journeyName: getFieldValue(row, 'JourneyName') || '',
        templateName: getFieldValue(row, 'TemplateName') || '',
        status: getFieldValue(row, 'Status') || 'sent',
        source: 'sfmc' as const,
        language: getFieldValue(row, 'Language'),
        parameters: getFieldValue(row, 'Parameters'),
        phone,
        wamid,
      };
    });

    // Transform received messages
    const receivedMessages: SfmcMessage[] = receivedRows.map((row: any, i: number) => {
      const phone = getFieldValue(row, 'Phone');
      const wamid = getFieldValue(row, 'WaMid');
      return {
        id: wamid || `sfmc-recv-${i}`,
        direction: 'received' as const,
        body: getFieldValue(row, 'MessageContent') || '',
        timestamp: getFieldValue(row, 'ReceivedTime') || new Date().toISOString(),
        contactKey: getFieldValue(row, 'ContactName') || phone,
        journeyName: '',
        templateName: '',
        status: 'received',
        source: 'sfmc' as const,
        phone,
        contactName: getFieldValue(row, 'ContactName'),
        messageType: getFieldValue(row, 'MessageType'),
        wamid,
      };
    });

    let allMessages = [...sentMessages, ...receivedMessages];

    // Filter by contact key if provided (match on phone or contactKey)
    if (contactKey) {
      const normalized = contactKey.replace(/[^0-9]/g, '');
      allMessages = allMessages.filter(m => {
        const mPhone = (m.phone || m.contactKey || '').replace(/[^0-9]/g, '');
        return mPhone.includes(normalized) || normalized.includes(mPhone);
      });
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      messages: allMessages,
      sentCount: sentMessages.length,
      receivedCount: receivedMessages.length,
      totalCount: allMessages.length,
    });
  } catch (error: any) {
    console.error('[SFMC Messages] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch SFMC messages', messages: [] },
      { status: 500 }
    );
  }
}
