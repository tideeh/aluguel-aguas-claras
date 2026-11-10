// Regras da API de marcações, sem dependência do SDK da AWS (testável com node --test).
import { createHash } from 'node:crypto';

export const CHAVE_VALIDA = /^[A-Za-z0-9_-]{43}$/; // 32 bytes aleatórios em base64url, gerados no navegador
export const MAX_NOTA = 500;
const ID_NA_ROTA = /^\/marcas\/(\d{1,12})$/;
const MAX_CORPO = 4096;

const resposta = (status, corpo) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(corpo)
});

// A tabela guarda só o hash da chave: quem lê a tabela não obtém chaves válidas.
export const hashChave = (chave) => createHash('sha256').update(chave).digest('hex');

export function normalizarMarca(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return null;
  if (dados.nota != null && typeof dados.nota !== 'string') return null;
  const nota = String(dados.nota || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTA);
  return { fav: dados.fav === true, oculto: dados.oculto === true, nota };
}

// repo: { listar(pk) -> {id: marca}, gravar(pk, id, item), remover(pk, id) }
export function criarHandler(repo, agora = () => new Date().toISOString()) {
  return async (event) => {
    const metodo = event?.requestContext?.http?.method || '';
    const caminho = (event?.rawPath || '/').replace(/\/+$/, '') || '/';
    const auth = String(event?.headers?.authorization || '');
    const chave = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!CHAVE_VALIDA.test(chave)) return resposta(401, { erro: 'chave ausente ou inválida' });
    const pk = hashChave(chave);
    try {
      if (caminho === '/marcas') {
        if (metodo !== 'GET') return resposta(405, { erro: 'método não permitido' });
        return resposta(200, { marcas: await repo.listar(pk) });
      }
      const rota = caminho.match(ID_NA_ROTA);
      if (!rota) return resposta(404, { erro: 'rota não encontrada' });
      const id = rota[1];
      if (metodo === 'DELETE') {
        await repo.remover(pk, id);
        return resposta(200, { removida: true });
      }
      if (metodo !== 'PUT') return resposta(405, { erro: 'método não permitido' });
      let corpo = event.body || '';
      if (event.isBase64Encoded) corpo = Buffer.from(corpo, 'base64').toString('utf8');
      if (corpo.length > MAX_CORPO) return resposta(413, { erro: 'corpo grande demais' });
      let dados;
      try { dados = JSON.parse(corpo); } catch { return resposta(400, { erro: 'JSON inválido' }); }
      const marca = normalizarMarca(dados);
      if (!marca) return resposta(400, { erro: 'marcação inválida' });
      if (!marca.fav && !marca.oculto && !marca.nota) {
        await repo.remover(pk, id);
        return resposta(200, { removida: true });
      }
      const item = { ...marca, em: agora() };
      await repo.gravar(pk, id, item);
      return resposta(200, { marca: item });
    } catch (e) {
      console.error('falha ao acessar o DynamoDB', e);
      return resposta(500, { erro: 'falha interna' });
    }
  };
}
