import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { CreateKernelAgentResult } from '@sdkwork/agentstudio-pc-core';

const AuthPage = lazy(() =>
  import('@sdkwork/agentstudio-pc-auth').then((module) => ({
    default: module.AuthPage,
  })),
);
const AuthOAuthCallbackPage = lazy(() =>
  import('@sdkwork/agentstudio-pc-auth').then((module) => ({
    default: module.AuthOAuthCallbackPage,
  })),
);
const AgentMarket = lazy(() =>
  import('@sdkwork/agentstudio-pc-agent').then((module) => ({
    default: module.AgentMarket,
  })),
);
const ClawCenter = lazy(() =>
  import('@sdkwork/agentstudio-pc-center').then((module) => ({
    default: module.ClawCenter,
  })),
);
const ClawDetail = lazy(() =>
  import('@sdkwork/agentstudio-pc-center').then((module) => ({
    default: module.ClawDetail,
  })),
);
const ClawUpload = lazy(() =>
  import('@sdkwork/agentstudio-pc-center').then((module) => ({
    default: module.ClawUpload,
  })),
);
const Channels = lazy(() =>
  import('@sdkwork/agentstudio-pc-channels').then((module) => ({
    default: module.Channels,
  })),
);
const Chat = lazy(() =>
  import('@sdkwork/agentstudio-pc-chat').then((module) => ({
    default: module.Chat,
  })),
);
const ChatAgentMarketDialog = lazy(() =>
  import('@sdkwork/agentstudio-pc-chat').then((module) => ({
    default: module.ChatAgentMarketDialog,
  })),
);
const Community = lazy(() =>
  import('@sdkwork/agentstudio-pc-community').then((module) => ({
    default: module.Community,
  })),
);
const CommunityPostDetail = lazy(() =>
  import('@sdkwork/agentstudio-pc-community').then((module) => ({
    default: module.CommunityPostDetail,
  })),
);
const NewPost = lazy(() =>
  import('@sdkwork/agentstudio-pc-community').then((module) => ({
    default: module.NewPost,
  })),
);
const Devices = lazy(() =>
  import('@sdkwork/agentstudio-pc-devices').then((module) => ({
    default: module.Devices,
  })),
);
const Dashboard = lazy(() =>
  import('@sdkwork/agentstudio-pc-dashboard').then((module) => ({
    default: module.Dashboard,
  })),
);
const UsageWorkspace = lazy(() =>
  import('@sdkwork/agentstudio-pc-dashboard').then((module) => ({
    default: module.UsageWorkspace,
  })),
);
const Docs = lazy(() =>
  import('@sdkwork/agentstudio-pc-docs').then((module) => ({
    default: module.Docs,
  })),
);
const Extensions = lazy(() =>
  import('@sdkwork/agentstudio-pc-extensions').then((module) => ({
    default: module.Extensions,
  })),
);
const InstanceDetail = lazy(() =>
  import('@sdkwork/agentstudio-pc-instances').then((module) => ({
    default: module.InstanceDetail,
  })),
);
const Instances = lazy(() =>
  import('@sdkwork/agentstudio-pc-instances').then((module) => ({
    default: module.Instances,
  })),
);
const Nodes = lazy(() =>
  import('@sdkwork/agentstudio-pc-instances').then((module) => ({
    default: module.Nodes,
  })),
);
const Settings = lazy(() =>
  import('@sdkwork/agentstudio-pc-settings').then((module) => ({
    default: module.Settings,
  })),
);
const KernelCenter = lazy(() =>
  import('@sdkwork/agentstudio-pc-settings').then((module) => ({
    default: module.KernelCenter,
  })),
);
const Tasks = lazy(() =>
  import('@sdkwork/agentstudio-pc-tasks').then((module) => ({
    default: module.Tasks,
  })),
);

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

type InstanceDetailAgentMarketRequest = {
  instanceId: string | null;
  onInstalled?: (
    result: CreateKernelAgentResult,
  ) => Promise<void> | void;
};

export function AppRoutes() {
  const location = useLocation();
  const [instanceDetailAgentMarketRequest, setInstanceDetailAgentMarketRequest] =
    useState<InstanceDetailAgentMarketRequest | null>(null);

  useEffect(() => {
    if (!location.pathname.startsWith('/instances/')) {
      setInstanceDetailAgentMarketRequest(null);
    }
  }, [location.pathname]);

  return (
    <>
      <AnimatePresence initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/register"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthPage />
            </Suspense>
          }
        />
        <Route
          path="/login/oauth/callback/:provider"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AuthOAuthCallbackPage />
            </Suspense>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/usage"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <UsageWorkspace />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/instances"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Instances />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/nodes"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Nodes />
              </Suspense>
            </PageWrapper>
          }
        />
          <Route
            path="/instances/:id"
            element={
              <PageWrapper>
                <Suspense fallback={<RouteFallback />}>
                  <InstanceDetail
                    onOpenAgentMarketModal={(request) => {
                      setInstanceDetailAgentMarketRequest({
                        instanceId: request.instanceId,
                        onInstalled: request.onInstalled,
                      });
                    }}
                  />
                </Suspense>
              </PageWrapper>
            }
          />
        <Route
          path="/devices"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Devices />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-center"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawCenter />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-center/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/claw-upload"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <ClawUpload />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/agents"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <AgentMarket />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/extensions"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Extensions />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Community />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community/new"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <NewPost />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/community/:id"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <CommunityPostDetail />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/channels"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Channels />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/tasks"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Tasks />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/chat"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Chat />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/settings"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Settings />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/kernel"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <KernelCenter />
              </Suspense>
            </PageWrapper>
          }
        />
        <Route
          path="/docs"
          element={
            <PageWrapper>
              <Suspense fallback={<RouteFallback />}>
                <Docs />
              </Suspense>
            </PageWrapper>
          }
        />
        </Routes>
      </AnimatePresence>
      {instanceDetailAgentMarketRequest ? (
        <Suspense fallback={null}>
          <ChatAgentMarketDialog
            open
            instanceId={instanceDetailAgentMarketRequest.instanceId}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setInstanceDetailAgentMarketRequest(null);
              }
            }}
            onInstalled={async (result) => {
              await instanceDetailAgentMarketRequest.onInstalled?.(result);
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
