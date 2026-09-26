import { useEffect, useState } from 'react';
import { Home } from './Home';
import { WorkspaceScreen } from './WorkspaceScreen';

function useHashRoute(): string {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export function App() {
  const hash = useHashRoute();
  const m = /^#\/w\/([^/?]+)(?:\/v\/([^/?]+))?/.exec(hash);
  if (m) return <WorkspaceScreen key={m[1]} id={decodeURIComponent(m[1]!)} viewId={m[2] ? decodeURIComponent(m[2]) : null} />;
  return <Home />;
}
