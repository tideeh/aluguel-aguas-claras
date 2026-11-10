# Aluguéis em Águas Claras

Site estático com os apartamentos para alugar em Águas Claras Norte e Sul (aluguel de R$ 2.500 a R$ 4.500) anunciados no [DFimóveis](https://www.dfimoveis.com.br/aluguel/df/aguas-claras/norte,sul/apartamento?valorinicial=2500&valorfinal=4500), atualizado uma vez por dia.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `index.html` | Página única: lista, filtros, ordenação, favoritos e ocultos (guardados no navegador de cada visitante). |
| `data/imoveis.json` | Estado atual. Um anúncio por linha, chave = id do DFimóveis. |
| `data/execucoes.json` | Últimas 60 coletas (mais recente primeiro). |
| `scripts/coleta.js` | Coleta executada no navegador, numa aba do DFimóveis. Lê a busca paginada, compara com o índice anterior e devolve o patch do dia. |
| `scripts/espera.js` | Aguarda a coleta terminar e devolve o resultado. |
| `scripts/aplicar.py` | `indice` gera o índice compacto; `aplicar` mescla o patch em `data/`; `erro` registra uma coleta que falhou. |

Campos de cada anúncio em `data/imoveis.json`: `r` rua, `b` bairro (`N`/`S`), `t` título, `p` aluguel, `c` condomínio (`null` quando "a consultar"), `a` área útil, `q` quartos, `s` suítes, `v` vagas, `an` anunciante, `pu` publicação no site, `d` entrada na lista, `x` saída do site, `rv` retorno, `h` histórico de preços (`{data: preço anterior}`). Anúncios que saíram são removidos 45 dias depois.

## Atualização

A coleta roda numa tarefa agendada do Claude, todo dia às 11:40 (Brasília), no navegador do app desktop do Claude, porque o DFimóveis bloqueia acesso a partir de servidores. Cada execução faz um commit em `data/`; o GitHub Pages publica em seguida.

Os dados vêm do DFimóveis e podem estar desatualizados: confira sempre o anúncio original.
