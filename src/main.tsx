import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { PAGES, type Page } from './App.tsx'

const pageFromHash = (): Page => PAGES.find((p) => p.id !== 'main' && `#${p.id}` === window.location.hash)?.id ?? 'main'

function Root() {
  const [page, setPage] = useState(pageFromHash)
  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // A new key gives each page a fresh editor with its own state and history.
  return <App key={page} page={page} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
