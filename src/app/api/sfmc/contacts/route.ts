import { NextResponse } from 'next/server';
import { getSfmcAccessToken } from '@/lib/sfmcAuth';

export async function POST(request: Request) {
  try {
    const { name, phoneNumber } = await request.json();

    if (!name || !phoneNumber) {
      return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
    }

    const sfmcRestBaseUri = process.env.SFMC_REST_BASE_URI;
    if (!sfmcRestBaseUri) {
      return NextResponse.json({ error: 'SFMC API not configured' }, { status: 500 });
    }

    const { access_token } = await getSfmcAccessToken();
    const baseUri = sfmcRestBaseUri.replace(/\/$/, '');
    
    // Write directly to the WhatsApp_Test_Audience Data Extension
    const url = `${baseUri}/hub/v1/dataevents/key:WhatsApp_Test_Audience/rowset`;

    const payload = [
      {
        keys: { ContactKey: name },
        values: { MobilePhone: phoneNumber },
      },
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SFMC Contacts] Upsert failed (${response.status}):`, errorText);
      return NextResponse.json({ error: 'SFMC write failed', details: errorText }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in /api/sfmc/contacts:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
