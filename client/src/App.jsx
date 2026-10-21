import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Loading from './components/Loading.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import WorkPage from './pages/WorkPage.jsx';
import BooksPage from './pages/BooksPage.jsx';
import BookDetailPage from './pages/BookDetailPage.jsx';
import SubmissionReviewPage from './pages/SubmissionReviewPage.jsx';
import TeamPage from './pages/TeamPage.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-paper px-6"><Loading label="Preparing your workspace…" /></div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-paper px-6"><Loading label="Preparing your workspace…" /></div>;

  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={<Protected />}>
      <Route index element={<DashboardPage />} />
      <Route path="work" element={<WorkPage />} />
      <Route path="books" element={<BooksPage />} />
      <Route path="books/:bookId" element={<BookDetailPage />} />
      <Route path="submissions/:submissionId" element={<SubmissionReviewPage />} />
      <Route path="team" element={<RequireAdmin><TeamPage /></RequireAdmin>} />
    </Route>
    <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
  </Routes>;
}
