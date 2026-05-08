import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import AutomationJourney from '@/models/AutomationJourney';

// Default SFMC user ID — auth bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongoDB();
    const journey = await AutomationJourney.findOne({ _id: id, userId: SFMC_USER_ID }).lean();
    if (!journey) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const doc = journey as any;
    return NextResponse.json({
      success: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId,
        workspaceId: doc.workspaceId,
        name: doc.name,
        status: doc.status,
        nodes: doc.nodes,
        edges: doc.edges,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await connectMongoDB();

    const updated = await AutomationJourney.findOneAndUpdate(
      { _id: id, userId: SFMC_USER_ID },
      { $set: body },
      { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const doc = updated as any;
    return NextResponse.json({
      success: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId,
        workspaceId: doc.workspaceId,
        name: doc.name,
        status: doc.status,
        nodes: doc.nodes,
        edges: doc.edges,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongoDB();

    const result = await AutomationJourney.findOneAndDelete({ _id: id, userId: SFMC_USER_ID });
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
