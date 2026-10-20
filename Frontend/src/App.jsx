// App router: declares the public, auth, dashboard, and board routes.
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import RootLayout from './components/RootLayout'
import Home from './components/Home'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { toastStyle } from './Styles/common'

const Features = lazy(() => import('./components/Features'))
const Solutions = lazy(() => import('./components/Solutions'))
const Resources = lazy(() => import('./components/Resources'))
const Templates = lazy(() => import('./components/Templates'))
const Engineering = lazy(() => import('./components/Engineering'))
const Design = lazy(() => import('./components/Design'))
const TeamManagement = lazy(() => import('./components/TeamManagement'))
const AboutKanvora = lazy(() => import('./components/AboutKanvora'))
const CustomerStories = lazy(() => import('./components/CustomerStories'))
const Help = lazy(() => import('./components/Help'))
const Inbox = lazy(() => import('./components/Inbox'))
const Planner = lazy(() => import('./components/Planner'))
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))
const AuthRedirect = lazy(() => import('./components/AuthRedirect'))
const ForgotPassword = lazy(() => import('./components/ForgotPassword'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const VerifyEmail = lazy(() => import('./components/VerifyEmail'))
const MainPage = lazy(() => import('./components/MainPage'))
const Project = lazy(() => import('./components/Project'))
const WorkSpaces = lazy(() => import('./components/WorkSpaces'))
const Settings = lazy(() => import('./components/Settings'))
const Notifications = lazy(() => import('./components/Notifications'))
const UserProfile = lazy(() => import('./components/UserProfile'))
const TemplateDetail = lazy(() => import('./components/TemplateDetail'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center premium-app-bg">
      <div className="w-8 h-8 border-2 border-[#ff4d67] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center premium-app-bg px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-[#a3a3ad] mb-6">
          The page you are looking for does not exist or has moved.
        </p>
        <a
          href="/"
          className="premium-button-glow inline-flex items-center justify-center rounded-lg bg-[#ff4d67] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ff6b82]"
        >
          Back to home
        </a>
      </div>
    </div>
  )
}

const withSuspense = (element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'features', element: withSuspense(<Features />) },
      { path: 'solutions', element: withSuspense(<Solutions />) },
      { path: 'resources', element: withSuspense(<Resources />) },
      { path: 'engineering', element: withSuspense(<Engineering />) },
      { path: 'design', element: withSuspense(<Design />) },
      { path: 'team-management', element: withSuspense(<TeamManagement />) },
      { path: 'about', element: withSuspense(<AboutKanvora />) },
      { path: 'customer-stories', element: withSuspense(<CustomerStories />) },
      { path: 'help', element: withSuspense(<Help />) },
      { path: 'guide', element: withSuspense(<Help />) },
      { path: 'login', element: withSuspense(<Login />) },
      { path: 'auth', element: withSuspense(<AuthRedirect />) },
      { path: 'register', element: withSuspense(<Register />) },
      { path: 'forgot-password', element: withSuspense(<ForgotPassword />) },
      { path: 'reset-password', element: withSuspense(<ResetPassword />) },
      { path: 'reset-password/:token', element: withSuspense(<ResetPassword />) },
      { path: 'verify-email', element: withSuspense(<VerifyEmail />) },
      {
        path: 'workspaces',
        element: <ProtectedRoute>{withSuspense(<WorkSpaces />)}</ProtectedRoute>,
        children: [
          { path: 'projects', element: null },
          { path: 'members', element: null },
          { path: 'settings', element: null },
          { path: 'settings/:section', element: withSuspense(<Settings />) }
        ]
      },
      {
        path: 'templates',
        element: <ProtectedRoute>{withSuspense(<Templates />)}</ProtectedRoute>
      },
      {
        path: 'templates/:id',
        element: (
          <ProtectedRoute>{withSuspense(<TemplateDetail />)}</ProtectedRoute>
        )
      },
      {
        path: 'inbox',
        element: <ProtectedRoute>{withSuspense(<Inbox />)}</ProtectedRoute>
      },
      {
        path: 'planner',
        element: <ProtectedRoute>{withSuspense(<Planner />)}</ProtectedRoute>
      },
      {
        path: 'main-page',
        element: <ProtectedRoute>{withSuspense(<MainPage />)}</ProtectedRoute>,
        children: [
          { path: 'notifications', element: withSuspense(<Notifications />) },
          { path: 'profile', element: withSuspense(<UserProfile />) }
        ]
      },
      {
        path: 'projects/:projectId',
        element: <ProtectedRoute>{withSuspense(<Project />)}</ProtectedRoute>
      },
      { path: '*', element: <NotFound /> }
    ]
  }
])

function App() {
  return (
    <>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: toastStyle,
          success: { iconTheme: { primary: '#ff4d67', secondary: '#1d2125' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1d2125' } }
        }}
      />
    </>
  )
}

export default App
