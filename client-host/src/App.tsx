import { useEffect } from 'react';
import { Auth, AuthScreen, Button, Card, Spinner, Toaster, useHashRoute, useSession } from '@mesa/common';
import { CampaignList } from './screens/CampaignList';
import { MasterHUD } from './screens/MasterHUD';

export function App() {
  const { user, ready, init } = useSession();
  const [route] = useHashRoute();

  useEffect(() => {
    void init();
  }, [init]);

  let page;
  if (!ready) page = <Spinner label="Acendendo as tochas do Olimpo..." />;
  else if (!user) page = <AuthScreen title="HUD do Mestre" subtitle="O primeiro cadastro deste servidor vira o Mestre (Host)." allowMasterCode />;
  else if (user.role !== 'MASTER') {
    page = (
      <div className="flex min-h-full items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <p className="text-4xl">🛡️</p>
          <p className="mt-2 text-lg">Esta conta é de <strong>Jogador</strong>.</p>
          <p className="mt-1 text-sm text-slate-300">O painel do Mestre é exclusivo do Host. Use o endereço sem <code>/host</code> para jogar.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => (window.location.href = '/')}>Ir para o cliente do Jogador</Button>
            <Button variant="ghost" onClick={() => void Auth.logout()}>Sair</Button>
          </div>
        </Card>
      </div>
    );
  } else if (route[0] === 'mesa' && route[1]) page = <MasterHUD campaignId={route[1]} />;
  else page = <CampaignList />;

  return (
    <>
      <Toaster />
      {page}
    </>
  );
}
