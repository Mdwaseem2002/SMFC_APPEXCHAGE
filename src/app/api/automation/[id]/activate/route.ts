import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongodb';
import AutomationJourney from '@/models/AutomationJourney';
import AutomationExecution from '@/models/AutomationExecution';
import mongoose from 'mongoose';
import WorkspaceContact from '@/models/WorkspaceContact';

// Default SFMC user ID — auth bypassed
const SFMC_USER_ID = 'sfmc-default-user';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongoDB();

    const journey = await AutomationJourney.findOne({ _id: id, userId: SFMC_USER_ID });
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 });

    // Set journey active
    journey.status = 'active';
    await journey.save();

    // Find the trigger node
    const triggerNode = journey.nodes.find((n: any) => n.type === 'contact_created' || n.type === 'message_received' || n.type === 'manual');
    if (!triggerNode) return NextResponse.json({ error: 'No trigger node found' }, { status: 400 });

    // Get workspace and filters from trigger config
    const wsId = triggerNode.config?.workspaceId || journey.workspaceId;
    const filters: any[] = triggerNode.config?.filters || [];
    const logic: string = triggerNode.config?.logic || 'AND';

    // Fetch contacts
    const contactFilter: any = { userId: SFMC_USER_ID };
    if (wsId) contactFilter.workspaceId = wsId;
    
    // Explicitly use the UserWorkspaceContact model to match the schema
    const UserWorkspaceContact = mongoose.models.UserWorkspaceContact || WorkspaceContact;
    const allContacts = await UserWorkspaceContact.find(contactFilter).lean();

    // Apply entry filters
    const matchedContacts = filters.length === 0 ? allContacts : allContacts.filter((contact: any) => {
      const evalFilter = (f: any) => {
        if (!f.field || !f.operator) return true;
        let val = '';
        if (f.field === 'tags') val = (contact.tags || []).join(',').toLowerCase();
        else if (f.field === 'phoneNumber') val = String(contact.phoneNumber || '').toLowerCase();
        else val = String(contact[f.field] || '').toLowerCase();
        const target = String(f.value || '').toLowerCase();
        switch (f.operator) {
          case 'equals': return val === target;
          case 'contains': return val.includes(target);
          case 'starts_with': return val.startsWith(target);
          default: return true;
        }
      };
      return logic === 'AND' ? filters.every(evalFilter) : filters.some(evalFilter);
    });

    // Find first executable node (follow edge from trigger)
    const firstEdge = journey.edges.find((e: any) => e.from === triggerNode.id);
    const firstNodeId = firstEdge?.to || triggerNode.id;

    // Create execution records
    const execDocs = matchedContacts.map((c: any) => ({
      journeyId: id,
      contactId: c._id.toString(),
      contactPhone: c.phoneNumber,
      contactName: c.name || '',
      workspaceId: wsId || '',
      userId: SFMC_USER_ID,
      currentNodeId: firstNodeId,
      status: 'pending',
      executeAt: new Date(),
      executionLog: [{ nodeId: triggerNode.id, nodeType: triggerNode.type, executedAt: new Date(), result: 'triggered' }],
    }));

    if (execDocs.length > 0) {
      await AutomationExecution.insertMany(execDocs);
    }

    return NextResponse.json({ success: true, contactsEnrolled: execDocs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
