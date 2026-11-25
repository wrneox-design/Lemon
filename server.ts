import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { AuthStore, maskEmail } from './src/server/authStore.ts';
import { MarketFeedService, type TimeFrame } from './src/server/marketFeed.ts';
import type {
  AccountSize,
  ChallengeMode,
  ProfitSplitOption,
  TradingPlatform,
} from './src/utils/challenges.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storeDir = process.env.LEMON_STORE_DIR?.trim() || path.join(__dirname, '.data');
const store = new AuthStore({
  persistPath: path.join(storeDir, 'lemonfunding-store.json'),
});
store.ensureDemoTerminalAccount();

const marketFeed = new MarketFeedService();
marketFeed.start();

interface DispatchResult {
  deliveryMode: 'email' | 'preview';
  deliveryNote: string;
}

async function dispatchVerificationEmail(
  toEmail: string,
  loginId: string,
  code: string
): Promise<DispatchResult> {
  if (!toEmail || !toEmail.includes('@')) {
    return {
      deliveryMode: 'preview',
      deliveryNote:
        'Recipient email unavailable for live delivery; verification code is ready in LemonMail Preview below.',
    };
  }

  const safeLoginId = loginId.replace(/[^a-zA-Z0-9_]/g, '') || 'trader';
  const safeCode = code.replace(/\D/g, '');
  const subject = `Verify your LemonFunding Trader ID (@${safeLoginId})`;
  const textBody = `Welcome to LemonFunding (@${safeLoginId}). Your 6-digit email verification code is: ${safeCode}. It expires in 10 minutes.`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #FCFBF4; color: #141A10; border: 1px solid #E5E7D6; border-radius: 14px;">
      <h2 style="margin: 0 0 12px; color: #141A10;">LemonFunding Email Verification</h2>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5;">
        Hi <strong>@${safeLoginId}</strong>, enter this 6-digit code to activate your LemonFunding Dashboard:
      </p>
      <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 14px 18px; background: #FEF08A; color: #141A10; border-radius: 10px; text-align: center; margin-bottom: 16px;">
        ${safeCode}
      </div>
      <p style="margin: 0; font-size: 12px; color: #556146;">
        This code expires in 10 minutes. If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  // 1. Gmail SMTP via App Password
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  if (gmailUser && gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });
      await transporter.sendMail({
        from: `"LemonFunding" <${gmailUser}>`,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return {
        deliveryMode: 'email',
        deliveryNote: `Verification email sent to ${maskEmail(toEmail)} via Gmail.`,
      };
    } catch {
      return {
        deliveryMode: 'preview',
        deliveryNote:
          'Gmail SMTP could not send right now (verify GMAIL_USER and 16-char GMAIL_APP_PASSWORD in Secrets). Your 6-digit code is ready in LemonMail Preview below.',
      };
    }
  }

  // 2. Generic SMTP Server
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;
  if (smtpHost && smtpUser && smtpPass && smtpFrom) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return {
        deliveryMode: 'email',
        deliveryNote: `Verification email sent to ${maskEmail(toEmail)}.`,
      };
    } catch {
      return {
        deliveryMode: 'preview',
        deliveryNote:
          'SMTP delivery failed with the current server settings. Your 6-digit code is ready in LemonMail Preview below.',
      };
    }
  }

  // 3. Resend API
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM?.trim();
  if (resendKey && resendFrom) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [toEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (resp.ok) {
        return {
          deliveryMode: 'email',
          deliveryNote: `Verification email sent to ${maskEmail(toEmail)}.`,
        };
      }
    } catch {
      // Fallback to preview delivery if outbound mail fails
    }
  }

  return {
    deliveryMode: 'preview',
    deliveryNote:
      'Live Gmail/SMTP secrets are not configured on the server yet, so your 6-digit code is displayed directly in LemonMail Preview below.',
  };
}

function getRequestContext(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded
      : req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : 'Unknown device';
  return { ip: rawIp, userAgent };
}

async function createServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '25mb' }));

  // Ensure PWA manifest & Service Worker always serve with compliant headers
  app.use((req, res, next) => {
    if (req.path === '/manifest.json') {
      res.type('application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (req.path === '/sw.js') {
      res.type('application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  // Real-Time Market Quotes, Klines & SSE Stream
  app.get('/api/market/quotes', (_req, res) => {
    res.json({ quotes: marketFeed.getQuotes(), serverTime: Date.now() });
  });

  app.get('/api/market/candles', async (req, res) => {
    const symbol = String(req.query.symbol || 'XAUUSD.');
    const rawInterval = String(req.query.interval || 'M15') as TimeFrame;
    const validIntervals: TimeFrame[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
    const interval = validIntervals.includes(rawInterval) ? rawInterval : 'M15';
    const limit = Math.min(200, Math.max(30, Number(req.query.limit) || 140));
    const data = await marketFeed.getCandles(symbol, interval, limit);
    res.json({ ...data, interval, serverTime: Date.now() });
  });

  app.get('/api/market/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendSnapshot = (quotes: ReturnType<typeof marketFeed.getQuotes>) => {
      res.write(`data: ${JSON.stringify({ quotes, serverTime: Date.now() })}\n\n`);
    };

    sendSnapshot(marketFeed.getQuotes());
    const unsubscribe = marketFeed.subscribe(sendSnapshot);
    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  // Auth & Email Verification Routes
  app.post('/api/auth/register', async (req, res) => {
    const body = req.body ?? {};
    const result = store.registerUser(
      {
        fullName: String(body.fullName ?? ''),
        loginId: String(body.loginId ?? ''),
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
      },
      getRequestContext(req)
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const dispatch = await dispatchVerificationEmail(
      result.user.email,
      result.user.loginId,
      result.otpCodeForMailer
    );

    res.status(201).json({
      user: result.user,
      verificationToken: result.verificationToken,
      emailMasked: result.emailMasked,
      deliveryMode: dispatch.deliveryMode,
      deliveryNote: dispatch.deliveryNote,
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const body = req.body ?? {};
    const identifier = String(body.identifier ?? '');
    const password = String(body.password ?? '');

    if (!identifier.trim() || !password) {
      res.status(400).json({ error: 'Enter your Login ID or email and password.' });
      return;
    }

    const result = store.loginUser(identifier, password, getRequestContext(req));
    if (!result.ok) {
      if (result.requiresVerification && result.verificationToken && result.otpCodeForMailer) {
        const dispatch = await dispatchVerificationEmail(
          result.toEmail || '',
          result.loginId || identifier,
          result.otpCodeForMailer
        );
        res.status(403).json({
          error: result.error,
          requiresVerification: true,
          verificationToken: result.verificationToken,
          emailMasked: result.emailMasked,
          deliveryMode: dispatch.deliveryMode,
          deliveryNote: dispatch.deliveryNote,
        });
        return;
      }
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.get('/api/auth/preview-inbox', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing verification token.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const inbox = store.getPreviewInboxMessage(token);
    if (!inbox.ok) {
      res.status(inbox.status).json({ error: inbox.error });
      return;
    }
    res.json(inbox);
  });

  app.post('/api/auth/resend-code', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing verification token.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const result = store.resendVerificationCode(token);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const dispatch = await dispatchVerificationEmail(
      result.toEmail,
      result.loginId,
      result.otpCodeForMailer
    );
    res.json({
      verificationToken: result.verificationToken,
      emailMasked: result.emailMasked,
      deliveryMode: dispatch.deliveryMode,
      deliveryNote: dispatch.deliveryNote,
    });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing verification token.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const code = String(req.body?.code ?? '');
    if (!/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ error: 'Enter the 6-digit verification code.' });
      return;
    }

    const result = store.verifyEmailCode(token, code, getRequestContext(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post('/api/terminal/login', (req, res) => {
    const body = req.body ?? {};
    const result = store.loginTerminalAccount(
      String(body.accountNumber ?? ''),
      String(body.terminalPassword ?? '')
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      accessToken: result.accessToken,
      user: result.user,
      account: result.account,
      trades: result.trades,
    });
  });

  // Protected Dashboard API Routes
  app.get('/api/dashboard', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Sign in with a verified account to view the dashboard.' });
      return;
    }
    const data = store.getDashboardForUser(user.id);
    if (!data) {
      res.status(404).json({ error: 'User dashboard not found.' });
      return;
    }
    res.json(data);
  });

  app.post('/api/dashboard/accounts', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const validModes: ChallengeMode[] = ['one-step', 'two-step', 'instant'];
    const validSizes: AccountSize[] = [2500, 5000, 10000, 25000, 50000, 100000, 200000];
    const validSplits: ProfitSplitOption[] = [80, 90];
    const validPlatforms: TradingPlatform[] = ['Lemon Terminal', 'MetaTrader 5', 'cTrader', 'TradeLocker'];

    const mode = validModes.includes(body.mode) ? (body.mode as ChallengeMode) : 'two-step';
    const accountSize = validSizes.includes(Number(body.accountSize) as AccountSize)
      ? (Number(body.accountSize) as AccountSize)
      : 100000;
    const rawSplit = Number(body.profitSplit ?? body.profitSplitPct);
    const profitSplit = validSplits.includes(rawSplit as ProfitSplitOption)
      ? (rawSplit as ProfitSplitOption)
      : 80;
    const platform = validPlatforms.includes(body.platform)
      ? (body.platform as TradingPlatform)
      : 'Lemon Terminal';
    const promoCode = typeof body.promoCode === 'string' ? body.promoCode.trim() : '';
    const paymentMethod =
      typeof body.paymentMethod === 'string' && body.paymentMethod.trim()
        ? body.paymentMethod.trim().slice(0, 64)
        : 'Crypto (BNB BEP20)';
    const rawProof = typeof body.paymentProofUrl === 'string' ? body.paymentProofUrl.trim() : '';
    if (rawProof && !rawProof.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid payment proof image format.' });
      return;
    }

    if (promoCode) {
      const promoCheck = store.validatePromoCodeForUser(user.id, promoCode);
      if (!promoCheck.ok) {
        res.status(400).json({ error: promoCheck.error });
        return;
      }
    }

    const result = store.createChallengeAccount(
      user.id,
      {
        mode,
        accountSize,
        profitSplit,
        platform,
        promoCode: promoCode || undefined,
        paymentMethod,
        paymentProofUrl: rawProof || undefined,
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ account: result.account });
  });

  app.post('/api/promo/validate', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required to validate account coupon usage.' });
      return;
    }
    const promoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim() : '';
    const check = store.validatePromoCodeForUser(user.id, promoCode);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }
    res.json({
      ok: true,
      appliedCode: check.appliedCode,
      discountPct: check.discountPct,
    });
  });

  app.post('/api/dashboard/trades', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const result = store.logTrade(
      user.id,
      {
        accountId: String(body.accountId ?? ''),
        symbol: String(body.symbol ?? ''),
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        lots: Number(body.lots),
        pnlUsd: Number(body.pnlUsd),
        notes: String(body.notes ?? ''),
      },
      getRequestContext(req)
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      account: result.account,
      trade: result.trade,
      comebackEligible: store.isUserComebackEligible(user.id),
      comebackCode: result.account.status === 'Breached' ? 'COMEBACK40' : null,
      comebackDiscountPct: result.account.status === 'Breached' ? 40 : 0,
    });
  });

  app.post('/api/dashboard/breach', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const result = store.breachAccountFromLiveEquity(
      user.id,
      {
        accountId: String(body.accountId ?? ''),
        floatingPnlUsd: Number(body.floatingPnlUsd ?? 0),
        liquidatedPositions: Array.isArray(body.liquidatedPositions)
          ? body.liquidatedPositions
          : [],
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      account: result.account,
      comebackCode: result.comebackCode,
      comebackDiscountPct: result.comebackDiscountPct,
    });
  });

  app.post('/api/dashboard/payouts', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const allowedMethods = ['BNB BEP20', 'Rise', 'USDC', 'Bank Wire'] as const;
    const method = allowedMethods.includes(body.method) ? body.method : 'BNB BEP20';
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : undefined;

    const result = store.requestPayout(
      user.id,
      {
        accountId: String(body.accountId ?? ''),
        method,
        walletAddress,
      },
      getRequestContext(req)
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      payout: result.payout,
      account: result.account,
      certificate: result.certificate,
    });
  });

  // Rewards, Tasks, Secret Code & Store Routes (Authenticated Trader)
  app.get('/api/rewards', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Sign in with a verified account to view rewards.' });
      return;
    }
    const data = store.getRewardsForUser(user.id);
    if (!data) {
      res.status(404).json({ error: 'Rewards profile not found.' });
      return;
    }
    res.json(data);
  });

  app.post('/api/rewards/tasks', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const taskId = body.taskId === 'follow_instagram' ? 'follow_instagram' : body.taskId === 'follow_x' ? 'follow_x' : null;
    if (!taskId) {
      res.status(400).json({ error: 'Invalid reward task selected.' });
      return;
    }
    const result = store.submitSocialTask(
      user.id,
      {
        taskId,
        handle: String(body.handle ?? ''),
        proofImageUrl: String(body.proofImageUrl ?? ''),
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ submission: result.submission });
  });

  app.post('/api/rewards/redeem', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const storeItemId = String(req.body?.storeItemId ?? '');
    const result = store.redeemStoreItem(user.id, storeItemId, getRequestContext(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      request: result.request,
      remainingPoints: result.remainingPoints,
    });
  });

  app.post('/api/rewards/secret-code', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const code = String(req.body?.code ?? '');
    const result = store.redeemSecretCode(user.id, code, getRequestContext(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      request: result.request,
      rollPct: result.rollPct,
    });
  });

  // Trader KYC Verification Routes (PAN Card + Aadhaar Front & Back)
  app.get('/api/kyc', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const kyc = store.getKycForUser(user.id);
    if (!kyc) {
      res.status(404).json({ error: 'KYC profile not found.' });
      return;
    }
    res.json(kyc);
  });

  app.post('/api/kyc/submit', (req, res) => {
    const user = store.authenticateSession(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const result = store.submitKycVerification(
      user.id,
      {
        panSelected: Boolean(body.panSelected),
        aadhaarSelected: Boolean(body.aadhaarSelected),
        panNumber: typeof body.panNumber === 'string' ? body.panNumber : undefined,
        aadhaarNumber: typeof body.aadhaarNumber === 'string' ? body.aadhaarNumber : undefined,
        panImageUrl: String(body.panImageUrl ?? ''),
        aadhaarFrontImageUrl: String(body.aadhaarFrontImageUrl ?? ''),
        aadhaarBackImageUrl: String(body.aadhaarBackImageUrl ?? ''),
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      submission: result.submission,
      user: result.user,
    });
  });

  // Owner-Only Admin API Routes (Restricted to verified ADMIN_EMAIL)
  app.get('/api/admin/overview', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const overview = store.getAdminOverview(auth.user.id);
    if (!overview.ok) {
      res.status(overview.status).json({ error: overview.error });
      return;
    }
    res.json(overview.data);
  });

  app.patch('/api/admin/accounts/:accountId/approval', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const accountId = String(req.params.accountId ?? '');
    const action = req.body?.action === 'approve' ? 'approve' : 'reject';
    const result = store.approveAccount(auth.user.id, accountId, action, getRequestContext(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ account: result.account });
  });

  app.patch('/api/admin/kyc/:kycId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const kycId = String(req.params.kycId ?? '');
    const action = req.body?.action === 'approve' ? 'approve' : 'reject';
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote : undefined;
    const result = store.reviewKycSubmission(
      auth.user.id,
      kycId,
      action,
      adminNote,
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ submission: result.submission, user: result.user });
  });

  app.patch('/api/admin/tasks/:submissionId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const submissionId = String(req.params.submissionId ?? '');
    const action = req.body?.action === 'approve' ? 'approve' : 'reject';
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote : undefined;
    const result = store.reviewSocialTask(
      auth.user.id,
      submissionId,
      action,
      adminNote,
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ submission: result.submission });
  });

  app.patch('/api/admin/redemptions/:redemptionId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const redemptionId = String(req.params.redemptionId ?? '');
    const action = req.body?.action === 'approve' ? 'approve' : 'reject';
    const result = store.reviewRedemptionRequest(
      auth.user.id,
      redemptionId,
      action,
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ request: result.request, issuedAccount: result.issuedAccount });
  });

  app.post('/api/admin/secret-codes', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const body = req.body ?? {};
    const result = store.createSecretCodeDrop(
      auth.user.id,
      {
        code: String(body.code ?? ''),
        label: typeof body.label === 'string' ? body.label : undefined,
        maxUses: Number(body.maxUses),
        mythicChancePct: Number(body.mythicChancePct),
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ drop: result.drop });
  });

  app.patch('/api/admin/secret-codes/:codeId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const codeId = String(req.params.codeId ?? '');
    const result = store.toggleSecretCodeDrop(auth.user.id, codeId, Boolean(req.body?.active));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ drop: result.drop });
  });

  app.delete('/api/admin/secret-codes/:codeId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const codeId = String(req.params.codeId ?? '');
    const result = store.deleteSecretCodeDrop(auth.user.id, codeId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.patch('/api/admin/accounts/:accountId/manage', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const accountId = String(req.params.accountId ?? '');
    const status = typeof req.body?.status === 'string' ? req.body.status : undefined;
    const resetEquity = Boolean(req.body?.resetEquity);
    const result = store.manageChallengeAccount(
      auth.user.id,
      accountId,
      {
        status: status as
          | 'Pending Approval'
          | 'Active Evaluation'
          | 'Target Passed'
          | 'Instant Funded'
          | 'Breached'
          | undefined,
        resetEquity,
      },
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ account: result.account });
  });

  app.patch('/api/admin/users/:userId/points', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const userId = String(req.params.userId ?? '');
    const delta = Number(req.body?.delta ?? 0);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = store.adjustUserRewardPoints(
      auth.user.id,
      userId,
      delta,
      reason,
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  app.patch('/api/admin/users/:userId/verify-email', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const userId = String(req.params.userId ?? '');
    const result = store.verifyUserEmailByAdmin(auth.user.id, userId, getRequestContext(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  app.patch('/api/admin/payouts/:payoutId', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const status = req.body?.status === 'Settled' ? 'Settled' : 'Processing';
    const result = store.updatePayoutStatus(
      auth.user.id,
      String(req.params.payoutId ?? ''),
      status,
      getRequestContext(req)
    );
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ payout: result.payout });
  });

  app.get('/api/admin/giveaway-codes', (req, res) => {
    const auth = store.authenticateAdmin(req.headers.authorization);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const data = store.getGiveawayCodesList();
    res.json(data);
  });

  // Public Certificate Verification API (for QR code scan & URL verification)
  app.get('/api/certificates/:certId', (req, res) => {
    const certId = String(req.params.certId ?? '').trim();
    if (!certId) {
      res.status(400).json({ error: 'Certificate ID is required.' });
      return;
    }
    const certificate = store.getCertificate(certId);
    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found or invalid reference ID.' });
      return;
    }
    res.json({ ok: true, certificate });
  });

  // Vite dev middleware or production static assets
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const PORT = 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`LemonFunding server listening on http://localhost:${PORT}`);
  });

  const handleShutdown = () => {
    try {
      store.flushToDisk();
    } finally {
      server.close(() => process.exit(0));
    }
  };
  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

createServer();
