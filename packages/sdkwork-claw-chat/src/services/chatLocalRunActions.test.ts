import assert from 'node:assert/strict';

import { createChatLocalRunActions } from './chatLocalRunActions.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'createChatLocalRunActions streams direct chat output through optimistic local session orchestration',
  async () => {
    const pendingStates: Array<string | null> = [];
    const flushCalls: string[] = [];
    const updateCalls: Array<{ sessionId: string; messageId: string; content: string }> = [];
    const sessions = [
      {
        id: 'session-a',
        messages: [] as Array<{
          id: string;
          role: string;
          content: string;
          attachments?: Array<{ id: string }>;
          model?: string;
        }>,
      },
    ];
    let messageCounter = 0;
    const abortControllerRef = { current: null as AbortController | null };
    const streamedSessions: unknown[] = [];
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef,
      setPendingSendSessionId(nextState) {
        pendingStates.push(typeof nextState === 'function' ? nextState('session-a') : nextState);
      },
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage(sessionId, messageId, content) {
        updateCalls.push({ sessionId, messageId, content });
        const session = sessions.find((entry) => entry.id === sessionId);
        const targetMessage = session?.messages.find((message) => message.id === messageId);
        if (targetMessage) {
          targetMessage.content = content;
        }
      },
      removeMessages() {},
      async flushSession(sessionId) {
        flushCalls.push(sessionId);
      },
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream(chatSession, content, _model, _skill, _agent, _abortSignal, attachments) {
        streamedSessions.push({
          chatSession,
          content,
          attachments,
        });
        yield 'Hello';
        yield ' world';
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-a',
      content: 'hi there',
      attachments: [{ id: 'attachment-a' }],
      requestText: 'hi there',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.equal(abortControllerRef.current, null);
    assert.deepEqual(pendingStates, ['session-a', null]);
    assert.deepEqual(flushCalls, ['session-a']);
    assert.equal(sessions[0]?.messages[0]?.role, 'user');
    assert.equal(sessions[0]?.messages[0]?.content, 'hi there');
    assert.deepEqual(sessions[0]?.messages[0]?.attachments, [{ id: 'attachment-a' }]);
    assert.equal(sessions[0]?.messages[1]?.role, 'assistant');
    assert.equal(sessions[0]?.messages[1]?.model, 'Model A');
    assert.deepEqual(updateCalls, [
      {
        sessionId: 'session-a',
        messageId: 'message-2',
        content: 'Hello',
      },
      {
        sessionId: 'session-a',
        messageId: 'message-2',
        content: 'Hello world',
      },
    ]);
    assert.equal(
      ((streamedSessions[0] as { chatSession?: { id?: string } }).chatSession)?.id,
      'session-a',
    );
    assert.equal((streamedSessions[0] as { content?: string }).content, 'hi there');
    assert.deepEqual(
      (streamedSessions[0] as { attachments?: Array<{ id: string }> }).attachments,
      [{ id: 'attachment-a' }],
    );
  },
);

await runTest(
  'createChatLocalRunActions forwards requestText to the direct transport so attachment-only sends keep their composed upstream prompt',
  async () => {
    const sessions = [
      {
        id: 'session-attachments-only',
        messages: [] as Array<{
          id: string;
          role: string;
          content: string;
          attachments?: Array<{ id: string; kind?: string; url?: string }>;
          model?: string;
        }>,
      },
    ];
    let messageCounter = 0;
    const streamedPayloads: Array<{
      content: string;
      attachments?: Array<{ id: string; kind?: string; url?: string }>;
    }> = [];
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef: { current: null },
      setPendingSendSessionId() {},
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage(sessionId, messageId, content) {
        const session = sessions.find((entry) => entry.id === sessionId);
        const targetMessage = session?.messages.find((message) => message.id === messageId);
        if (targetMessage) {
          targetMessage.content = content;
        }
      },
      removeMessages() {},
      async flushSession() {},
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream(_chatSession, content, _model, _skill, _agent, _abortSignal, attachments) {
        streamedPayloads.push({
          content,
          attachments,
        });
        yield 'done';
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-attachments-only',
      content: '',
      attachments: [
        {
          id: 'attachment-image',
          kind: 'image',
          url: 'https://cdn.example.com/example.png',
        },
      ],
      requestText:
        'The user sent attachments without additional text.\n\nAttachments:\n1. [image] Attachment 1\nURL: https://cdn.example.com/example.png',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.equal(streamedPayloads[0]?.content, 'The user sent attachments without additional text.\n\nAttachments:\n1. [image] Attachment 1\nURL: https://cdn.example.com/example.png');
    assert.deepEqual(streamedPayloads[0]?.attachments, [
      {
        id: 'attachment-image',
        kind: 'image',
        url: 'https://cdn.example.com/example.png',
      },
    ]);
    assert.equal(sessions[0]?.messages[0]?.content, '');
  },
);

await runTest(
  'createChatLocalRunActions keeps stream updates bound to the optimistic assistant placeholder when later local messages appear',
  async () => {
    const sessions = [
      {
        id: 'session-interleaved',
        messages: [] as Array<{ id: string; role: string; content: string; model?: string }>,
      },
    ];
    let messageCounter = 0;
    const updateCalls: Array<{ sessionId: string; messageId: string; content: string }> = [];
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef: { current: null },
      setPendingSendSessionId() {},
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage(sessionId, messageId, content) {
        updateCalls.push({ sessionId, messageId, content });
        const session = sessions.find((entry) => entry.id === sessionId);
        const targetMessage = session?.messages.find((message) => message.id === messageId);
        if (targetMessage) {
          targetMessage.content = content;
        }
      },
      removeMessages() {},
      async flushSession() {},
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream() {
        sessions[0]?.messages.push({
          id: `message-${++messageCounter}`,
          role: 'tool',
          content: 'Tool event arrived while streaming',
        });
        yield 'Hello';
        yield ' world';
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-interleaved',
      content: 'hi there',
      attachments: [],
      requestText: 'hi there',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.deepEqual(updateCalls, [
      {
        sessionId: 'session-interleaved',
        messageId: 'message-2',
        content: 'Hello',
      },
      {
        sessionId: 'session-interleaved',
        messageId: 'message-2',
        content: 'Hello world',
      },
    ]);
    assert.equal(sessions[0]?.messages[1]?.content, 'Hello world');
    assert.deepEqual(sessions[0]?.messages.map((message) => message.role), [
      'user',
      'assistant',
      'tool',
    ]);
  },
);

await runTest(
  'createChatLocalRunActions preserves optimistic direct messages and writes an assistant error when local send fails before the first streamed chunk',
  async () => {
    const pendingStates: Array<string | null> = [];
    const sessions = [
      {
        id: 'session-a',
        messages: [] as Array<{ id: string; role: string; content: string; model?: string }>,
      },
    ];
    let messageCounter = 0;
    let flushCount = 0;
    const removeCalls: Array<{ sessionId: string; messageIds: string[] }> = [];
    const loggedErrors: unknown[] = [];
    const abortControllerRef = { current: null as AbortController | null };
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef,
      setPendingSendSessionId(nextState) {
        pendingStates.push(typeof nextState === 'function' ? nextState('session-a') : nextState);
      },
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage(sessionId, messageId, content) {
        const session = sessions.find((entry) => entry.id === sessionId);
        const targetMessage = session?.messages.find((message) => message.id === messageId);
        if (targetMessage) {
          targetMessage.content = content;
        }
      },
      removeMessages(sessionId, messageIds) {
        removeCalls.push({ sessionId, messageIds: [...messageIds] });
        const session = sessions.find((entry) => entry.id === sessionId);
        if (!session) {
          return;
        }

        session.messages = session.messages.filter((message) => !messageIds.includes(message.id));
      },
      async flushSession() {
        flushCount += 1;
      },
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream() {
        throw new Error('boom');
      },
      logError(_message, error) {
        loggedErrors.push(error);
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-a',
      content: 'hi there',
      attachments: [],
      requestText: 'hi there',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.deepEqual(pendingStates, ['session-a', null]);
    assert.equal(flushCount, 1);
    assert.equal(abortControllerRef.current, null);
    assert.deepEqual(removeCalls, []);
    assert.deepEqual(sessions[0]?.messages, [
      {
        id: 'message-1',
        role: 'user',
        content: 'hi there',
        attachments: [],
      },
      {
        id: 'message-2',
        role: 'assistant',
        content: 'Error: boom',
        model: 'Model A',
      },
    ]);
    assert.equal(loggedErrors.length, 1);
  },
);

await runTest(
  'createChatLocalRunActions preserves streamed assistant content and appends an assistant error when local send fails after streaming has started',
  async () => {
    const sessions = [
      {
        id: 'session-a',
        messages: [] as Array<{ id: string; role: string; content: string; model?: string }>,
      },
    ];
    let messageCounter = 0;
    let flushCount = 0;
    const updateCalls: Array<{ sessionId: string; messageId: string; content: string }> = [];
    const removeCalls: Array<{ sessionId: string; messageIds: string[] }> = [];
    const loggedErrors: unknown[] = [];
    const abortControllerRef = { current: null as AbortController | null };
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef,
      setPendingSendSessionId() {},
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage(sessionId, messageId, content) {
        updateCalls.push({ sessionId, messageId, content });
        const session = sessions.find((entry) => entry.id === sessionId);
        const targetMessage = session?.messages.find((message) => message.id === messageId);
        if (targetMessage) {
          targetMessage.content = content;
        }
      },
      removeMessages(sessionId, messageIds) {
        removeCalls.push({ sessionId, messageIds: [...messageIds] });
      },
      async flushSession() {
        flushCount += 1;
      },
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream() {
        yield 'Hello';
        throw new Error('boom');
      },
      logError(_message, error) {
        loggedErrors.push(error);
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-a',
      content: 'hi there',
      attachments: [],
      requestText: 'hi there',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.equal(flushCount, 1);
    assert.equal(abortControllerRef.current, null);
    assert.deepEqual(updateCalls, [
      {
        sessionId: 'session-a',
        messageId: 'message-2',
        content: 'Hello',
      },
      {
        sessionId: 'session-a',
        messageId: 'message-2',
        content: 'Hello\n\nError: boom',
      },
    ]);
    assert.deepEqual(removeCalls, []);
    assert.equal(sessions[0]?.messages[1]?.content, 'Hello\n\nError: boom');
    assert.equal(loggedErrors.length, 1);
  },
);

await runTest(
  'createChatLocalRunActions removes only the empty assistant placeholder when a local run is aborted before the first streamed chunk',
  async () => {
    const sessions = [
      {
        id: 'session-a',
        messages: [] as Array<{ id: string; role: string; content: string; model?: string }>,
      },
    ];
    let messageCounter = 0;
    let flushCount = 0;
    const removeCalls: Array<{ sessionId: string; messageIds: string[] }> = [];
    const loggedErrors: unknown[] = [];
    const abortControllerRef = { current: null as AbortController | null };
    const actions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef,
      setPendingSendSessionId() {},
      addMessage(sessionId, message) {
        const session = sessions.find((entry) => entry.id === sessionId);
        assert.ok(session);
        session.messages.push({
          id: `message-${++messageCounter}`,
          ...message,
        });
      },
      updateMessage() {},
      removeMessages(sessionId, messageIds) {
        removeCalls.push({ sessionId, messageIds: [...messageIds] });
        const session = sessions.find((entry) => entry.id === sessionId);
        if (!session) {
          return;
        }

        session.messages = session.messages.filter((message) => !messageIds.includes(message.id));
      },
      async flushSession() {
        flushCount += 1;
      },
      getSessionById(sessionId) {
        return sessions.find((entry) => entry.id === sessionId);
      },
      async *sendMessageStream() {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
      logError(_message, error) {
        loggedErrors.push(error);
      },
    });

    const handled = await actions.sendLocalRun({
      sessionId: 'session-a',
      content: 'hi there',
      attachments: [],
      requestText: 'hi there',
      requestModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
    });

    assert.equal(handled, true);
    assert.equal(flushCount, 1);
    assert.equal(abortControllerRef.current, null);
    assert.deepEqual(removeCalls, [
      {
        sessionId: 'session-a',
        messageIds: ['message-2'],
      },
    ]);
    assert.deepEqual(sessions[0]?.messages, [
      {
        id: 'message-1',
        role: 'user',
        content: 'hi there',
        attachments: [],
      },
    ]);
    assert.equal(loggedErrors.length, 0);
  },
);

await runTest(
  'createChatLocalRunActions stays idle for gateway mode and aborts in-flight local controllers when requested',
  () => {
    const localAbortControllerRef = { current: new AbortController() };
    const localActions = createChatLocalRunActions({
      sendMode: 'local',
      abortControllerRef: localAbortControllerRef,
      setPendingSendSessionId() {},
      addMessage() {},
      updateMessage() {},
      removeMessages() {},
      async flushSession() {},
      getSessionById() {
        return undefined;
      },
      async *sendMessageStream() {},
    });
    const gatewayActions = createChatLocalRunActions({
      sendMode: 'gateway',
      abortControllerRef: { current: null },
      setPendingSendSessionId() {},
      addMessage() {},
      updateMessage() {},
      removeMessages() {},
      async flushSession() {},
      getSessionById() {
        return undefined;
      },
      async *sendMessageStream() {},
    });

    assert.equal(localActions.stopActiveRun(), true);
    assert.equal(localAbortControllerRef.current.signal.aborted, true);
    assert.equal(gatewayActions.stopActiveRun(), false);
  },
);
