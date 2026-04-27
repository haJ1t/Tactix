import ReactDOM from 'react-dom/client'
import App from './App'
import { QueryProvider } from './app/providers/QueryProvider'
import './styles/globals.css'

// Mount app to DOM
ReactDOM.createRoot(document.getElementById('root')!).render(
    <QueryProvider>
        <App />
    </QueryProvider>,
)
