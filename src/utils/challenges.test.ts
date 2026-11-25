import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTradingDayStats,
  evaluateAccountPayoutEligibility,
  getChallengeSpec,
  simulateChallengeDay,
  validateEnrollmentForm,
} from './challenges';

test('getChallengeSpec computes accurate 2-Step Classic parameters, boost fee, and 5-day minimum across all models', () => {
  const std = getChallengeSpec('two-step', 100000, 80);
  assert.equal(std.feeUsd, 159);
  assert.equal(std.phase1TargetUsd, 8000);
  assert.equal(std.phase2TargetUsd, 5000);
  assert.equal(std.dailyLossUsd, 5000);
  assert.equal(std.maxDrawdownUsd, 10000);
  assert.equal(std.minTradingDays, 5);
  assert.equal(std.feeRefundOnFirstPayout, true);

  const oneStep = getChallengeSpec('one-step', 25000, 80);
  assert.equal(oneStep.minTradingDays, 5);

  const instant = getChallengeSpec('instant', 5000, 80);
  assert.equal(instant.minTradingDays, 5);
  assert.equal(instant.phase1TargetUsd, 0);

  const boosted = getChallengeSpec('two-step', 100000, 90);
  assert.equal(boosted.profitSplitPct, 90);
  assert.equal(boosted.feeUsd, 159 + Math.round(159 * 0.15));
});

test('getChallengeSpec handles Instant Zest with 35% consistency rule and $2 5k bonus offer', () => {
  const instant50k = getChallengeSpec('instant', 50000, 80);
  assert.equal(instant50k.phase1TargetPct, 0);
  assert.equal(instant50k.phase1TargetUsd, 0);
  assert.equal(instant50k.phase2TargetUsd, null);
  assert.equal(instant50k.dailyLossUsd, 1500);
  assert.equal(instant50k.maxDrawdownUsd, 3000);
  assert.equal(instant50k.consistencyRulePct, 35);
  assert.equal(instant50k.floatingLossRulePct, 1);

  const instant5kPromo = getChallengeSpec('instant', 5000, 80);
  assert.equal(instant5kPromo.feeUsd, 2);
  assert.equal(instant5kPromo.isSpecialBonusOffer, true);
});

test('computeTradingDayStats and evaluateAccountPayoutEligibility enforce >=0.50% profit per day for min 5 days', () => {
  // $10,000 account => 0.50% daily minimum profit = $50/day
  const trades = [
    { executedAtIso: '2026-11-20T10:00:00.000Z', pnlUsd: 55 },
    { executedAtIso: '2026-11-21T10:00:00.000Z', pnlUsd: 50 },
    { executedAtIso: '2026-11-22T10:00:00.000Z', pnlUsd: 60 },
    { executedAtIso: '2026-11-23T10:00:00.000Z', pnlUsd: 52 },
    { executedAtIso: '2026-11-24T10:00:00.000Z', pnlUsd: 40 }, // < $50, should NOT qualify
  ];
  const stats = computeTradingDayStats(trades, 10000);
  assert.equal(stats.dailyMinProfitUsd, 50);
  assert.equal(stats.activeDatesCount, 5);
  assert.equal(stats.validTradingDays, 4);

  const blocked = evaluateAccountPayoutEligibility(
    {
      mode: 'instant',
      status: 'Instant Funded',
      startingBalance: 10000,
      currentEquity: 10257,
      profitSplitPct: 80,
    },
    trades
  );
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.validTradingDays, 4);

  // Add $15 on day 5 to push it to $55 (>= $50) => 5 valid days
  const eligible = evaluateAccountPayoutEligibility(
    {
      mode: 'instant',
      status: 'Instant Funded',
      startingBalance: 10000,
      currentEquity: 10272,
      profitSplitPct: 80,
    },
    [...trades, { executedAtIso: '2026-11-24T14:00:00.000Z', pnlUsd: 15 }]
  );
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.validTradingDays, 5);
  assert.equal(eligible.traderShareUsd, Math.round(272 * 0.8));
});

test('simulateChallengeDay detects safe, caution, passed, daily breach, and overall breach', () => {
  const spec = getChallengeSpec('two-step', 100000, 90);

  const safe = simulateChallengeDay(spec, {
    startingBalance: 100000,
    dayStartEquity: 100000,
    closedPnl: 1200,
    floatingPnl: 300,
  });
  assert.equal(safe.verdict, 'ACTIVE_SAFE');
  assert.equal(safe.currentEquity, 101500);
  assert.equal(safe.projectedTraderPayout, 1350);

  const caution = simulateChallengeDay(spec, {
    startingBalance: 100000,
    dayStartEquity: 100000,
    closedPnl: -3800,
    floatingPnl: 0,
  });
  assert.equal(caution.verdict, 'ACTIVE_CAUTION');
  assert.equal(caution.dailyBufferRemaining, 1200);

  const dailyBreach = simulateChallengeDay(spec, {
    startingBalance: 100000,
    dayStartEquity: 102000,
    closedPnl: -1000,
    floatingPnl: -4100,
  });
  assert.equal(dailyBreach.verdict, 'BREACHED_DAILY');

  const overallBreach = simulateChallengeDay(spec, {
    startingBalance: 100000,
    dayStartEquity: 92000,
    closedPnl: -9000,
    floatingPnl: -1200,
  });
  assert.equal(overallBreach.verdict, 'BREACHED_OVERALL');

  const passed = simulateChallengeDay(spec, {
    startingBalance: 100000,
    dayStartEquity: 106000,
    closedPnl: 8200,
    floatingPnl: 0,
  });
  assert.equal(passed.verdict, 'PASSED');
  assert.equal(passed.targetProgressPct, 100);
});

test('validateEnrollmentForm rejects invalid inputs and accepts valid details', () => {
  const bad = validateEnrollmentForm('A', 'not-an-email');
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.name);
  assert.ok(bad.errors.email);

  const good = validateEnrollmentForm('Rohan Sharma', 'rohan@lemonfunding.io');
  assert.equal(good.valid, true);
  assert.deepEqual(good.errors, {});
});
