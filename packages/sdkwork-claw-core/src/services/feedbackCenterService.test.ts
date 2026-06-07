import assert from 'node:assert/strict';
import { createFeedbackCenterService } from './feedbackCenterService.ts';

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
  'feedbackCenterService maps generated app sdk feedback payloads into settings-friendly domain objects',
  async () => {
    const service = createFeedbackCenterService({
      getClient: () =>
        ({
          feedback: {
            listFeedback: async (params?: Record<string, unknown>) => {
              assert.equal(params?.status, 'PENDING');
              assert.equal(params?.page, 2);
              assert.equal(params?.size, 5);

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '1001',
                      type: 'BUG_REPORT',
                      content: 'Dashboard order list is empty.',
                      status: 'PENDING',
                      submitTime: '2026-03-25T09:00:00Z',
                    },
                  ],
                  totalElements: 6,
                  number: 1,
                  size: 5,
                  last: false,
                },
              };
            },
            submit: async (body: Record<string, unknown>) => {
              assert.equal(body.type, 'BUG_REPORT');
              assert.equal(body.content, 'Dashboard order list is empty.');
              assert.equal(body.contact, 'ops@sdkwork.test');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  status: 'PENDING',
                  submitTime: '2026-03-25T09:00:00Z',
                },
              };
            },
            getFeedbackDetail: async (feedbackId: string | number) => {
              assert.equal(feedbackId, '1001');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  contact: 'ops@sdkwork.test',
                  status: 'PROCESSING',
                  submitTime: '2026-03-25T09:00:00Z',
                  processTime: '2026-03-25T10:00:00Z',
                  followUps: [
                    {
                      id: 'fu-1',
                      feedbackId: '1001',
                      content: 'More logs were uploaded.',
                      follower: 'user',
                      followUpTime: '2026-03-25T10:30:00Z',
                    },
                  ],
                },
              };
            },
            followUp: async (feedbackId: string | number, body: Record<string, unknown>) => {
              assert.equal(feedbackId, '1001');
              assert.equal(body.feedbackId, '1001');
              assert.equal(body.content, 'Attached extra screenshots.');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  contact: 'ops@sdkwork.test',
                  status: 'PROCESSING',
                  submitTime: '2026-03-25T09:00:00Z',
                  followUps: [
                    {
                      id: 'fu-2',
                      feedbackId: '1001',
                      content: 'Attached extra screenshots.',
                      follower: 'user',
                      followUpTime: '2026-03-25T11:00:00Z',
                    },
                  ],
                },
              };
            },
            close: async (feedbackId: string | number, params?: Record<string, unknown>) => {
              assert.equal(feedbackId, '1001');
              assert.equal(params?.reason, 'resolved locally');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  status: 'CLOSED',
                  submitTime: '2026-03-25T09:00:00Z',
                },
              };
            },
            listFaqCategories: async () => ({
              code: '2000',
              data: [
                {
                  id: 'cat-1',
                  name: 'Account',
                  faqCount: 3,
                },
              ],
            }),
            listFaqs: async (params?: Record<string, unknown>) => {
              assert.equal(params?.categoryId, 'cat-1');
              assert.equal(params?.page, 1);
              assert.equal(params?.size, 10);

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: 'faq-1',
                      question: 'How do I reset my password?',
                      categoryId: 'cat-1',
                      categoryName: 'Account',
                      helpfulCount: 12,
                    },
                  ],
                  totalElements: 1,
                  number: 0,
                  size: 10,
                  last: true,
                },
              };
            },
            searchFaqs: async (params?: Record<string, unknown>) => {
              assert.equal(params?.keyword, 'password');

              return {
                code: '2000',
                data: [
                  {
                    id: 'faq-1',
                    question: 'How do I reset my password?',
                    categoryId: 'cat-1',
                    categoryName: 'Account',
                    helpfulCount: 12,
                  },
                ],
              };
            },
            getFaqDetail: async (faqId: string | number) => {
              assert.equal(faqId, 'faq-1');

              return {
                code: '2000',
                data: {
                  id: 'faq-1',
                  question: 'How do I reset my password?',
                  answer: 'Open account settings and choose Change Password.',
                  categoryId: 'cat-1',
                  categoryName: 'Account',
                  helpfulCount: 12,
                },
              };
            },
            getSupportInfo: async () => ({
              code: '2000',
              data: {
                hotline: '400-123-4567',
                email: 'support@sdkwork.test',
                workingHours: 'Mon-Fri 09:00-18:00',
                onlineSupportUrl: 'https://support.sdkwork.test',
              },
            }),
          },
        }) as any,
    });

    const feedbackPage = await service.listFeedback({
      status: 'PENDING',
      page: 2,
      pageSize: 5,
    });
    const createdFeedback = await service.submitFeedback({
      type: 'BUG_REPORT',
      content: 'Dashboard order list is empty.',
      contact: 'ops@sdkwork.test',
    });
    const feedbackDetail = await service.getFeedback('1001');
    const followedFeedback = await service.followUpFeedback(
      '1001',
      'Attached extra screenshots.',
    );
    const closedFeedback = await service.closeFeedback('1001', 'resolved locally');
    const faqCategories = await service.listFaqCategories();
    const faqPage = await service.listFaqs({
      categoryId: 'cat-1',
      page: 1,
      pageSize: 10,
    });
    const faqSearchResults = await service.searchFaqs('password');
    const faqDetail = await service.getFaq('faq-1');
    const supportInfo = await service.getSupportInfo();

    assert.equal(feedbackPage.total, 6);
    assert.equal(feedbackPage.page, 2);
    assert.equal(feedbackPage.pageSize, 5);
    assert.equal(feedbackPage.hasMore, true);
    assert.equal(feedbackPage.items[0]?.type, 'BUG_REPORT');
    assert.equal(createdFeedback.id, '1001');
    assert.equal(feedbackDetail.followUps[0]?.content, 'More logs were uploaded.');
    assert.equal(followedFeedback.followUps[0]?.content, 'Attached extra screenshots.');
    assert.equal(closedFeedback.status, 'CLOSED');
    assert.equal(faqCategories[0]?.name, 'Account');
    assert.equal(faqPage.items[0]?.question, 'How do I reset my password?');
    assert.equal(faqSearchResults[0]?.id, 'faq-1');
    assert.equal(faqDetail.answer, 'Open account settings and choose Change Password.');
    assert.equal(supportInfo.email, 'support@sdkwork.test');
  },
);

await runTest(
  'feedbackCenterService delegates feedback operations to the injected app client port',
  async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const service = createFeedbackCenterService({
      getClient: () =>
        ({
          feedback: {
            listFeedback: async (...args: unknown[]) => {
              calls.push({ method: 'listFeedback', args });
              return {
                code: '2000',
                data: { content: [], totalElements: 0, number: 0, size: 10, last: true },
              };
            },
            submit: async (...args: unknown[]) => {
              calls.push({ method: 'submit', args });
              return { code: '2000', data: { id: '1001' } };
            },
            getFeedbackDetail: async (...args: unknown[]) => {
              calls.push({ method: 'getFeedbackDetail', args });
              return { code: '2000', data: { id: '1001', followUps: [] } };
            },
            followUp: async (...args: unknown[]) => {
              calls.push({ method: 'followUp', args });
              return { code: '2000', data: { id: '1001', followUps: [] } };
            },
            close: async (...args: unknown[]) => {
              calls.push({ method: 'close', args });
              return { code: '2000', data: { id: '1001', status: 'CLOSED' } };
            },
            listFaqCategories: async (...args: unknown[]) => {
              calls.push({ method: 'listFaqCategories', args });
              return { code: '2000', data: [] };
            },
            listFaqs: async (...args: unknown[]) => {
              calls.push({ method: 'listFaqs', args });
              return {
                code: '2000',
                data: { content: [], totalElements: 0, number: 0, size: 10, last: true },
              };
            },
            searchFaqs: async (...args: unknown[]) => {
              calls.push({ method: 'searchFaqs', args });
              return { code: '2000', data: [] };
            },
            getFaqDetail: async (...args: unknown[]) => {
              calls.push({ method: 'getFaqDetail', args });
              return { code: '2000', data: { id: 'faq-1' } };
            },
            getSupportInfo: async (...args: unknown[]) => {
              calls.push({ method: 'getSupportInfo', args });
              return { code: '2000', data: {} };
            },
          },
        }) as any,
    });

    await service.listFeedback({ status: 'PENDING', page: 2, pageSize: 5 });
    await service.submitFeedback({
      type: 'BUG_REPORT',
      content: 'Dashboard order list is empty.',
    });
    await service.getFeedback('1001');
    await service.followUpFeedback('1001', 'Attached extra screenshots.');
    await service.closeFeedback('1001', 'resolved locally');
    await service.listFaqCategories();
    await service.listFaqs({ categoryId: 'cat-1', page: 1, pageSize: 10 });
    await service.searchFaqs('password');
    await service.getFaq('faq-1');
    await service.getSupportInfo();

    assert.deepEqual(calls.map((call) => call.method), [
      'listFeedback',
      'submit',
      'getFeedbackDetail',
      'followUp',
      'close',
      'listFaqCategories',
      'listFaqs',
      'searchFaqs',
      'getFaqDetail',
      'getSupportInfo',
    ]);
    assert.deepEqual(calls[0]?.args[0], { status: 'PENDING', page: 2, size: 5 });
    assert.deepEqual(calls[1]?.args[0], {
      type: 'BUG_REPORT',
      content: 'Dashboard order list is empty.',
      contact: undefined,
      attachmentUrl: undefined,
      screenshotUrl: undefined,
    });
    assert.equal(calls[2]?.args[0], '1001');
    assert.deepEqual(calls[4]?.args, ['1001', { reason: 'resolved locally' }]);
    assert.deepEqual(calls[6]?.args[0], { categoryId: 'cat-1', page: 1, size: 10 });
    assert.deepEqual(calls[7]?.args[0], { keyword: 'password' });
    assert.equal(calls[8]?.args[0], 'faq-1');
  },
);
