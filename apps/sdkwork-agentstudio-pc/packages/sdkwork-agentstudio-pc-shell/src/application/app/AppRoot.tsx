import { MainLayout } from '../layouts/MainLayout';
import { AppProviders } from '../providers/AppProviders';

export default function AppRoot() {
  return (
    <AppProviders>
      <MainLayout />
    </AppProviders>
  );
}
