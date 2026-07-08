import * as QRCode from 'qrcode';
import {
  runtime,
  type RuntimeEventUnsubscribe,
  type RuntimeJobUpdateEvent,
  type RuntimeProcessOutputEvent,
} from '@sdkwork/clawstudio-infrastructure';

export type ChannelBindingSessionState =
  | 'starting'
  | 'awaiting_scan'
  | 'connected'
  | 'failed'
  | 'unsupported';

export interface ChannelBindingSession {
  channelId: string;
  state: ChannelBindingSessionState;
  jobId?: string;
  qrPayload?: string;
  qrImageSrc?: string;
  qrTerminalText?: string;
  outputLines: string[];
  error?: string;
}

const CHANNEL_BINDING_PROFILE_IDS: Record<string, string> = {
  qqbot: 'channels.bind.qqbot',
  'openclaw-weixin': 'channels.bind.openclaw-weixin',
  feishu: 'channels.bind.feishu',
  'dingtalk-connector': 'channels.bind.dingtalk-connector',
};

const QR_URL_PATTERN =
  /\b(?:https?:\/\/|dingtalk:\/\/|weixin:\/\/|weixin:|feishu:\/\/|lark:\/\/|mqqapi:\/\/|qqbot:\/\/)[^\s"'<>`]+/i;
const MAX_OUTPUT_LINES = 16;

export function resolveChannelBindingProfileId(channelId: string): string | null {
  return CHANNEL_BINDING_PROFILE_IDS[channelId] || null;
}

export function extractChannelBindingQrPayload(output: string): string | null {
  const qrUrlMatch = output.match(QR_URL_PATTERN);
  if (qrUrlMatch?.[0]) {
    return qrUrlMatch[0].replace(/[)\],.;]+$/, '');
  }

  const terminalQr = extractTerminalQrBlock(output);
  return terminalQr || null;
}

export async function appendChannelBindingProcessOutput(
  session: ChannelBindingSession,
  event: RuntimeProcessOutputEvent,
): Promise<ChannelBindingSession> {
  if (session.jobId && event.jobId && event.jobId !== session.jobId) {
    return session;
  }

  const nextOutputLines = trimOutputLines([
    ...session.outputLines,
    ...event.chunk
      .split(/\r?\n/)
      .map((line) => sanitizeBindingOutputLine(line.trimEnd()))
      .filter((line) => line.trim().length > 0),
  ]);
  const qrPayload = extractChannelBindingQrPayload(event.chunk);

  if (!qrPayload) {
    return {
      ...session,
      outputLines: nextOutputLines,
    };
  }

  const qrImageSrc = await renderChannelBindingQrImage(qrPayload);
  return {
    ...session,
    state: 'awaiting_scan',
    qrPayload,
    qrImageSrc: qrImageSrc || session.qrImageSrc,
    qrTerminalText: isTerminalQrBlock(qrPayload) ? qrPayload : session.qrTerminalText,
    outputLines: nextOutputLines,
  };
}

export function applyChannelBindingJobUpdate(
  session: ChannelBindingSession,
  event: RuntimeJobUpdateEvent,
): ChannelBindingSession {
  if (!session.jobId || event.record.id !== session.jobId) {
    return session;
  }

  if (event.record.state === 'failed') {
    return {
      ...session,
      state: 'failed',
      error: event.record.stage || 'Channel binding failed.',
    };
  }

  if (event.record.state === 'cancelled') {
    return {
      ...session,
      state: 'failed',
      error: 'Channel binding was cancelled.',
    };
  }

  if (event.record.state === 'succeeded') {
    return {
      ...session,
      state: session.qrPayload || session.qrTerminalText ? 'awaiting_scan' : session.state,
    };
  }

  if (event.record.state === 'running') {
    return {
      ...session,
      state: session.state === 'starting' ? 'starting' : session.state,
    };
  }

  return session;
}

export function isChannelBindingSessionActive(session: ChannelBindingSession | null | undefined) {
  return Boolean(
    session &&
      (session.state === 'starting' || session.state === 'awaiting_scan'),
  );
}

export function isActiveChannelBindingSession(
  session: ChannelBindingSession | null | undefined,
): session is ChannelBindingSession {
  return Boolean(
    session &&
      (session.state === 'starting' || session.state === 'awaiting_scan'),
  );
}

async function renderChannelBindingQrImage(payload: string): Promise<string | null> {
  if (payload.startsWith('data:image/')) {
    return payload;
  }

  if (isTerminalQrBlock(payload)) {
    return null;
  }

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}

function extractTerminalQrBlock(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const qrLines = lines.filter((line) => isTerminalQrLine(line));

  if (qrLines.length < 4) {
    return null;
  }

  return qrLines.join('\n');
}

function isTerminalQrBlock(value: string) {
  const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length >= 4 && lines.every((line) => isTerminalQrLine(line));
}

function isTerminalQrLine(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 8) {
    return false;
  }

  const qrGlyphCount = [...trimmed].filter((character) =>
    ['█', '▄', '▀', '■', '□', '▓', '▒', '░'].includes(character),
  ).length;
  return qrGlyphCount >= Math.max(4, Math.floor(trimmed.length * 0.35));
}

function sanitizeBindingOutputLine(line: string) {
  return line
    .replace(/(token|secret|password|clientSecret|appSecret)=([^\s&]+)/gi, '$1=<redacted>')
    .replace(/(token|secret|password|clientSecret|appSecret)":"[^"]+"/gi, '$1":"<redacted>"')
    .replace(/(access_token|refresh_token)=([^\s&]+)/gi, '$1=<redacted>');
}

function trimOutputLines(lines: string[]) {
  return lines.slice(Math.max(0, lines.length - MAX_OUTPUT_LINES));
}

class ChannelBindingSessionService {
  async startBinding(channelId: string): Promise<ChannelBindingSession> {
    const profileId = resolveChannelBindingProfileId(channelId);
    if (!profileId) {
      return {
        channelId,
        state: 'unsupported',
        outputLines: [],
        error: `In-app scan binding is not supported for channel "${channelId}".`,
      };
    }

    try {
      const jobId = await runtime.submitProcessJob(profileId);
      return {
        channelId,
        jobId,
        state: 'starting',
        outputLines: [],
      };
    } catch (error) {
      return {
        channelId,
        state: 'failed',
        outputLines: [],
        error: readErrorMessage(error),
      };
    }
  }

  subscribeProcessOutput(
    listener: (event: RuntimeProcessOutputEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> {
    return runtime.subscribeProcessOutput(listener);
  }

  subscribeJobUpdates(
    listener: (event: RuntimeJobUpdateEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> {
    return runtime.subscribeJobUpdates(listener);
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error ?? '');
}

export const channelBindingSessionService = new ChannelBindingSessionService();
