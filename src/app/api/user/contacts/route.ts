import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import WorkspaceContact from '@/models/WorkspaceContact';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    await connectMongoDB();
    const filter: any = { userId: SFMC_USER_ID };
    if (workspaceId) filter.workspaceId = workspaceId;

    const contacts = await WorkspaceContact.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      data: contacts.map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
        _id: undefined,
        __v: undefined,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await connectMongoDB();

    const contact = await WorkspaceContact.create({
      userId: SFMC_USER_ID,
      workspaceId: body.workspaceId,
      name: body.name,
      phoneNumber: body.phoneNumber,
      company: body.company,
      email: body.email,
      tags: body.tags || [],
    });

    const doc = contact.toObject() as any;
    return NextResponse.json({ 
      success: true, 
      data: { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined } 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await connectMongoDB();
    const result = await WorkspaceContact.findOneAndDelete({ _id: id, userId: SFMC_USER_ID });
    if (!result) return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await connectMongoDB();
    const updatedContact = await WorkspaceContact.findOneAndUpdate(
      { _id: id, userId: SFMC_USER_ID },
      { $set: updates },
      { new: true }
    );

    if (!updatedContact) return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });

    const doc = updatedContact.toObject() as any;
    return NextResponse.json({ 
      success: true, 
      data: { ...doc, id: doc._id.toString(), _id: undefined, __v: undefined } 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
