import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import UserProfile from '@/models/UserProfile';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceContact from '@/models/WorkspaceContact';
import FastReply from '@/models/FastReply';

// Default SFMC user ID — used when auth is bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function GET(request: NextRequest) {
  try {
    // Auth bypassed — SFMC integration handles identity
    const userId = SFMC_USER_ID;

    await connectMongoDB();

    // Fetch all user data in parallel (including the auth User for email/name)
    const [profile, user, workspaces, contacts, fastReplies] = await Promise.all([
      UserProfile.findOne({ userId }).lean(),
      User.findById(userId).lean().catch(() => null),
      Workspace.find({ userId }).sort({ createdAt: 1 }).lean(),
      WorkspaceContact.find({ userId }).sort({ createdAt: -1 }).lean(),
      FastReply.find({ userId }).sort({ shortcut: 1 }).lean(),
    ]);

    // Format IDs for frontend
    const formatDocs = (docs: any[]) => docs.map(doc => ({ ...doc, id: doc._id.toString(), _id: undefined, __v: undefined }));

    // Build profile data, merging auth user data for name/email
    let profileData = null;
    if (profile) {
      profileData = { ...profile, id: (profile as any)._id?.toString(), _id: undefined, __v: undefined };
      // Merge auth user's email and name if the profile doesn't have them set
      if (user) {
        if (!profileData.email) profileData.email = (user as any).email || '';
        if (!profileData.name) profileData.name = (user as any).name || '';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: profileData,
        workspaces: formatDocs(workspaces),
        contacts: formatDocs(contacts),
        fastReplies: formatDocs(fastReplies),
      }
    });

  } catch (error: any) {
    console.error('[User Sync] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
