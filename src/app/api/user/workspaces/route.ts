import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import Workspace from '@/models/Workspace';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await connectMongoDB();

    const workspace = await Workspace.create({
      userId: SFMC_USER_ID,
      name: body.name,
      color: body.color || '#3b82f6',
      icon: body.icon || 'Building2',
    });

    const doc = workspace.toObject() as any;
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
    const result = await Workspace.findOneAndDelete({ _id: id, userId: SFMC_USER_ID });
    if (!result) return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
