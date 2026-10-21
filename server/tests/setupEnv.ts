// Variáveis padrão para a bateria de testes (sobrescreva com TEST_DATABASE_URL no ambiente/.env).
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL ??= 'postgres://mesa:mesa@localhost:5432/mesa_rpg_test';
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET ??= 'segredo-de-teste-acesso-0123456789';
process.env.JWT_REFRESH_SECRET ??= 'segredo-de-teste-refresh-0123456789';
process.env.MASTER_INVITE_CODE ??= 'codigo-mestre-teste';
process.env.AUTOSAVE_SECONDS ??= '3600';
// ComfyUI falso (sobe dentro de tests/integration/art.test.ts) e pasta de arte temporária
process.env.COMFYUI_URL = 'http://127.0.0.1:18188';
process.env.ART_DIR = require('path').join(require('os').tmpdir(), `mesa-art-test-${process.pid}`);
