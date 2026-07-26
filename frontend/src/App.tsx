import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import Overview from '@/pages/Overview';
import Detections from '@/pages/Detections';
import DetectionDetail from '@/pages/DetectionDetail';
import Analyze from '@/pages/Analyze';
import Users from '@/pages/Users';
import NotFound from '@/pages/NotFound';
import AuthPlaceholder from '@/pages/auth/AuthPlaceholder';

const router = createBrowserRouter([
  // Auth surfaces live outside the shell (no sidebar). Real tree lands in slice 2.
  { path: '/login', element: <AuthPlaceholder title="Sign in" /> },
  { path: '/register', element: <AuthPlaceholder title="Create account" /> },
  { path: '/verify', element: <AuthPlaceholder title="Verify your email" /> },
  {
    path: '/forgot-password',
    element: <AuthPlaceholder title="Reset password" />,
  },
  // Protected console (guards + role gating arrive in slice 2).
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'detections', element: <Detections /> },
      { path: 'detections/:id', element: <DetectionDetail /> },
      { path: 'analyze', element: <Analyze /> },
      { path: 'users', element: <Users /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
