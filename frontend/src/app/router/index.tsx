import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './route-config';

// Wrap routes with router
export default function AppRouter() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}
