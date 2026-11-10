import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './app/router'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } })
window.addEventListener('smarttravel:update', () => { void queryClient.invalidateQueries() })
window.addEventListener('storage', event => { if (event.key?.startsWith('smarttravel.demo')) void queryClient.invalidateQueries() })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AppRouter /></BrowserRouter></QueryClientProvider></React.StrictMode>,
)
