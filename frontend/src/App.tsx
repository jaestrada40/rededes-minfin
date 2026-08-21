import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { FeedsView } from './components/FeedsView';
import { FeedDetailView } from './components/FeedDetailView';
import { PortalsView } from './components/PortalsView';
import { FeedPublicPreview } from './components/FeedPublicPreview';
import { UsersView } from './components/UsersView';
import { AuditView } from './components/AuditView';
import { SettingsView } from './components/SettingsView';
import { CreateFeedModal } from './components/CreateFeedModal';
import { BatchAssignModal } from './components/BatchAssignModal';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isMfaVerified, authLoading, activeTab } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editFeedId, setEditFeedId] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetFeedId, setAssignTargetFeedId] = useState<string | null>(null);

  // Restoring a session from a persisted refresh token — avoid flashing the login screen.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#081726] flex items-center justify-center text-slate-300 text-sm">
        Verificando sesión institucional...
      </div>
    );
  }

  // If not authenticated or MFA not complete, render security login
  if (!isAuthenticated || !isMfaVerified) {
    return <AuthScreen />;
  }

  const handleOpenCreateModal = (feedIdToEdit?: string) => {
    setEditFeedId(feedIdToEdit || null);
    setIsCreateModalOpen(true);
  };

  const handleOpenAssignModal = (feedId?: string) => {
    setAssignTargetFeedId(feedId || null);
    setIsAssignModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex font-sans antialiased selection:bg-[#0072ce] selection:text-white">
      {/* Institutional Sidebar */}
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView onOpenCreateModal={() => handleOpenCreateModal()} />
          )}

          {activeTab === 'feeds' && (
            <FeedsView 
              onOpenCreateModal={handleOpenCreateModal}
              onOpenAssignModal={handleOpenAssignModal}
            />
          )}

          {activeTab === 'feed-detail' && (
            <FeedDetailView onOpenAssignModal={handleOpenAssignModal} />
          )}

          {activeTab === 'portals' && (
            <PortalsView onOpenBatchAssignModal={handleOpenAssignModal} />
          )}

          {activeTab === 'preview' && (
            <FeedPublicPreview />
          )}

          {activeTab === 'users' && (
            <UsersView />
          )}

          {activeTab === 'audit' && (
            <AuditView />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>

        {/* Institutional Footer */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0c2340]">MINFIN Guatemala</span>
            <span>·</span>
            <span>Gestor Centralizado de Redes Sociales v2.4.1</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            DTI · Dirección de Tecnologías de la Información · PBX: (502) 2374-3000
          </div>
        </footer>
      </div>

      {/* Modals */}
      <CreateFeedModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        editFeedId={editFeedId}
      />

      <BatchAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        initialFeedId={assignTargetFeedId}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
