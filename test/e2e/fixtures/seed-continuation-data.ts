/**
 * Seed Test Database with Continuation Chain Data
 *
 * Creates realistic continuation chains for E2E tests:
 * - Linear chains (session A → B → C)
 * - Branching chains (session A → B → [C1, C2])
 * - Orphaned sessions (for healing tests)
 *
 * Run this during E2E global setup to populate test database.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface SessionMessage {
  type: 'user' | 'assistant';
  parentUuid?: string;
  sessionId: string;
  uuid: string;
  timestamp: string;
  message: {
    role: 'user' | 'assistant';
    content: Array<{ type: 'text'; text: string }>;
  };
}

/**
 * Creates a JSONL session file with continuation metadata
 */
function createSessionFile(options: {
  sessionId: string;
  projectName: string;
  parentSessionId?: string;
  messageCount?: number;
  timestamp?: Date;
  baseDir?: string;
}): string {
  const {
    sessionId,
    projectName,
    parentSessionId,
    messageCount = 10,
    timestamp = new Date(),
    baseDir,
  } = options;

  const projectPath = baseDir
    ? path.join(baseDir, projectName)
    : path.join(process.env.HOME!, '.claude', 'projects', projectName);

  // Create project directory if it doesn't exist
  fs.mkdirSync(projectPath, { recursive: true });

  const messages: any[] = [];
  let previousUuid: string | undefined;

  // CRITICAL: For child sessions, add compact_boundary event at the start
  // This is how continuation detection works - it looks for compact_boundary events
  // where event.sessionId differs from the filename's session ID
  if (parentSessionId) {
    messages.push({
      type: 'system',
      subtype: 'compact_boundary',
      sessionId: parentSessionId, // Parent's session ID (the key!)
      uuid: randomUUID(),
      timestamp: new Date(timestamp.getTime() - 1000).toISOString(), // 1 second before first message
      content: `Context window approaching limit. Continuing in new session: ${sessionId}`,
    });
  }

  // Create initial user message
  messages.push({
    type: 'user',
    sessionId,
    uuid: randomUUID(),
    timestamp: new Date(timestamp.getTime()).toISOString(),
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: parentSessionId
            ? `This is a continuation of session ${parentSessionId}. Please help me continue this work.`
            : 'This is the start of a new conversation.',
        },
      ],
    },
  });

  previousUuid = messages[messages.length - 1].uuid;

  // Create alternating user/assistant messages
  for (let i = 1; i < messageCount; i++) {
    const role = i % 2 === 1 ? 'assistant' : 'user';
    const messageTime = new Date(timestamp.getTime() + i * 60000); // 1 min apart

    const msg: SessionMessage = {
      type: role,
      parentUuid: previousUuid,
      sessionId,
      uuid: randomUUID(),
      timestamp: messageTime.toISOString(),
      message: {
        role,
        content: [
          {
            type: 'text',
            text:
              role === 'user'
                ? `User message ${i} in session ${sessionId}`
                : `Assistant response ${i} in session ${sessionId}. This is a test message for continuation detection.`,
          },
        ],
      },
    };

    messages.push(msg);
    previousUuid = msg.uuid;
  }

  // Write JSONL file (CRITICAL: File must be named <session-id>.jsonl for detection to work)
  const jsonlPath = path.join(projectPath, `${sessionId}.jsonl`);
  const jsonlContent = messages.map((msg) => JSON.stringify(msg)).join('\n');
  fs.writeFileSync(jsonlPath, jsonlContent, 'utf-8');

  return jsonlPath;
}

/**
 * Seed the test database with continuation chains
 */
export async function seedContinuationData(baseDir?: string): Promise<void> {
  console.log('Seeding test database with continuation chains...');

  const testProjectName = 'demo-project';
  // Use VERY RECENT timestamps so sessions appear at top of list
  const baseTimestamp = new Date(Date.now() - 3600000); // 1 hour ago

  // Structure 1: Simple Linear Chain (3 sessions)
  const rootSessionId = randomUUID();
  const chapter2Id = randomUUID();
  const chapter3Id = randomUUID();

  createSessionFile({ baseDir,
    sessionId: rootSessionId,
    projectName: testProjectName,
    messageCount: 15,
    timestamp: new Date(baseTimestamp.getTime()),
  });

  createSessionFile({ baseDir,
    sessionId: chapter2Id,
    projectName: testProjectName,
    parentSessionId: rootSessionId,
    messageCount: 12,
    timestamp: new Date(baseTimestamp.getTime() + 600000), // 10 min later
  });

  createSessionFile({ baseDir,
    sessionId: chapter3Id,
    projectName: testProjectName,
    parentSessionId: chapter2Id,
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 1200000), // 20 min later
  });

  console.log(`✓ Created linear chain: ${rootSessionId} → ${chapter2Id} → ${chapter3Id}`);

  // Structure 3: Branching Chain (1 root, 3 children)
  const branchRootId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const branchCId = randomUUID();

  createSessionFile({ baseDir,
    sessionId: branchRootId,
    projectName: testProjectName,
    messageCount: 20,
    timestamp: new Date(baseTimestamp.getTime() + 1800000), // 30 min later
  });

  createSessionFile({ baseDir,
    sessionId: branchAId,
    projectName: testProjectName,
    parentSessionId: branchRootId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 2400000), // 40 min later
  });

  createSessionFile({ baseDir,
    sessionId: branchBId,
    projectName: testProjectName,
    parentSessionId: branchRootId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 2400000), // 40 min later (same time as branch A)
  });

  createSessionFile({ baseDir,
    sessionId: branchCId,
    projectName: testProjectName,
    parentSessionId: branchRootId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 2400000), // 40 min later (same time as branches A and B)
  });

  console.log(`✓ Created branching chain: ${branchRootId} → [${branchAId}, ${branchBId}, ${branchCId}]`);

  // Structure 2: Deep Linear Chain (7 sessions)
  const deepRootId = randomUUID();
  let deepPreviousId = deepRootId;

  createSessionFile({ baseDir,
    sessionId: deepRootId,
    projectName: testProjectName,
    messageCount: 12,
    timestamp: new Date(baseTimestamp.getTime() + 3000000), // 50 min later
  });

  for (let i = 2; i <= 7; i++) {
    const deepChapterId = randomUUID();
    createSessionFile({ baseDir,
      sessionId: deepChapterId,
      projectName: testProjectName,
      parentSessionId: deepPreviousId,
      messageCount: 12,
      timestamp: new Date(baseTimestamp.getTime() + 3000000 + (i - 1) * 300000), // 5 min apart
    });
    deepPreviousId = deepChapterId;
  }

  console.log(`✓ Created deep linear chain (7 sessions): ${deepRootId} → ... → ${deepPreviousId}`);

  // Structure 4: Complex Tree (multi-level branching)
  const treeRootId = randomUUID();
  const treeBranchAId = randomUUID();
  const treeBranchBId = randomUUID();
  const treeAChild1Id = randomUUID();
  const treeAChild2Id = randomUUID();
  const treeBChild1Id = randomUUID();

  createSessionFile({ baseDir,
    sessionId: treeRootId,
    projectName: testProjectName,
    messageCount: 15,
    timestamp: new Date(baseTimestamp.getTime() + 5000000), // 83 min later
  });

  createSessionFile({ baseDir,
    sessionId: treeBranchAId,
    projectName: testProjectName,
    parentSessionId: treeRootId,
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 5300000),
  });

  createSessionFile({ baseDir,
    sessionId: treeBranchBId,
    projectName: testProjectName,
    parentSessionId: treeRootId,
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 5300000),
  });

  createSessionFile({ baseDir,
    sessionId: treeAChild1Id,
    projectName: testProjectName,
    parentSessionId: treeBranchAId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 5600000),
  });

  createSessionFile({ baseDir,
    sessionId: treeAChild2Id,
    projectName: testProjectName,
    parentSessionId: treeBranchAId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 5600000),
  });

  createSessionFile({ baseDir,
    sessionId: treeBChild1Id,
    projectName: testProjectName,
    parentSessionId: treeBranchBId,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 5600000),
  });

  console.log(`✓ Created complex tree (6 sessions): ${treeRootId} with 2 branches and 3 child nodes`);

  // Structure 5: Orphaned Continuation (child with missing parent)
  const orphanParentId = randomUUID(); // This session will NOT be created
  const orphanChildId = randomUUID();

  createSessionFile({ baseDir,
    sessionId: orphanChildId,
    projectName: testProjectName,
    parentSessionId: orphanParentId, // Parent doesn't exist!
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 6000000),
  });

  console.log(`✓ Created orphaned session: ${orphanChildId} (missing parent: ${orphanParentId})`);

  // Structure 6: Search Match in Chain (with unique search term)
  const searchRootId = randomUUID();
  const searchCh2Id = randomUUID();
  const searchCh3Id = randomUUID();

  createSessionFile({ baseDir,
    sessionId: searchRootId,
    projectName: testProjectName,
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 6500000),
  });

  // Create Chapter 2 with unique search term
  const searchProjectPath = baseDir
    ? path.join(baseDir, testProjectName)
    : path.join(process.env.HOME!, '.claude', 'projects', testProjectName);

  const searchMessages: any[] = [];

  // Add compact_boundary for continuation
  searchMessages.push({
    type: 'system',
    subtype: 'compact_boundary',
    sessionId: searchRootId,
    timestamp: new Date(baseTimestamp.getTime() + 7000000 - 1000).toISOString(),
    uuid: randomUUID(),
    content: `Context window approaching limit. Continuing in new session: ${searchCh2Id}`,
  });

  // Add messages with unique search term
  searchMessages.push({
    type: 'user',
    sessionId: searchCh2Id,
    uuid: randomUUID(),
    timestamp: new Date(baseTimestamp.getTime() + 7000000).toISOString(),
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'This is a continuation. UNIQUE_SEARCH_TERM_12345 can be found here.',
        },
      ],
    },
  });

  for (let i = 1; i < 10; i++) {
    const role = i % 2 === 1 ? 'assistant' : 'user';
    const messageTime = new Date(baseTimestamp.getTime() + 7000000 + i * 60000);

    searchMessages.push({
      type: role,
      parentUuid: searchMessages[searchMessages.length - 1].uuid,
      sessionId: searchCh2Id,
      uuid: randomUUID(),
      timestamp: messageTime.toISOString(),
      message: {
        role,
        content: [
          {
            type: 'text',
            text: `${role === 'user' ? 'User' : 'Assistant'} message ${i} with UNIQUE_SEARCH_TERM_12345`,
          },
        ],
      },
    });
  }

  const searchCh2Path = path.join(searchProjectPath, `${searchCh2Id}.jsonl`);
  fs.writeFileSync(
    searchCh2Path,
    searchMessages.map((msg) => JSON.stringify(msg)).join('\n'),
    'utf-8'
  );

  createSessionFile({ baseDir,
    sessionId: searchCh3Id,
    projectName: testProjectName,
    parentSessionId: searchCh2Id,
    messageCount: 10,
    timestamp: new Date(baseTimestamp.getTime() + 7600000),
  });

  console.log(`✓ Created search chain: ${searchRootId} → ${searchCh2Id} (with UNIQUE_SEARCH_TERM_12345) → ${searchCh3Id}`);

  // Structure 7: Performance Test Chain (20+ sessions)
  const perfRootId = randomUUID();
  let perfPreviousId = perfRootId;

  createSessionFile({ baseDir,
    sessionId: perfRootId,
    projectName: testProjectName,
    messageCount: 50,
    timestamp: new Date(baseTimestamp.getTime() + 8000000),
  });

  for (let i = 2; i <= 20; i++) {
    const perfChapterId = randomUUID();
    createSessionFile({ baseDir,
      sessionId: perfChapterId,
      projectName: testProjectName,
      parentSessionId: perfPreviousId,
      messageCount: 50,
      timestamp: new Date(baseTimestamp.getTime() + 8000000 + (i - 1) * 120000), // 2 min apart
    });
    perfPreviousId = perfChapterId;
  }

  console.log(`✓ Created performance test chain (20 sessions): ${perfRootId} → ... → ${perfPreviousId}`);

  // Structure 8: Mixed Metadata Chain (varying metadata completeness)
  const mixedRootId = randomUUID();
  const mixedCh2Id = randomUUID();
  const mixedCh3Id = randomUUID();

  // Root with no explicit title (will use timestamp fallback)
  createSessionFile({ baseDir,
    sessionId: mixedRootId,
    projectName: testProjectName,
    messageCount: 8,
    timestamp: new Date(baseTimestamp.getTime() + 10000000),
  });

  // Chapter 2 with title-like first message
  const mixedProjectPath = baseDir
    ? path.join(baseDir, testProjectName)
    : path.join(process.env.HOME!, '.claude', 'projects', testProjectName);

  const mixedCh2Messages: any[] = [];

  mixedCh2Messages.push({
    type: 'system',
    subtype: 'compact_boundary',
    sessionId: mixedRootId,
    timestamp: new Date(baseTimestamp.getTime() + 10300000 - 1000).toISOString(),
    uuid: randomUUID(),
    content: `Context window approaching limit. Continuing in new session: ${mixedCh2Id}`,
  });

  mixedCh2Messages.push({
    type: 'user',
    sessionId: mixedCh2Id,
    uuid: randomUUID(),
    timestamp: new Date(baseTimestamp.getTime() + 10300000).toISOString(),
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Build a Todo App with React',
        },
      ],
    },
  });

  for (let i = 1; i < 8; i++) {
    const role = i % 2 === 1 ? 'assistant' : 'user';
    mixedCh2Messages.push({
      type: role,
      parentUuid: mixedCh2Messages[mixedCh2Messages.length - 1].uuid,
      sessionId: mixedCh2Id,
      uuid: randomUUID(),
      timestamp: new Date(baseTimestamp.getTime() + 10300000 + i * 60000).toISOString(),
      message: {
        role,
        content: [
          {
            type: 'text',
            text: `${role === 'user' ? 'User' : 'Assistant'} message ${i}`,
          },
        ],
      },
    });
  }

  const mixedCh2Path = path.join(mixedProjectPath, `${mixedCh2Id}.jsonl`);
  fs.writeFileSync(
    mixedCh2Path,
    mixedCh2Messages.map((msg) => JSON.stringify(msg)).join('\n'),
    'utf-8'
  );

  // Chapter 3 with longer first message (summary-like)
  const mixedCh3Messages: any[] = [];

  mixedCh3Messages.push({
    type: 'system',
    subtype: 'compact_boundary',
    sessionId: mixedCh2Id,
    timestamp: new Date(baseTimestamp.getTime() + 10800000 - 1000).toISOString(),
    uuid: randomUUID(),
    content: `Context window approaching limit. Continuing in new session: ${mixedCh3Id}`,
  });

  mixedCh3Messages.push({
    type: 'user',
    sessionId: mixedCh3Id,
    uuid: randomUUID(),
    timestamp: new Date(baseTimestamp.getTime() + 10800000).toISOString(),
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'This is a much longer first message that includes detailed context about the previous discussion. We were working on building a Todo app with React and had made significant progress on the component structure.',
        },
      ],
    },
  });

  for (let i = 1; i < 8; i++) {
    const role = i % 2 === 1 ? 'assistant' : 'user';
    mixedCh3Messages.push({
      type: role,
      parentUuid: mixedCh3Messages[mixedCh3Messages.length - 1].uuid,
      sessionId: mixedCh3Id,
      uuid: randomUUID(),
      timestamp: new Date(baseTimestamp.getTime() + 10800000 + i * 60000).toISOString(),
      message: {
        role,
        content: [
          {
            type: 'text',
            text: `${role === 'user' ? 'User' : 'Assistant'} message ${i}`,
          },
        ],
      },
    });
  }

  const mixedCh3Path = path.join(mixedProjectPath, `${mixedCh3Id}.jsonl`);
  fs.writeFileSync(
    mixedCh3Path,
    mixedCh3Messages.map((msg) => JSON.stringify(msg)).join('\n'),
    'utf-8'
  );

  console.log(`✓ Created mixed metadata chain: ${mixedRootId} → ${mixedCh2Id} → ${mixedCh3Id}`);

  // Create additional standalone sessions (no continuations)
  for (let i = 0; i < 10; i++) {
    const standaloneId = randomUUID();
    createSessionFile({ baseDir,
      sessionId: standaloneId,
      projectName: testProjectName,
      messageCount: Math.floor(Math.random() * 20) + 5,
      timestamp: new Date(baseTimestamp.getTime() + i * 3600000),
    });
  }

  console.log('✓ Created 10 standalone sessions');

  const totalSessions = 10 + 3 + 4 + 7 + 6 + 1 + 3 + 20 + 3; // Standalone (10) + Structure 1 (3) + Structure 3 (4) + Structure 2 (7) + Structure 4 (6) + Structure 5 (1) + Structure 6 (3) + Structure 7 (20) + Structure 8 (3)
  console.log(
    `\n✅ Seeded test database with ${totalSessions} sessions including 8 continuation chain structures`
  );
}

/**
 * Clean up test continuation data
 */
export async function cleanupContinuationData(): Promise<void> {
  const testProjectPath = path.join(
    process.env.HOME!,
    '.claude',
    'projects',
    'e2e-test-continuations'
  );

  if (fs.existsSync(testProjectPath)) {
    fs.rmSync(testProjectPath, { recursive: true, force: true });
    console.log('✓ Cleaned up test continuation data');
  }
}
