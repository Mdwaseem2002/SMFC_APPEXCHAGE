import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import AutomationExecution from '@/models/AutomationExecution';

// Default SFMC user ID — auth bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongoDB();

    const executions = await AutomationExecution.find({ journeyId: id, userId: SFMC_USER_ID })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      data: executions.map((doc: any) => ({
        id: doc._id.toString(),
        contactName: doc.contactName,
        contactPhone: doc.contactPhone,
        currentNodeId: doc.currentNodeId,
        status: doc.status,
        executeAt: doc.executeAt,
        executionLog: doc.executionLog,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
