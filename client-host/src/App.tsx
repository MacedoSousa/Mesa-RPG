import { useEffect } from 'react';
import { Auth, AuthScreen, Button, Card, PromoteMaster, Spinner, Toaster, useHashRoute, useSession } from '@mesa/common';
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
          <p className="mt-1 text-sm text-slate-300">Para mestrar uma aventura com esta mesma conta, digite o código de Mestre. Você continua podendo jogar nas mesas dos outros.</p>
          <div className="mt-4">
            <PromoteMaster />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => (window.location.href = '/')}>Só quero jogar</Button>
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
