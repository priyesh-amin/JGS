import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, loading, user } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <main className="min-h-[60vh] grid place-items-center" aria-busy="true">
                <div className="flex items-center gap-3 text-jaguar-green" role="status">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    <span className="font-semibold">Checking your secure session…</span>
                </div>
            </main>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/events" replace />;
    }

    if (user.mustChangePassword && location.pathname !== '/account/security') {
        return <Navigate to="/account/security" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
