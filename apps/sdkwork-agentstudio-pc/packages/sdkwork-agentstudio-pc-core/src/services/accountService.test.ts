import assert from 'node:assert/strict';
import { createAccountService } from './accountService.ts';

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);

  if (url.endsWith('/app/v3/api/account/summary')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-account-summary',
        errorName: '',
        data: {
          cashAvailable: 125.5,
          cashFrozen: 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/account/cash')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-account-cash',
        errorName: '',
        data: {
          availableBalance: 88.75,
          totalRecharged: 260,
          totalSpent: 171.25,
          totalWithdrawn: 10,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/account/cash/history')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-account-history',
        errorName: '',
        data: {
          content: [
            {
              historyId: 'income-1',
              transactionType: 'CASH_RECHARGE',
              amount: 128.6,
              remarks: 'Wallet Top-up',
              createdAt: '2026-03-21T10:00:00.000Z',
              status: 'SUCCESS',
            },
            {
              historyId: 'expense-1',
              transactionType: 'CASH_PAY',
              amount: -32.1,
              remarks: 'Workspace purchase',
              createdAt: '2026-03-21T11:00:00.000Z',
              status: 'PENDING',
            },
          ],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/account/cash/recharge')) {
    const body = JSON.parse(String(init?.body || '{}'));
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-account-recharge',
        errorName: '',
        data: {
          transactionId: 'recharge-1',
          amount: body.amount,
          status: 'SUCCESS',
          paymentMethod: body.paymentMethod,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/account/cash/withdraw')) {
    const body = JSON.parse(String(init?.body || '{}'));
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-account-withdraw',
        errorName: '',
        data: {
          transactionId: 'withdraw-1',
          amount: body.amount,
          status: 'PENDING',
          withdrawMethod: body.withdrawMethod,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      code: '5000',
      msg: `Unhandled request: ${url}`,
      requestId: 'req-unhandled',
      errorName: 'UnhandledRequest',
      data: null,
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}) as typeof fetch;

function createTestAccountService() {
  return createAccountService({
    getClient: () => ({
      account: {
        async getAccountSummary() {
          return (await fetch('http://localhost/app/v3/api/account/summary')).json();
        },
        async getCash() {
          return (await fetch('http://localhost/app/v3/api/account/cash')).json();
        },
        async getHistoryCash() {
          return (await fetch('http://localhost/app/v3/api/account/cash/history')).json();
        },
        async recharge(body: Record<string, unknown>) {
          return (
            await fetch('http://localhost/app/v3/api/account/cash/recharge', {
              method: 'POST',
              body: JSON.stringify(body),
            })
          ).json();
        },
        async withdraw(body: Record<string, unknown>) {
          return (
            await fetch('http://localhost/app/v3/api/account/cash/withdraw', {
              method: 'POST',
              body: JSON.stringify(body),
            })
          ).json();
        },
      },
    }),
  });
}

await runTest('accountService reads SDK-style envelopes for summary and transactions', async () => {
  const service = createTestAccountService();

  const summary = await service.getSummary();
  assert.deepEqual(summary, {
    balance: 88.75,
    totalIncome: 260,
    totalExpense: 171.25,
  });

  const transactions = await service.getTransactions();
  assert.equal(transactions.length, 2);
  assert.deepEqual(transactions[0], {
    id: 'income-1',
    type: 'recharge',
    amount: 128.6,
    desc: 'Wallet Top-up',
    date: '2026-03-21T10:00:00.000Z',
    status: 'completed',
  });
  assert.deepEqual(transactions[1], {
    id: 'expense-1',
    type: 'expense',
    amount: 32.1,
    desc: 'Workspace purchase',
    date: '2026-03-21T11:00:00.000Z',
    status: 'pending',
  });
});

await runTest('accountService maps recharge and withdraw through the unified account SDK', async () => {
  const service = createTestAccountService();

  const recharge = await service.recharge(24.5, 'wechat');
  assert.equal(recharge.id, 'recharge-1');
  assert.equal(recharge.type, 'recharge');
  assert.equal(recharge.amount, 24.5);
  assert.equal(recharge.status, 'completed');

  const withdraw = await service.withdraw(12.5, 'bank-card');
  assert.equal(withdraw.id, 'withdraw-1');
  assert.equal(withdraw.type, 'withdraw');
  assert.equal(withdraw.amount, 12.5);
  assert.equal(withdraw.status, 'pending');
});
