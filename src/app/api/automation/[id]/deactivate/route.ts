import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import AutomationJourney from '@/models/AutomationJourney';
import AutomationExecution from '@/models/AutomationExecution';

// Default SFMC user ID — auth bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongoDB();

    await AutomationJourney.findOneAndUpdate(
      { _id: id, userId: SFMC_USER_ID },
      { $set: { status: 'draft' } }
    );

    // Cancel all pending executions
    await AutomationExecution.updateMany(
      { journeyId: id, status: 'pending' },
      { $set: { status: 'failed' } }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
