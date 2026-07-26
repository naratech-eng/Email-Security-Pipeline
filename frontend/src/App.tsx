import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { RequireAuth, RequireCapability } from '@/auth/guards';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import VerifyEmail from '@/pages/auth/VerifyEmail';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import Pending from '@/pages/auth/Pending';
import Overview from '@/pages/Overview';
import Detections from '@/pages/Detections';
import DetectionDetail from '@/pages/DetectionDetail';
import Analyze from '@/pages/Analyze';
import Users from '@/pages/Users';
import NotFound from '@/pages/NotFound';

const router = createBrowserRouter([
  // Public auth surfaces (shell-less).
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/verify', element: <VerifyEmail /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/pending', element: <Pending /> },

  // Protected console — session + group required.
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'detections', element: <Detections /> },
          { path: 'detections/:id', element: <DetectionDetail /> },
          {
            path: 'analyze',
            element: (
              <RequireCapability cap="canAnalyze">
                <Analyze />
              </RequireCapability>
            ),
          },
          {
            path: 'users',
            element: (
              <RequireCapability cap="canManageUsers">
                <Users />
              </RequireCapability>
            ),
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
