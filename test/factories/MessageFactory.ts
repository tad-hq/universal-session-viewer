import type { Message } from '@/types/session';

export function createUserMessage(overrides: Partial<Message> = {}): Message {
  return {
    type: 'user',
    content: 'This is a test user message',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createAssistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    type: 'assistant',
    content: 'This is a test assistant response with **markdown** support.',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createConversation(length: number): Message[] {
  return Array.from({ length }, (_, index) => {
    const timestamp = new Date(Date.now() - (length - index) * 60000).toISOString();
    return index % 2 === 0
      ? createUserMessage({
          content: `User message ${index + 1}`,
          timestamp,
        })
      : createAssistantMessage({
          content: `Assistant response ${index + 1}`,
          timestamp,
        });
  });
}

export function createToolUseMessage(toolName: string = 'bash', input: string = 'ls -la'): Message {
  return {
    type: 'assistant',
    content: `Using tool: ${toolName}\nInput: ${input}`,
    timestamp: new Date().toISOString(),
  };
}

export function createLongMessage(wordCount: number = 1000): Message {
  const words = Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
  return {
    type: 'assistant',
    content: words,
    timestamp: new Date().toISOString(),
  };
}

export function createCodeBlockMessage(language: string = 'typescript', code: string = 'const x = 1;'): Message {
  return {
    type: 'assistant',
    content: `Here's some code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    timestamp: new Date().toISOString(),
  };
}

export function createMultiParagraphMessage(): Message {
  return {
    type: 'assistant',
    content: `First paragraph with some content.

Second paragraph with more details.

Third paragraph with conclusion.`,
    timestamp: new Date().toISOString(),
  };
}

export function createEmptyMessage(): Message {
  return {
    type: 'user',
    content: '',
    timestamp: new Date().toISOString(),
  };
}
