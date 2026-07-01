import { OpenClawGatewayConnections } from '@sdkwork/claw-chat';
import { ChatCronActivityNotifications } from './ChatCronActivityNotifications';

export function ChatRuntimeWarmers() {
  return (
    <>
      <OpenClawGatewayConnections />
      <ChatCronActivityNotifications />
    </>
  );
}
