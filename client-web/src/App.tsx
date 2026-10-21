import { useEffect } from 'react';
import { AuthScreen, Spinner, Toaster, useHashRoute, useSession } from '@mesa/common';
import { CharacterView } from './screens/CharacterView';
import { CharacterWizard } from './screens/CharacterWizard';
import { GuidePage } from './screens/Guide';
import { Home } from './screens/Home';
import { PlayerTable } from './screens/PlayerTable';

export function App() {
  const { user, ready, init } = useSession();
  const [route] = useHashRoute();

  useEffect(() => {
    void init();
  }, [init]);

  let page;
  if (!ready) page = <Spinner label="Consultando o Oráculo..." />;
  else if (route[0] === 'guia') page = <GuidePage />;
  else if (!user) page = <AuthScreen title="Mesa RPG" subtitle="Entre para criar seu herói e jogar com o grupo." inviteCode={route[0] === 'entrar' ? route[1] : undefined} />;
  else if (route[0] === 'criar') page = <CharacterWizard />;
  else if (route[0] === 'personagem' && route[1]) page = <CharacterView id={route[1]} />;
  else if (route[0] === 'mesa' && route[1]) page = <PlayerTable campaignId={route[1]} />;
  else page = <Home joinCode={route[0] === 'entrar' ? route[1] : undefined} />;

  return (
    <>
      <Toaster />
      {page}
    </>
  );
}
