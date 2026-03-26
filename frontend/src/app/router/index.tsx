import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './route-config';

export default function AppRouter() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
}
