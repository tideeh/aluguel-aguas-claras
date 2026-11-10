import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarHandler, hashChave, MAX_NOTA } from '../src/logica.mjs';

const CHAVE = 'A'.repeat(43);
const PK = hashChave(CHAVE);

function repoEmMemoria() {
  const dados = new Map();
  return {
    dados,
    async listar(pk) { return Object.fromEntries([...dados].filter(([k]) => k.startsWith(pk + '|')).map(([k, v]) => [k.split('|')[1], v])); },
    async gravar(pk, id, item) { dados.set(pk + '|' + id, item); },
    async remover(pk, id) { dados.delete(pk + '|' + id); }
  };
}
const evento = (method, rawPath, { chave = CHAVE, body, base64 = false } = {}) => ({
  requestContext: { http: { method } }, rawPath,
  headers: chave === null ? {} : { authorization: 'Bearer ' + chave },
  body: body === undefined ? undefined : (base64 ? Buffer.from(body).toString('base64') : body),
  isBase64Encoded: base64
});
const corpo = (r) => JSON.parse(r.body);

test('exige chave válida', async () => {
  const h = criarHandler(repoEmMemoria());
  assert.equal((await h(evento('GET', '/marcas', { chave: null }))).statusCode, 401);
  assert.equal((await h(evento('GET', '/marcas', { chave: 'curta' }))).statusCode, 401);
});

test('grava, lista, remove e isola por chave', async () => {
  const repo = repoEmMemoria();
  const h = criarHandler(repo, () => '2026-11-10T13:00:00.000Z');
  const r1 = await h(evento('PUT', '/marcas/1467094', { body: JSON.stringify({ fav: true, nota: '  ligar sábado  ' }) }));
  assert.equal(r1.statusCode, 200);
  assert.deepEqual(corpo(r1).marca, { fav: true, oculto: false, nota: 'ligar sábado', em: '2026-11-10T13:00:00.000Z' });
  assert.ok(repo.dados.has(PK + '|1467094'), 'a tabela guarda o hash da chave, não a chave');
  const outra = await h(evento('GET', '/marcas', { chave: 'B'.repeat(43) }));
  assert.deepEqual(corpo(outra).marcas, {});
  const lista = await h(evento('GET', '/marcas'));
  assert.equal(corpo(lista).marcas['1467094'].nota, 'ligar sábado');
  const vazia = await h(evento('PUT', '/marcas/1467094', { body: JSON.stringify({ fav: false, oculto: false, nota: '' }) }));
  assert.equal(corpo(vazia).removida, true);
  assert.equal(repo.dados.size, 0);
  await h(evento('PUT', '/marcas/92560', { body: JSON.stringify({ oculto: true }), base64: true }));
  assert.equal((await h(evento('DELETE', '/marcas/92560'))).statusCode, 200);
  assert.equal(repo.dados.size, 0);
});

test('valida entrada', async () => {
  const h = criarHandler(repoEmMemoria());
  assert.equal((await h(evento('PUT', '/marcas/123', { body: '{' }))).statusCode, 400);
  assert.equal((await h(evento('PUT', '/marcas/123', { body: '[1]' }))).statusCode, 400);
  assert.equal((await h(evento('PUT', '/marcas/123', { body: JSON.stringify({ nota: 5 }) }))).statusCode, 400);
  assert.equal((await h(evento('PUT', '/marcas/123', { body: 'x'.repeat(5000) }))).statusCode, 413);
  assert.equal((await h(evento('PUT', '/marcas/abc', { body: '{}' }))).statusCode, 404);
  assert.equal((await h(evento('POST', '/marcas'))).statusCode, 405);
  assert.equal((await h(evento('POST', '/marcas/123'))).statusCode, 405);
  const longa = await h(evento('PUT', '/marcas/123', { body: JSON.stringify({ nota: 'x'.repeat(900) }) }));
  assert.equal(corpo(longa).marca.nota.length, MAX_NOTA);
});

test('falha do banco vira 500 sem vazar detalhes', async () => {
  const h = criarHandler({ listar: async () => { throw new Error('segredo'); } });
  const r = await h(evento('GET', '/marcas'));
  assert.equal(r.statusCode, 500);
  assert.ok(!r.body.includes('segredo'));
});
