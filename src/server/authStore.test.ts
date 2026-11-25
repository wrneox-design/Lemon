import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthStore } from './authStore.ts';

test('AuthStore registers user with Login ID, requires email verification, and supports Login ID + Email sign-in', () => {
  const store = new AuthStore({ persistPath: null, secret: 'test-secret-key-123' });

  const reg = store.registerUser({
    fullName: 'Rohan Sharma',
    loginId: 'rohan_fx',
    email: 'rohan@lemonfunding.io',
    password: 'StrongPassword123',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  assert.equal(reg.user.emailVerified, false);
  assert.equal(reg.user.loginId, 'rohan_fx');

  // Unverified login returns 403 with requiresVerification
  const unverifiedLogin = store.loginUser('rohan_fx', 'StrongPassword123');
  assert.equal(unverifiedLogin.ok, false);
  if (!unverifiedLogin.ok) {
    assert.equal(unverifiedLogin.status, 403);
    assert.equal(unverifiedLogin.requiresVerification, true);
    assert.equal(unverifiedLogin.toEmail, 'rohan@lemonfunding.io');
    assert.equal(unverifiedLogin.loginId, 'rohan_fx');
    assert.ok(unverifiedLogin.verificationToken);

    // Resend keeps unmasked recipient for outbound mailers
    const resent = store.resendVerificationCode(unverifiedLogin.verificationToken!);
    assert.equal(resent.ok, true);
    if (!resent.ok) return;
    assert.equal(resent.toEmail, 'rohan@lemonfunding.io');
    assert.equal(resent.loginId, 'rohan_fx');

    // Check preview inbox returns the exact freshly issued OTP code
    const inbox = store.getPreviewInboxMessage(resent.verificationToken);
    assert.equal(inbox.ok, true);
    if (!inbox.ok) return;

    // Reject wrong code first
    const badVerify = store.verifyEmailCode(resent.verificationToken, '000000');
    assert.equal(badVerify.ok, false);

    // Accept real code
    const verified = store.verifyEmailCode(resent.verificationToken, inbox.code);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.user.emailVerified, true);
    assert.ok(verified.accessToken);
  }

  // Now login works using either Login ID or Email
  const loginById = store.loginUser('rohan_fx', 'StrongPassword123');
  assert.equal(loginById.ok, true);
  const loginByEmail = store.loginUser('rohan@lemonfunding.io', 'StrongPassword123');
  assert.equal(loginByEmail.ok, true);
});

test('AuthStore rejects duplicate Login IDs and updates dashboard equity on trades and payouts', () => {
  const store = new AuthStore({ persistPath: null, secret: 'test-secret-key-456' });
  const adminSess = store.ensureAdminSession();
  const reg = store.registerUser({
    fullName: 'Aarav Patel',
    loginId: 'aarav_99',
    email: 'aarav@lemonfunding.io',
    password: 'Password999!',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const dup = store.registerUser({
    fullName: 'Someone Else',
    loginId: 'AARAV_99',
    email: 'other@lemonfunding.io',
    password: 'Password999!',
  });
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.status, 409);

  const verified = store.verifyEmailCode(reg.verificationToken, reg.otpCodeForMailer);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;

  // Submit & approve KYC via Owner Admin
  const kycSub = store.submitKycVerification(verified.user.id, {
    panSelected: true,
    aadhaarSelected: true,
    panImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarFrontImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarBackImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.equal(kycSub.ok, true);
  if (!kycSub.ok) return;
  store.reviewKycSubmission(adminSess.user.id, kycSub.submission.id, 'approve');

  const dash = store.getDashboardForUser(verified.user.id);
  assert.ok(dash);
  assert.equal(dash.accounts.length, 0);
  assert.equal(dash.trades.length, 0);
  assert.equal(dash.payouts.length, 0);

  const acctRes = store.createChallengeAccount(verified.user.id, {
    mode: 'instant',
    accountSize: 100000,
    profitSplit: 80,
    platform: 'MetaTrader 5',
  });
  assert.equal(acctRes.ok, true);
  if (!acctRes.ok) return;
  const approvedAcct = store.approveAccount(adminSess.user.id, acctRes.account.id, 'approve');
  assert.equal(approvedAcct.ok, true);
  if (!approvedAcct.ok) return;

  const acct = approvedAcct.account;
  assert.equal(acct.status, 'Instant Funded');
  assert.equal(acct.targetUsd, 0);
  const initialEq = acct.currentEquity;

  // Instant Funded has owner-named QR certificate immediately
  const instantCert = store.getCertificate(`LF-CERT-PASS-${acct.accountNumber}`);
  assert.ok(instantCert);
  assert.equal(instantCert.traderName, 'Aarav Patel');

  // 5 distinct valid days each >= 0.50% ($500) and each <= 35% of total positive profit
  const dates = [
    '2026-11-20T12:00:00.000Z',
    '2026-11-21T12:00:00.000Z',
    '2026-11-22T12:00:00.000Z',
    '2026-11-23T12:00:00.000Z',
    '2026-11-24T12:00:00.000Z',
  ];
  for (let i = 0; i < 4; i++) {
    const t = store.logTrade(verified.user.id, {
      accountId: acct.id,
      symbol: 'XAU/USD',
      side: 'BUY',
      lots: 1.5,
      pnlUsd: 600,
      notes: 'Gold breakout',
      executedAtIso: dates[i],
    });
    assert.equal(t.ok, true);
  }
  // 4 valid days is NOT enough
  const tooEarly = store.requestPayout(verified.user.id, { accountId: acct.id, method: 'BNB BEP20' });
  assert.equal(tooEarly.ok, false);

  // Day 5 with < 0.50% ($400 < $500) still NOT enough
  const subThresholdDay = store.logTrade(verified.user.id, {
    accountId: acct.id,
    symbol: 'XAU/USD',
    side: 'BUY',
    lots: 1.0,
    pnlUsd: 400,
    notes: 'Partial gain',
    executedAtIso: dates[4],
  });
  assert.equal(subThresholdDay.ok, true);
  const stillTooEarly = store.requestPayout(verified.user.id, { accountId: acct.id, method: 'BNB BEP20' });
  assert.equal(stillTooEarly.ok, false);

  // Push Day 5 profit above 0.50% ($400 + $200 = $600)
  const day5Finish = store.logTrade(verified.user.id, {
    accountId: acct.id,
    symbol: 'XAU/USD',
    side: 'BUY',
    lots: 1.0,
    pnlUsd: 200,
    notes: 'Day 5 completion',
    executedAtIso: dates[4],
  });
  assert.equal(day5Finish.ok, true);
  if (!day5Finish.ok) return;
  assert.equal(day5Finish.account.currentEquity, initialEq + 3000);

  const payoutRes = store.requestPayout(verified.user.id, {
    accountId: acct.id,
    method: 'BNB BEP20',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  });
  assert.equal(payoutRes.ok, true);
  if (!payoutRes.ok) return;
  assert.equal(payoutRes.payout.amountUsd, 2400);
  assert.equal(payoutRes.certificate.traderName, 'Aarav Patel');
  assert.equal(payoutRes.account.currentEquity, acct.startingBalance);
});

test('AuthStore tracks user IPs, purchased challenge fees, and restricts Admin Panel to verified owner email', () => {
  const store = new AuthStore({
    persistPath: null,
    secret: 'test-admin-secret-789',
    adminEmail: 'mrboxwr@gmail.com',
  });

  // 1. Register & verify a regular trader with a distinct IP
  const traderReg = store.registerUser(
    {
      fullName: 'Vikram Singh',
      loginId: 'vikram_fx',
      email: 'vikram@gmail.com',
      password: 'TraderPassword123',
    },
    { ip: '203.0.113.45', userAgent: 'Mozilla/5.0 Chrome/130' }
  );
  assert.equal(traderReg.ok, true);
  if (!traderReg.ok) return;
  assert.equal(traderReg.user.isAdmin, false);

  const traderVerified = store.verifyEmailCode(
    traderReg.verificationToken,
    traderReg.otpCodeForMailer,
    { ip: '203.0.113.45', userAgent: 'Mozilla/5.0 Chrome/130' }
  );
  assert.equal(traderVerified.ok, true);
  if (!traderVerified.ok) return;
  assert.equal(traderVerified.user.isAdmin, false);

  // Regular trader purchases a $100,000 challenge from IP 203.0.113.99
  const acctRes = store.createChallengeAccount(
    traderVerified.user.id,
    {
      mode: 'two-step',
      accountSize: 100000,
      profitSplit: 80,
      platform: 'MetaTrader 5',
    },
    { ip: '203.0.113.99', userAgent: 'Mozilla/5.0 Chrome/130' }
  );
  assert.equal(acctRes.ok, true);
  if (!acctRes.ok) return;
  const acct = acctRes.account;
  assert.equal(acct.feePaidUsd, 159);
  assert.equal(acct.purchaseIp, '203.0.113.99');

  // Regular trader is strictly blocked (403) from admin endpoints
  const deniedOverview = store.getAdminOverview(traderVerified.user.id);
  assert.equal(deniedOverview.ok, false);
  if (!deniedOverview.ok) assert.equal(deniedOverview.status, 403);

  // 2. Register & verify owner email mrboxwr@gmail.com
  const ownerReg = store.registerUser(
    {
      fullName: 'Lemon Owner',
      loginId: 'owner_mrbox',
      email: 'mrboxwr@gmail.com',
      password: 'OwnerPassword999',
    },
    { ip: '198.51.100.12', userAgent: 'Mozilla/5.0 Firefox/132' }
  );
  assert.equal(ownerReg.ok, true);
  if (!ownerReg.ok) return;
  assert.equal(ownerReg.user.isAdmin, false);

  const ownerVerified = store.verifyEmailCode(
    ownerReg.verificationToken,
    ownerReg.otpCodeForMailer,
    { ip: '198.51.100.12', userAgent: 'Mozilla/5.0 Firefox/132' }
  );
  assert.equal(ownerVerified.ok, true);
  if (!ownerVerified.ok) return;
  assert.equal(ownerVerified.user.isAdmin, true);

  // Owner approves trader's KYC and account, trader logs 5 valid days & passes Phase 1
  const kycSub = store.submitKycVerification(traderVerified.user.id, {
    panSelected: true,
    aadhaarSelected: true,
    panImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarFrontImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarBackImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.equal(kycSub.ok, true);
  if (!kycSub.ok) return;
  store.reviewKycSubmission(ownerVerified.user.id, kycSub.submission.id, 'approve');
  store.approveAccount(ownerVerified.user.id, acct.id, 'approve');

  for (let d = 1; d <= 5; d++) {
    const trade = store.logTrade(
      traderVerified.user.id,
      {
        accountId: acct.id,
        symbol: 'XAU/USD',
        side: 'BUY',
        lots: 1.0,
        pnlUsd: 1600,
        notes: 'Session breakout',
        executedAtIso: `2026-11-1${d}T12:00:00.000Z`,
      },
      { ip: '203.0.113.99', userAgent: 'Mozilla/5.0 Chrome/130' }
    );
    assert.equal(trade.ok, true);
  }
  const passCert = store.getCertificate(`LF-CERT-PASS-${acct.accountNumber}`);
  assert.ok(passCert);
  assert.equal(passCert.traderName, 'Vikram Singh');

  const payout = store.requestPayout(
    traderVerified.user.id,
    { accountId: acct.id, method: 'BNB BEP20', walletAddress: '0x1234567890abcdef1234567890abcdef12345678' },
    { ip: '203.0.113.99', userAgent: 'Mozilla/5.0 Chrome/130' }
  );
  assert.equal(payout.ok, true);
  if (!payout.ok) return;

  const deniedSettle = store.updatePayoutStatus(traderVerified.user.id, payout.payout.id, 'Settled');
  assert.equal(deniedSettle.ok, false);
  if (!deniedSettle.ok) assert.equal(deniedSettle.status, 403);

  // Owner retrieves full Admin Overview with trader's IP, email, name, purchased account & payout
  const overview = store.getAdminOverview(ownerVerified.user.id);
  assert.equal(overview.ok, true);
  if (!overview.ok) return;
  assert.equal(overview.data.stats.totalUsers, 2);
  assert.equal(overview.data.stats.totalAccounts, 2); // original + Phase 2 promoted account
  assert.equal(overview.data.stats.totalRevenueUsd, 159);
  assert.equal(overview.data.stats.uniqueIpCount, 3);

  const vikramView = overview.data.users.find((u) => u.email === 'vikram@gmail.com');
  assert.ok(vikramView);
  assert.equal(vikramView.signupIp, '203.0.113.45');
  assert.equal(vikramView.lastIp, '203.0.113.99');
  assert.deepEqual(vikramView.ipHistory, ['203.0.113.99', '203.0.113.45']);
  assert.equal(vikramView.accounts.length, 2);
  const origView = vikramView.accounts.find((a) => a.id === acct.id);
  assert.ok(origView);
  assert.equal(origView.feePaidUsd, 159);
  assert.equal(origView.purchaseIp, '203.0.113.99');

  // Owner settles the payout request
  const settled = store.updatePayoutStatus(
    ownerVerified.user.id,
    payout.payout.id,
    'Settled',
    { ip: '198.51.100.12', userAgent: 'Mozilla/5.0 Firefox/132' }
  );
  assert.equal(settled.ok, true);
  if (!settled.ok) return;
  assert.equal(settled.payout.status, 'Settled');
});

test('AuthStore generates dedicated Lemon Terminal credentials and server for each challenge account', () => {
  const store = new AuthStore({ persistPath: null, secret: 'test-terminal-secret' });
  const reg = store.registerUser({
    fullName: 'Pinki Devi',
    loginId: 'pinki_trader',
    email: 'pinki@lemonfunding.io',
    password: 'Password123!',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const verified = store.verifyEmailCode(reg.verificationToken, reg.otpCodeForMailer);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;

  const acctRes = store.createChallengeAccount(verified.user.id, {
    mode: 'two-step',
    accountSize: 5000,
    profitSplit: 80,
    platform: 'Lemon Terminal',
  });
  assert.equal(acctRes.ok, true);
  if (!acctRes.ok) return;
  const acct = acctRes.account;

  assert.equal(acct.platform, 'Lemon Terminal');
  assert.equal(acct.terminalServer, 'LemonFunding-Live');
  assert.ok(acct.terminalPassword && acct.terminalPassword.startsWith('LT-'));
  assert.ok(acct.investorPassword && acct.investorPassword.startsWith('INV-'));

  const dash = store.getDashboardForUser(verified.user.id);
  assert.ok(dash);
  assert.equal(dash.accounts.length, 1);
  assert.equal(dash.accounts[0].terminalServer, 'LemonFunding-Live');
  assert.equal(dash.accounts[0].terminalPassword, acct.terminalPassword);
});

test('AuthStore breaches account on live floating drawdown, locks further trades, and unlocks COMEBACK40 40% discount', () => {
  const store = new AuthStore({ persistPath: null, secret: 'test-breach-comeback-secret' });
  const reg = store.registerUser({
    fullName: 'Meera Nair',
    loginId: 'meera_trader',
    email: 'meera@lemonfunding.io',
    password: 'Password123!',
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const verified = store.verifyEmailCode(reg.verificationToken, reg.otpCodeForMailer);
  assert.equal(verified.ok, true);
  if (!verified.ok) return;

  // Before any breach, validatePromoCodeForUser rejects COMEBACK40
  const rejectedPromo = store.validatePromoCodeForUser(verified.user.id, 'COMEBACK40');
  assert.equal(rejectedPromo.ok, false);
  if (!rejectedPromo.ok) {
    assert.match(rejectedPromo.error, /breached account/i);
  }

  // Create a 1-Step $100,000 account (4% daily loss limit = $4,000) & approve via admin
  const adminSess2 = store.ensureAdminSession();
  const acctRes = store.createChallengeAccount(verified.user.id, {
    mode: 'one-step',
    accountSize: 100000,
    profitSplit: 80,
    platform: 'Lemon Terminal',
  });
  assert.equal(acctRes.ok, true);
  if (!acctRes.ok) return;
  assert.equal(acctRes.account.status, 'Pending Approval');
  const kycMeera = store.submitKycVerification(verified.user.id, {
    panSelected: true,
    aadhaarSelected: true,
    panImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarFrontImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    aadhaarBackImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  assert.equal(kycMeera.ok, true);
  if (kycMeera.ok) {
    store.reviewKycSubmission(adminSess2.user.id, kycMeera.submission.id, 'approve');
  }
  const approved = store.approveAccount(adminSess2.user.id, acctRes.account.id, 'approve');
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  const acct = approved.account;
  assert.equal(acct.dailyLossPct, 4);
  assert.equal(acct.status, 'Active Evaluation');

  // Trigger live floating loss breach (floating loss -4150 crosses 4% daily limit)
  const breachedRes = store.breachAccountFromLiveEquity(verified.user.id, {
    accountId: acct.id,
    floatingPnlUsd: -4150,
    liquidatedPositions: [
      {
        symbol: 'XAU/USD',
        side: 'BUY',
        lots: 2.5,
        pnlUsd: -4150,
      },
    ],
  });
  assert.equal(breachedRes.ok, true);
  if (!breachedRes.ok) return;
  assert.equal(breachedRes.account.status, 'Breached');
  assert.equal(breachedRes.account.currentEquity, 95850);
  assert.equal(breachedRes.comebackCode, 'COMEBACK40');
  assert.equal(breachedRes.comebackDiscountPct, 40);

  // Breached account permanently rejects subsequent trade execution
  const lockedTrade = store.logTrade(verified.user.id, {
    accountId: acct.id,
    symbol: 'EUR/USD',
    side: 'BUY',
    lots: 0.5,
    pnlUsd: 100,
    notes: 'Blocked after breach',
  });
  assert.equal(lockedTrade.ok, false);
  if (!lockedTrade.ok) {
    assert.equal(lockedTrade.status, 400);
    assert.match(lockedTrade.error, /breached/i);
  }

  // Dashboard reflects comeback eligibility and promo validation now passes
  const dashAfter = store.getDashboardForUser(verified.user.id);
  assert.ok(dashAfter);
  assert.equal(dashAfter.comebackEligible, true);
  assert.equal(dashAfter.comebackCode, 'COMEBACK40');

  const validPromo = store.validatePromoCodeForUser(verified.user.id, 'COMEBACK');
  assert.equal(validPromo.ok, true);
  if (validPromo.ok) {
    assert.equal(validPromo.appliedCode, 'COMEBACK40');
    assert.equal(validPromo.discountPct, 40);
  }

  // Trader can now purchase any account with COMEBACK40 (or COMEBACK) for 40% off
  const comebackAcctRes = store.createChallengeAccount(verified.user.id, {
    mode: 'two-step',
    accountSize: 100000,
    profitSplit: 80,
    platform: 'Lemon Terminal',
    promoCode: 'COMEBACK',
  });
  assert.equal(comebackAcctRes.ok, true);
  if (!comebackAcctRes.ok) return;
  const comebackAcct = comebackAcctRes.account;
  assert.equal(comebackAcct.feePaidUsd, Math.round(159 * 0.6));
  assert.equal(comebackAcct.promoCodeApplied, 'COMEBACK40');
  assert.equal(comebackAcct.discountPctApplied, 40);
});

test('AuthStore provides built-in demo check account LF-100001 / LemonDemo2026! for Lemon Terminal login', () => {
  const store = new AuthStore({ persistPath: null, secret: 'test-demo-terminal-secret' });
  const demoAcct = store.ensureDemoTerminalAccount();
  assert.equal(demoAcct.accountNumber, 'LF-100001');
  assert.equal(demoAcct.terminalServer, 'LemonFunding-Demo');
  assert.equal(demoAcct.terminalPassword, 'LemonDemo2026!');

  const resPlain = store.loginTerminalAccount('LF-100001', 'LemonDemo2026!');
  assert.equal(resPlain.ok, true);
  if (resPlain.ok) {
    assert.equal(resPlain.account.accountNumber, 'LF-100001');
    assert.ok(resPlain.accessToken);
  }

  const resHash = store.loginTerminalAccount('#lf-100001', 'LemonDemo2026!');
  assert.equal(resHash.ok, true);

  const resBadPass = store.loginTerminalAccount('LF-100001', 'WrongPass');
  assert.equal(resBadPass.ok, false);
});

test('AuthStore persists login, KYC, accounts & enforces strict one-time rewards and KYC across reloads', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemon-persist-'));
  const persistFile = path.join(tmpDir, 'store.json');
  const dummyImg =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  try {
    const store1 = new AuthStore({ persistPath: persistFile });
    const admin = store1.ensureAdminSession();

    const u1Reg = store1.registerUser({
      fullName: 'Kiran Verma',
      loginId: 'kiran_fx',
      email: 'kiran@lemonfunding.io',
      password: 'Password123!',
    });
    assert.equal(u1Reg.ok, true);
    if (!u1Reg.ok) return;
    const u1 = store1.verifyEmailCode(u1Reg.verificationToken, u1Reg.otpCodeForMailer);
    assert.equal(u1.ok, true);
    if (!u1.ok) return;

    // Submit & approve KYC once; duplicate KYC blocked
    const kyc1 = store1.submitKycVerification(u1.user.id, {
      panSelected: true,
      aadhaarSelected: true,
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '123456789012',
      panImageUrl: dummyImg,
      aadhaarFrontImageUrl: dummyImg,
      aadhaarBackImageUrl: dummyImg,
    });
    assert.equal(kyc1.ok, true);
    if (!kyc1.ok) return;
    store1.reviewKycSubmission(admin.user.id, kyc1.submission.id, 'approve');

    const kycDupSelf = store1.submitKycVerification(u1.user.id, {
      panSelected: true,
      aadhaarSelected: true,
      panImageUrl: dummyImg,
      aadhaarFrontImageUrl: dummyImg,
      aadhaarBackImageUrl: dummyImg,
    });
    assert.equal(kycDupSelf.ok, false);

    // Purchase challenge account
    const acctRes = store1.createChallengeAccount(u1.user.id, {
      mode: 'two-step',
      accountSize: 10000,
      profitSplit: 90,
      platform: 'Lemon Terminal',
    });
    assert.equal(acctRes.ok, true);
    if (!acctRes.ok) return;
    store1.approveAccount(admin.user.id, acctRes.account.id, 'approve');

    // Complete both social tasks once (+200 pts) and claim store reward once
    const t1 = store1.submitSocialTask(u1.user.id, {
      taskId: 'follow_x',
      handle: '@kiran_x',
      proofImageUrl: dummyImg,
    });
    const t2 = store1.submitSocialTask(u1.user.id, {
      taskId: 'follow_instagram',
      handle: '@kiran_ig',
      proofImageUrl: dummyImg,
    });
    assert.equal(t1.ok, true);
    assert.equal(t2.ok, true);
    if (t1.ok) store1.reviewSocialTask(admin.user.id, t1.submission.id, 'approve');
    if (t2.ok) store1.reviewSocialTask(admin.user.id, t2.submission.id, 'approve');

    const storeClaim1 = store1.redeemStoreItem(u1.user.id, 'redeem-2step-5k');
    assert.equal(storeClaim1.ok, true);

    // Give extra points & attempt a 2nd store redemption -> blocked (409)
    store1.adjustUserRewardPoints(admin.user.id, u1.user.id, 500, 'Test bonus');
    const storeClaim2 = store1.redeemStoreItem(u1.user.id, 'redeem-2step-10k');
    assert.equal(storeClaim2.ok, false);
    if (!storeClaim2.ok) assert.equal(storeClaim2.status, 409);

    // Claim 1 secret giveaway code -> allowed; claiming ANY 2nd secret code -> blocked (409)
    const codes = store1.getGiveawayCodesList().codes;
    assert.ok(codes.length >= 2);
    const sc1 = store1.redeemSecretCode(u1.user.id, codes[0].code);
    assert.equal(sc1.ok, true);
    const sc2 = store1.redeemSecretCode(u1.user.id, codes[1].code);
    assert.equal(sc2.ok, false);
    if (!sc2.ok) assert.equal(sc2.status, 409);

    // Second user cannot reuse same PAN/Aadhaar or same @handle
    const u2Reg = store1.registerUser({
      fullName: 'Second User',
      loginId: 'second_fx',
      email: 'second@lemonfunding.io',
      password: 'Password123!',
    });
    assert.equal(u2Reg.ok, true);
    if (!u2Reg.ok) return;
    const u2 = store1.verifyEmailCode(u2Reg.verificationToken, u2Reg.otpCodeForMailer);
    assert.equal(u2.ok, true);
    if (!u2.ok) return;

    const dupPanTry = store1.submitKycVerification(u2.user.id, {
      panSelected: true,
      aadhaarSelected: true,
      panNumber: 'ABCDE1234F',
      panImageUrl: dummyImg,
      aadhaarFrontImageUrl: dummyImg,
      aadhaarBackImageUrl: dummyImg,
    });
    assert.equal(dupPanTry.ok, false);
    if (!dupPanTry.ok) assert.equal(dupPanTry.status, 409);

    const dupHandleTry = store1.submitSocialTask(u2.user.id, {
      taskId: 'follow_x',
      handle: 'kiran_x',
      proofImageUrl: dummyImg,
    });
    assert.equal(dupHandleTry.ok, false);
    if (!dupHandleTry.ok) assert.equal(dupHandleTry.status, 409);

    store1.flushToDisk();

    // Reload fresh AuthStore instance simulating server restart & verify session + KYC + account + lock persist
    const store2 = new AuthStore({ persistPath: persistFile });
    const authedUser = store2.authenticateSession(`Bearer ${u1.accessToken}`);
    assert.ok(authedUser);
    assert.equal(authedUser.kycStatus, 'approved');

    const dash2 = store2.getDashboardForUser(u1.user.id);
    assert.ok(dash2);
    assert.equal(dash2.accounts.length, 1);
    assert.equal(dash2.accounts[0].accountNumber, acctRes.account.accountNumber);

    const kyc2 = store2.getKycForUser(u1.user.id);
    assert.ok(kyc2);
    assert.equal(kyc2.kycStatus, 'approved');
    assert.ok(kyc2.latestSubmission);

    // One-time locks still hold after restart
    const scAfterReload = store2.redeemSecretCode(u1.user.id, codes[2].code);
    assert.equal(scAfterReload.ok, false);
    const storeAfterReload = store2.redeemStoreItem(u1.user.id, 'redeem-2step-5k');
    assert.equal(storeAfterReload.ok, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


