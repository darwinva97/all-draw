import { useEffect, useState } from 'react';
import { Home } from './Home';
import { WorkspaceScreen } from './WorkspaceScreen';
import { KeysScreen } from './Keys';

function useHashRoute(): string {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

export function App() {
  const hash = useHashRoute();
  const m = /^#\/(w|s)\/([^/?]+)(?:\/v\/([^/?]+))?/.exec(hash);
  if (m) return <WorkspaceScreen key={m[1]! + m[2]!} mode={m[1] === 's' ? 'server' : 'local'} id={decodeURIComponent(m[2]!)} viewId={m[3] ? decodeURIComponent(m[3]) : null} />;
  if (hash.startsWith('#/keys')) return <KeysScreen />;
  return <Home />;
}
