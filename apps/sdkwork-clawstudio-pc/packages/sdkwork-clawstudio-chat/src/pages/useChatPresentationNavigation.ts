import { useNavigate } from 'react-router-dom';

export interface UseChatPresentationNavigationInput {
  setIsSessionContextDrawerOpen: (value: boolean) => void;
}

export interface UseChatPresentationNavigationResult {
  handleOpenModelConfig: () => void;
  handleOpenSessionSettings: () => void;
  onManageInstances: () => void;
}

export function useChatPresentationNavigation({
  setIsSessionContextDrawerOpen,
}: UseChatPresentationNavigationInput): UseChatPresentationNavigationResult {
  const navigate = useNavigate();

  const handleOpenModelConfig = () => {
    navigate('/settings?tab=api');
  };
  const handleOpenSessionSettings = () => {
    setIsSessionContextDrawerOpen(false);
    navigate('/settings?tab=api');
  };
  const onManageInstances = () => {
    navigate('/instances');
  };

  return {
    handleOpenModelConfig,
    handleOpenSessionSettings,
    onManageInstances,
  };
}
