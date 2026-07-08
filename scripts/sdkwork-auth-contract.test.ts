import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-clawstudio-auth keeps the V5 auth entry surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-clawstudio-auth/package.json');
  const locales = readJson<{
    auth?: {
      account?: string;
      phone?: string;
      verificationCode?: string;
      loginMethods?: {
        password?: string;
        phoneCode?: string;
        emailCode?: string;
      };
      registerMethods?: {
        email?: string;
        phone?: string;
      };
      registerHighlights?: {
        email?: string;
        phone?: string;
        password?: string;
      };
      registerFields?: {
        username?: string;
        email?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
        verificationCode?: string;
      };
      forgotPasswordFields?: {
        account?: string;
        code?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      resetHighlights?: {
        email?: string;
        phone?: string;
        password?: string;
      };
      actions?: {
        sendCode?: string;
        resendCode?: string;
        usePassword?: string;
        usePhoneCode?: string;
        useEmailCode?: string;
        startReset?: string;
        completeReset?: string;
      };
      qrLogin?: string;
      qrDesc?: string;
      openApp?: string;
      welcomeBack?: string;
      securityBadge?: string;
      securityHint?: string;
      loginMethodDescriptions?: {
        password?: string;
        phoneCode?: string;
        emailCode?: string;
      };
      qrSteps?: {
        open?: string;
        scan?: string;
        confirm?: string;
      };
      providers?: {
        wechat?: string;
        douyin?: string;
        github?: string;
        google?: string;
      };
      qrAlt?: string;
      qrRefresh?: string;
      qrScannedHint?: string;
      qrTypeHints?: {
        default?: string;
        wechatOfficialAccount?: string;
      };
      qrStatus?: {
        loading?: string;
        pending?: string;
        scanned?: string;
        confirmed?: string;
        expired?: string;
        error?: string;
      };
      errors?: {
        oauthStartFailed?: string;
        qrGenerateFailed?: string;
        qrStatusFailed?: string;
        invalidQrPayload?: string;
      };
      oauth?: {
        badge?: string;
        helper?: string;
        providerHints?: {
          wechat?: string;
          douyin?: string;
          github?: string;
          google?: string;
        };
        processingTitle?: string;
        failedTitle?: string;
        invalidProvider?: string;
        missingCode?: string;
      };
    };
  }>('packages/sdkwork-clawstudio-i18n/src/locales/en.json');
  const indexSource = read('packages/sdkwork-clawstudio-auth/src/index.ts');

  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/pages/Auth.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/pages/AuthPage.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/pages/AuthOAuthCallbackPage.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/pages/authRouteUtils.ts'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/AuthMethodTabs.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/AccountPasswordLoginForm.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/PhoneCodeLoginForm.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/EmailCodeLoginForm.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/RegisterFlow.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/ForgotPasswordFlow.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/QrLoginPanel.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/OAuthProviderGrid.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-auth/src/components/auth/authConfig.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/clawstudio-studio-auth']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-auth/);
  assert.match(indexSource, /\.\/pages\/Auth/);
  assert.match(indexSource, /\.\/pages\/AuthOAuthCallbackPage/);
  assert.match(indexSource, /setAuthRuntimeConfig/);
  assert.match(indexSource, /getAuthRuntimeConfig/);
  assert.match(indexSource, /clearAuthRuntimeConfig/);
  assert.match(indexSource, /AuthRuntimeConfig/);

  const authSource = read('packages/sdkwork-clawstudio-auth/src/pages/AuthPage.tsx');
  const callbackSource = read('packages/sdkwork-clawstudio-auth/src/pages/AuthOAuthCallbackPage.tsx');
  const routeUtilsSource = read('packages/sdkwork-clawstudio-auth/src/pages/authRouteUtils.ts');
  const authConfigSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/authConfig.ts');
  const registerSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/RegisterFlow.tsx');
  const forgotSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/ForgotPasswordFlow.tsx');
  const qrPanelSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/QrLoginPanel.tsx');
  const accountPasswordLoginFormSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/AccountPasswordLoginForm.tsx');
  const authMethodTabsSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/AuthMethodTabs.tsx');
  const oauthProviderGridSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/OAuthProviderGrid.tsx');
  const verificationCodeFieldSource = read('packages/sdkwork-clawstudio-auth/src/components/auth/VerificationCodeField.tsx');
  assert.match(authSource, /useTranslation/);
  assert.match(authSource, /AuthMethodTabs/);
  assert.match(authSource, /AccountPasswordLoginForm/);
  assert.match(authSource, /PhoneCodeLoginForm/);
  assert.match(authSource, /EmailCodeLoginForm/);
  assert.match(authSource, /RegisterFlow/);
  assert.match(authSource, /ForgotPasswordFlow/);
  assert.match(authSource, /QrLoginPanel/);
  assert.match(authSource, /OAuthProviderGrid/);
  assert.match(authSource, /resolveAuthOAuthProviders\(\)/);
  assert.match(authSource, /registerMethods\.includes\('email'\)/);
  assert.match(authSource, /registerMethods\.includes\('phone'\)/);
  assert.match(authSource, /recoveryMethods\.includes\('email'\)/);
  assert.match(authSource, /recoveryMethods\.includes\('phone'\)/);
  assert.match(
    authSource,
    /\{mode !== 'login' \? \(/,
    'Login mode should skip the eyebrow badge to avoid duplicating the main welcome-back heading.',
  );
  assert.doesNotMatch(authSource, /resolveAuthOAuthProviders\(DEFAULT_AUTH_OAUTH_PROVIDERS\)/);
  assert.doesNotMatch(authSource, /SOCIAL_PROVIDERS: AppAuthSocialProvider\[] = \['wechat', 'douyin', 'github', 'google'\]/);
  assert.match(callbackSource, /signInWithOAuth/);
  assert.match(callbackSource, /resolveAuthOAuthProviders\(\)/);
  assert.doesNotMatch(callbackSource, /resolveAuthOAuthProviders\(DEFAULT_AUTH_OAUTH_PROVIDERS\)/);
  assert.doesNotMatch(callbackSource, /provider === 'wechat'/);
  assert.doesNotMatch(callbackSource, /provider === 'douyin'/);
  assert.doesNotMatch(callbackSource, /provider === 'github'/);
  assert.doesNotMatch(callbackSource, /provider === 'google'/);
  assert.match(callbackSource, /t\('auth\.oauth\.processingTitle'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.failedTitle'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.invalidProvider'\)/);
  assert.match(callbackSource, /t\('auth\.oauth\.missingCode'\)/);
  assert.match(authConfigSource, /DEFAULT_AUTH_OAUTH_PROVIDERS/);
  assert.match(authConfigSource, /wechat/);
  assert.match(authConfigSource, /douyin/);
  assert.match(authConfigSource, /github/);
  assert.match(authConfigSource, /google/);
  assert.match(routeUtilsSource, /\/login\/oauth\/callback\/\$\{provider\}/);
  assert.match(routeUtilsSource, /rawTarget\.split\(\/\[\?#\]\//);
  assert.match(routeUtilsSource, /targetPathname\.startsWith\('\/login\/oauth\/callback'\)/);
  assert.match(routeUtilsSource, /rawTarget\.startsWith\('\/\/'\)/);
  assert.match(registerSource, /resetCooldown\(\)/);
  assert.match(registerSource, /setVerificationCode\(''\)/);
  assert.match(forgotSource, /resetCooldown\(\)/);
  assert.match(forgotSource, /setCode\(''\)/);
  assert.match(qrPanelSource, /aspect-square/);
  assert.match(authSource, /bg-zinc-100 dark:bg-zinc-950/);
  assert.doesNotMatch(authSource, /border border-white\/70/);
  assert.doesNotMatch(authSource, /shadow-\[0_40px_120px/);
  assert.match(authMethodTabsSource, /rounded-2xl bg-zinc-100\/80 p-1 dark:bg-zinc-900\/80/);
  assert.doesNotMatch(authMethodTabsSource, /border border-zinc-200\/80/);
  assert.doesNotMatch(authMethodTabsSource, /rounded-\[24px\]/);
  assert.doesNotMatch(authMethodTabsSource, /py-4/);
  assert.doesNotMatch(authMethodTabsSource, /h-10 w-10/);
  assert.doesNotMatch(authMethodTabsSource, /bg-\[linear-gradient\(90deg/);
  assert.doesNotMatch(authMethodTabsSource, /rgba\(99,102,241/);
  assert.doesNotMatch(authMethodTabsSource, /rgba\(16,185,129/);
  assert.match(oauthProviderGridSource, /auth\.oauth\.helper/);
  assert.match(oauthProviderGridSource, /auth\.oauth\.providerHints\./);
  assert.match(oauthProviderGridSource, /rounded-2xl bg-zinc-100\/80 px-4 py-3 dark:bg-zinc-900\/80/);
  assert.doesNotMatch(oauthProviderGridSource, /resolveProviderTone/);
  assert.doesNotMatch(oauthProviderGridSource, /border-sky-|border-emerald-|border-fuchsia-/);
  assert.doesNotMatch(oauthProviderGridSource, /bg-primary-50|bg-primary-500\/10/);
  assert.doesNotMatch(oauthProviderGridSource, /group-hover:bg-primary-50|group-hover:bg-primary-500\/10/);
  assert.doesNotMatch(oauthProviderGridSource, /shadow-\[/);
  assert.doesNotMatch(qrPanelSource, /justify-between/);
  assert.match(qrPanelSource, /justify-center/);
  assert.doesNotMatch(qrPanelSource, /border border-white\/10/);
  assert.doesNotMatch(qrPanelSource, /shadow-\[0_24px_60px/);
  assert.doesNotMatch(accountPasswordLoginFormSource, /onForgotPassword/);
  assert.ok(
    authSource.indexOf("t('auth.forgotPassword')") < authSource.indexOf('<OAuthProviderGrid'),
    'Forgot-password action should stay above the OAuth area for discoverability.',
  );
  assert.ok(
    authSource.indexOf("t('auth.noAccount')") < authSource.indexOf('<OAuthProviderGrid'),
    'Register entry should stay above the OAuth area for discoverability.',
  );
  assert.match(
    authSource,
    /\{mode === 'register' \? \([\s\S]*t\('auth\.signIn'\)[\s\S]*\) : mode === 'forgot' \? \([\s\S]*t\('auth\.backToLogin'\)[\s\S]*\) : null\}/,
    'Only register and forgot modes should render the footer navigation actions.',
  );
  assert.match(verificationCodeFieldSource, /autoComplete = 'one-time-code'/);
  assert.match(verificationCodeFieldSource, /required = true/);
  assert.match(verificationCodeFieldSource, /autoComplete=\{autoComplete\}/);
  assert.match(verificationCodeFieldSource, /required=\{required\}/);
  assert.doesNotMatch(qrPanelSource, /qrWeChatHint/);
  assert.doesNotMatch(qrPanelSource, /qrCode\?\.qrContent/);
  assert.match(qrPanelSource, /resolveAuthQrTypeHintKey/);
  assert.equal(locales.auth?.account, 'Account');
  assert.equal(locales.auth?.phone, 'Phone');
  assert.equal(locales.auth?.verificationCode, 'Verification Code');
  assert.equal(locales.auth?.loginMethods?.password, 'Password');
  assert.equal(locales.auth?.loginMethods?.phoneCode, 'Phone Code');
  assert.equal(locales.auth?.loginMethods?.emailCode, 'Email Code');
  assert.equal(locales.auth?.registerMethods?.email, 'Email Registration');
  assert.equal(locales.auth?.registerMethods?.phone, 'Phone Registration');
  assert.equal(locales.auth?.registerHighlights?.email, 'Verify ownership with a work email address.');
  assert.equal(locales.auth?.registerHighlights?.phone, 'Use a phone code when mobile-first onboarding is preferred.');
  assert.equal(locales.auth?.registerHighlights?.password, 'Set a strong password for everyday sign-in.');
  assert.equal(locales.auth?.registerFields?.username, 'Username');
  assert.equal(locales.auth?.registerFields?.email, 'Email Address');
  assert.equal(locales.auth?.registerFields?.phone, 'Phone Number');
  assert.equal(locales.auth?.registerFields?.password, 'Password');
  assert.equal(locales.auth?.registerFields?.confirmPassword, 'Confirm Password');
  assert.equal(locales.auth?.registerFields?.verificationCode, 'Verification Code');
  assert.equal(locales.auth?.forgotPasswordFields?.account, 'Account');
  assert.equal(locales.auth?.forgotPasswordFields?.code, 'Verification Code');
  assert.equal(locales.auth?.forgotPasswordFields?.newPassword, 'New Password');
  assert.equal(locales.auth?.forgotPasswordFields?.confirmPassword, 'Confirm Password');
  assert.equal(locales.auth?.resetHighlights?.email, 'Send a reset code through the verified email channel.');
  assert.equal(locales.auth?.resetHighlights?.phone, 'Use SMS recovery when the account is linked to a phone number.');
  assert.equal(locales.auth?.resetHighlights?.password, 'Finish the reset by confirming a brand-new password.');
  assert.equal(locales.auth?.actions?.sendCode, 'Send Code');
  assert.equal(locales.auth?.actions?.resendCode, 'Resend Code');
  assert.equal(locales.auth?.actions?.usePassword, 'Use Password');
  assert.equal(locales.auth?.actions?.usePhoneCode, 'Use Phone Code');
  assert.equal(locales.auth?.actions?.useEmailCode, 'Use Email Code');
  assert.equal(locales.auth?.actions?.startReset, 'Send Reset Code');
  assert.equal(locales.auth?.actions?.completeReset, 'Reset Password');
  assert.equal(locales.auth?.qrLogin, 'Scan to Login');
  assert.equal(locales.auth?.qrDesc, 'Scan with a supported app to complete sign-in instantly.');
  assert.equal(locales.auth?.openApp, 'Open the linked app to scan and approve sign-in.');
  assert.equal(locales.auth?.welcomeBack, 'Welcome back');
  assert.equal(locales.auth?.providers?.wechat, 'WeChat');
  assert.equal(locales.auth?.providers?.douyin, 'Douyin');
  assert.equal(locales.auth?.providers?.github, 'GitHub');
  assert.equal(locales.auth?.providers?.google, 'Google');
  assert.equal(locales.auth?.qrAlt, 'Login QR code');
  assert.equal(locales.auth?.qrRefresh, 'Refresh QR code');
  assert.equal(locales.auth?.qrScannedHint, 'QR scanned. Confirm the login in the linked app to continue.');
  assert.equal(locales.auth?.qrTypeHints?.default, 'Supports backend-issued QR sign-in and approval flows.');
  assert.equal(locales.auth?.qrTypeHints?.wechatOfficialAccount, 'Supports WeChat official account QR sign-in from the backend.');
  assert.equal(locales.auth?.qrStatus?.loading, 'Preparing QR code...');
  assert.equal(locales.auth?.qrStatus?.pending, 'Scan the QR code to continue');
  assert.equal(locales.auth?.qrStatus?.scanned, 'QR code scanned');
  assert.equal(locales.auth?.qrStatus?.confirmed, 'Login confirmed');
  assert.equal(locales.auth?.qrStatus?.expired, 'QR code expired');
  assert.equal(locales.auth?.qrStatus?.error, 'QR status unavailable');
  assert.equal(locales.auth?.errors?.oauthStartFailed, 'Failed to start social sign-in.');
  assert.equal(locales.auth?.errors?.qrGenerateFailed, 'Failed to load the login QR code.');
  assert.equal(locales.auth?.errors?.qrStatusFailed, 'Failed to refresh QR login status.');
  assert.equal(locales.auth?.errors?.invalidQrPayload, 'The backend returned an invalid QR code payload.');
  assert.equal(locales.auth?.oauth?.badge, 'OAuth Sign-In');
  assert.equal(locales.auth?.oauth?.helper, 'Use a trusted identity provider configured for this workspace.');
  assert.equal(locales.auth?.oauth?.providerHints?.wechat, 'Scan or authorize through the WeChat identity flow.');
  assert.equal(locales.auth?.oauth?.providerHints?.douyin, 'Continue with Douyin for creator and mobile-first sign-in.');
  assert.equal(locales.auth?.oauth?.providerHints?.github, 'Use your GitHub identity for engineering-oriented workspaces.');
  assert.equal(locales.auth?.oauth?.providerHints?.google, 'Continue with your Google workspace identity.');
  assert.equal(locales.auth?.oauth?.processingTitle, 'Completing sign-in');
  assert.equal(locales.auth?.oauth?.failedTitle, 'Sign-in failed');
  assert.equal(locales.auth?.oauth?.invalidProvider, 'Unsupported OAuth provider.');
  assert.equal(locales.auth?.oauth?.missingCode, 'Authorization code is missing.');
});

runTest('sdkwork-clawstudio-auth leaves desktop window controls to the shared shell header', () => {
  const authSource = read('packages/sdkwork-clawstudio-auth/src/pages/AuthPage.tsx');
  const callbackSource = read('packages/sdkwork-clawstudio-auth/src/pages/AuthOAuthCallbackPage.tsx');

  assert.doesNotMatch(authSource, /DesktopWindowControls/);
  assert.doesNotMatch(authSource, /data-slot="auth-window-chrome"/);
  assert.doesNotMatch(authSource, /variant="floating"/);
  assert.doesNotMatch(callbackSource, /DesktopWindowControls/);
  assert.doesNotMatch(callbackSource, /data-slot="auth-window-chrome"/);
  assert.doesNotMatch(callbackSource, /variant="floating"/);
});

runTest('sdkwork-clawstudio-auth parity checks use the shared Node TypeScript runner for auth service contracts', () => {
  const workspacePackageJson = read('package.json');
  const authCheckRunner = read('scripts/run-sdkwork-auth-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');
  const authStoreSource = read('packages/sdkwork-clawstudio-core/src/stores/authStore.ts');
  const useAuthStoreSource = read('packages/sdkwork-clawstudio-core/src/stores/useAuthStore.ts');

  assert.match(
    workspacePackageJson,
    /"check:sdkwork-auth"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-auth-check\.mjs"/,
  );
  assert.ok(exists('scripts/run-sdkwork-auth-check.mjs'));
  assert.ok(exists('scripts/run-node-typescript-check.mjs'));
  assert.match(nodeTypeScriptRunner, /--experimental-transform-types/);
  assert.match(nodeTypeScriptRunner, /--disable-warning=ExperimentalWarning/);
  assert.match(authCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(authCheckRunner, /authConfig\.test\.ts/);
  assert.match(authCheckRunner, /appAuthService\.test\.ts/);
  assert.match(authCheckRunner, /useAuthStore\.test\.ts/);
  assert.match(authCheckRunner, /user-center-standard-bridge\.test\.ts/);
  assert.doesNotMatch(authCheckRunner, /tsx/);
  assert.doesNotMatch(authStoreSource, /zustand/);
  assert.doesNotMatch(useAuthStoreSource, /zustand/);
});
