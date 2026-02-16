import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import WorkspaceList from './pages/WorkspaceList';
import Settings from './pages/Settings';
import WorkspaceDashboard from './pages/WorkspaceDashboard';
import ServiceEmbed from './pages/ServiceEmbed';
import DebugSession from './pages/DebugSession';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/workspaces" element={<WorkspaceList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/workspace/:workspaceId" element={<WorkspaceDashboard />} />
          <Route path="/workspace/:workspaceId/service/:serviceKey" element={<ServiceEmbed />} />
          <Route path="/workspace/:workspaceId/debug" element={<DebugSession />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
