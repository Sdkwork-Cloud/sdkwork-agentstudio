import { OpenClawGatewayConnections } from '@sdkwork/clawstudio-chat';
import { ChatCronActivityNotifications } from './ChatCronActivityNotifications';

export function ChatRuntimeWarmers() {
  return (
    <>
      <OpenClawGatewayConnections />
      <ChatCronActivityNotifications />
    </>
  );
}
