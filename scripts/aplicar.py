#!/usr/bin/env python3
"""Mantém os dados do site Aluguéis em Águas Claras (data/imoveis.json e data/execucoes.json).

Uso (a partir da raiz do repositório):
  python3 scripts/aplicar.py indice
      Imprime o índice compacto que o script de coleta recebe: {"a": {id: aluguel}, "r": {id: data_de_saida}}.
  python3 scripts/aplicar.py aplicar RESULTADO.json
      Aplica o resultado do script de coleta (status "ok") em data/imoveis.json e registra a execução.
  python3 scripts/aplicar.py erro "motivo"
      Registra uma coleta que falhou, sem alterar data/imoveis.json.

O resultado da coleta traz em escrita.painel_imoveis_update um patch de mesclagem:
objetos se fundem em profundidade, {"__delete__": true} remove a chave e os demais valores substituem.
"""
import datetime
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMOVEIS = os.path.join(RAIZ, 'data', 'imoveis.json')
EXECUCOES = os.path.join(RAIZ, 'data', 'execucoes.json')
MAX_EXECUCOES = 60


def _dump(valor):
    return json.dumps(valor, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def _gravar_texto(caminho, texto):
    json.loads(texto)  # nunca grava JSON inválido
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(texto)
    os.replace(tmp, caminho)


def ler(caminho, padrao):
    try:
        with open(caminho, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return padrao


def gravar_imoveis(doc):
    """Um anúncio por linha, ordenado por id: o diff do git mostra exatamente o que mudou."""
    linhas = ['{']
    for k in sorted(c for c in doc if c != 'imoveis'):
        linhas.append(_dump(k) + ':' + _dump(doc[k]) + ',')
    linhas.append('"imoveis":{')
    imoveis = doc.get('imoveis', {})
    ids = sorted(imoveis, key=lambda s: (0, int(s)) if s.isdigit() else (1, s))
    for i, k in enumerate(ids):
        linhas.append(_dump(k) + ':' + _dump(imoveis[k]) + (',' if i < len(ids) - 1 else ''))
    linhas.append('}}')
    _gravar_texto(IMOVEIS, '\n'.join(linhas) + '\n')


def gravar_execucoes(execucoes):
    linhas = ['[']
    for i, e in enumerate(execucoes):
        linhas.append(_dump(e) + (',' if i < len(execucoes) - 1 else ''))
    linhas.append(']')
    _gravar_texto(EXECUCOES, '\n'.join(linhas) + '\n')


def mesclar(base, patch):
    for k, v in patch.items():
        if isinstance(v, dict) and v.get('__delete__') is True and len(v) == 1:
            base.pop(k, None)
        elif isinstance(v, dict):
            alvo = base.get(k)
            if not isinstance(alvo, dict):
                alvo = {}
                base[k] = alvo
            mesclar(alvo, v)
        else:
            base[k] = v
    return base


def registrar(execucao):
    execucoes = [e for e in ler(EXECUCOES, []) if e.get('em') != execucao.get('em')]
    execucoes.insert(0, execucao)
    gravar_execucoes(execucoes[:MAX_EXECUCOES])


def indice():
    imoveis = ler(IMOVEIS, {}).get('imoveis', {})
    a = {k: v['p'] for k, v in imoveis.items() if not v.get('x')}
    r = {k: v['x'] for k, v in imoveis.items() if v.get('x')}
    print(json.dumps({'a': a, 'r': r}, separators=(',', ':')))


def aplicar(caminho):
    with open(caminho, encoding='utf-8') as f:
        resultado = json.load(f)
    if resultado.get('status') != 'ok':
        sys.exit('o resultado não tem status "ok"; nada foi aplicado')
    escrita = resultado['escrita']
    doc = ler(IMOVEIS, None)
    if doc is None:
        sys.exit('data/imoveis.json não encontrado')
    mesclar(doc, escrita['painel_imoveis_update'])
    gravar_imoveis(doc)
    registrar(escrita['execucao_set'])
    c = resultado.get('contagem', {})
    ativos = sum(1 for v in doc['imoveis'].values() if not v.get('x'))
    print(f"ok: {ativos} ativos; novos {c.get('novos', 0)}, saíram {c.get('sairam', 0)}, "
          f"preços {c.get('precos', 0)}, voltaram {c.get('voltaram', 0)}, podados {c.get('podados', 0)}")


def erro(motivo):
    agora = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    registrar({'em': agora, 'ok': False, 'erro': motivo.strip()[:300] or 'motivo não informado'})
    print('falha registrada')


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'indice':
        indice()
    elif len(sys.argv) == 3 and sys.argv[1] == 'aplicar':
        aplicar(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'erro':
        erro(' '.join(sys.argv[2:]))
    else:
        sys.exit(__doc__)
