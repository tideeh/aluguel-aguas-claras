# Aluguéis em Águas Claras

Site estático com os apartamentos de 2 quartos ou mais para alugar em Águas Claras Norte e Sul (aluguel de R$ 2.500 a R$ 4.500) anunciados no [DFimóveis](https://www.dfimoveis.com.br/aluguel/df/aguas-claras/norte,sul/apartamento/2-quartos,3-quartos,4-quartos?valorinicial=2500&valorfinal=4500), atualizado uma vez por dia.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `index.html` | Página única: resumo do dia, filtros, abas e cartões. |
| `assets/estilo.css`, `assets/app.js` | Visual (tema claro e escuro) e lógica da página: filtros, marcações (favorito, oculto, nota) e sincronização. |
| `data/imoveis.json` | Estado atual. Um anúncio por linha, chave = id do DFimóveis. |
| `data/execucoes.json` | Últimas 60 coletas (mais recente primeiro). |
| `scripts/coleta.js` | Coleta executada no navegador, numa aba do DFimóveis. Lê a busca paginada, compara com o índice anterior e devolve o patch do dia. |
| `scripts/espera.js` | Aguarda a coleta terminar e devolve o resultado. |
| `scripts/aplicar.py` | `indice` gera o índice compacto; `aplicar` mescla o patch em `data/`; `erro` registra uma coleta que falhou. |

Campos de cada anúncio em `data/imoveis.json`: `r` rua, `b` bairro (`N`/`S`), `t` título, `p` aluguel, `c` condomínio (`null` quando "a consultar"), `a` área útil, `q` quartos, `s` suítes, `v` vagas, `an` anunciante, `pu` publicação no site, `d` entrada na lista, `x` saída do site, `rv` retorno, `h` histórico de preços (`{data: preço anterior}`). Anúncios que saíram são removidos 45 dias depois.

## Backend de marcações (favoritos, ocultos e notas)

Opcional: sem ele, as marcações ficam só no navegador. Com ele, sincronizam entre aparelhos.

- **Arquitetura:** Lambda Node.js (arm64) exposta por Function URL + tabela DynamoDB em capacidade provisionada dentro da cota gratuita, em `us-east-1` (`backend/template.yaml`, SAM). Custo esperado: zero.
- **Identidade:** chave pessoal de 256 bits gerada no navegador ("Sincronizar entre aparelhos"). Vai no header `Authorization: Bearer`; a tabela guarda só o SHA-256 dela. O link para outro aparelho leva a chave no fragmento (`#chave=…`), que não é enviado a servidores, e a página o remove da barra de endereço ao carregar.
- **API:** `GET /marcas`, `PUT /marcas/{id}` (`{fav, oculto, nota}`; tudo vazio remove) e `DELETE /marcas/{id}`. CORS restrito a `https://tideeh.github.io`.
- **Deploy:** `.github/workflows/backend.yml` roda os testes (`node --test backend/test/*.test.mjs`), assume via OIDC o papel `aluguel-aguas-claras-deploy` (sem chaves guardadas) e executa `sam deploy`. Ao final grava `api.json` com o endereço da API, que a página lê.
- **Configuração única na AWS:** criar a stack de `infra/bootstrap.yaml` em `us-east-1` (a mesma região de `AWS_REGION` no workflow) (provedor OIDC do GitHub, papel de deploy restrito a este repositório e à branch `main`, bucket de pacotes e o limite de permissões aplicado ao papel da função) e cadastrar a saída `PapelArn` no secret `AWS_ROLE_ARN` do repositório. A trust policy aceita o claim `sub` no formato com IDs imutáveis (`repo:tideeh@33804453/aluguel-aguas-claras@1452667290:ref:refs/heads/main`), padrão do GitHub para repositórios criados após 15/07/2026; se o papel for recusado, o passo "Diagnóstico do token OIDC" do workflow mostra o valor recebido.

## Atualização

A coleta roda numa tarefa agendada do Claude, todo dia às 11:40 (Brasília), no navegador do app desktop do Claude, porque o DFimóveis bloqueia acesso a partir de servidores. Cada execução faz um commit em `data/`; o GitHub Pages publica em seguida.

Os dados vêm do DFimóveis e podem estar desatualizados: confira sempre o anúncio original.
