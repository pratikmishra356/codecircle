import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import SetupWizard from './pages/SetupWizard';
import WorkspaceDashboard from './pages/WorkspaceDashboard';
import Chat from './pages/Chat';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/setup/:workspaceId" element={<SetupWizard />} />
          <Route path="/workspace/:workspaceId" element={<WorkspaceDashboard />} />
          <Route path="/workspace/:workspaceId/chat" element={<Chat />} />
          <Route path="/workspace/:workspaceId/chat/:conversationId" element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
