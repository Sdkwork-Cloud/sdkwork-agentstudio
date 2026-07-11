import { OpenClawGatewayConnections } from '@sdkwork/agentstudio-pc-chat';
import { ChatCronActivityNotifications } from './ChatCronActivityNotifications';

export function ChatRuntimeWarmers() {
  return (
    <>
      <OpenClawGatewayConnections />
      <ChatCronActivityNotifications />
    </>
  );
}
