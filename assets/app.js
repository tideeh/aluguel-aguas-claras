(() => {
  'use strict';
  const TZ = 'America/Sao_Paulo';
  const CHAVE_FILTROS = 'aguas-claras.filtros.v3';
  const CHAVE_MARCAS = 'aguas-claras.marcas.v1';
  const CHAVE_SYNC = 'aguas-claras.chave.v1';
  const CHAVE_UNIAO = 'aguas-claras.uniao.v1';
  const CHAVE_VALIDA = /^[A-Za-z0-9_-]{43}$/;
  const MAX_NOTA = 500;
  const PADRAO = { vista: 'disp', bairro: '', quartos: 2, vagas: 0, max: '', ordem: 'aluguel', busca: '' };
  const VISTAS = ['disp', 'novos', 'fav', 'notas', 'sairam', 'ocultos'];
  const ORDENS = ['aluguel', 'condominio', 'area', 'm2', 'recentes'];

  const ic = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICONE = {
    estrela: ic('<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
    nota: ic('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    ocultar: ic('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4.3 9.5 6-.5.9-1.6 2.4-3.1 3.7M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.7 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    mostrar: ic('<path d="M2.5 12c1-1.7 4.5-6 9.5-6s8.5 4.3 9.5 6c-1 1.7-4.5 6-9.5 6s-8.5-4.3-9.5-6z"/><circle cx="12" cy="12" r="3"/>'),
    externo: ic('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    cama: ic('<path d="M3 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 16h18"/><path d="M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>'),
    carro: ic('<path d="M4 16v-4l1.6-4.2A2 2 0 0 1 7.5 6.5h9a2 2 0 0 1 1.9 1.3L20 12v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 12h16"/><path d="M7 17v2M17 17v2"/>'),
    area: ic('<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>')
  };

  // ---------- Utilidades ----------
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? padrao : v; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const $ = (s) => document.querySelector(s);
  const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
  const dias = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);
  const reais = (n) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  const ddmm = (iso) => { const [, m, d] = String(iso).slice(0, 10).split('-'); return d && m ? d + '/' + m : ''; };
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MINUSC = new Set(['DA', 'DAS', 'DE', 'DO', 'DOS', 'E', 'EM', 'NA', 'NO', 'C/']);
  const caso = (s) => String(s || '').split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-ZÀ-Ý]/.test(w)) ? (MINUSC.has(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()) : w).join(' ');
  const plural = (n, um, varios) => n.toLocaleString('pt-BR') + ' ' + (n === 1 ? um : varios);
  const emLista = (partes) => partes.length < 2 ? partes.join('') : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
  const tam = (a) => (Array.isArray(a) ? a.length : 0);
  const metade = (ordenados) => ordenados[Math.ceil(ordenados.length / 2) - 1];

  function quando(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const dia = new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
    const hora = new Date(t).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    const d = dias(dia, hoje());
    if (d === 0) return 'hoje às ' + hora;
    if (d === 1) return 'ontem às ' + hora;
    return ddmm(dia) + ' às ' + hora;
  }
  function idade(pu) {
    if (!pu) return '';
    const d = dias(pu, hoje());
    if (d <= 0) return 'anunciado hoje';
    if (d === 1) return 'anunciado ontem';
    if (d > 365) return 'anunciado há mais de 1 ano';
    return 'anunciado há ' + d + ' dias';
  }
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // ---------- Estado ----------
  function filtrosValidos(s) {
    const f = { ...PADRAO };
    if (!s || typeof s !== 'object') return f;
    if (VISTAS.includes(s.vista)) f.vista = s.vista;
    if (['', 'N', 'S'].includes(s.bairro)) f.bairro = s.bairro;
    if ([2, 3, 4].includes(s.quartos)) f.quartos = s.quartos;
    if ([0, 1, 2].includes(s.vagas)) f.vagas = s.vagas;
    if (typeof s.max === 'string' && /^\d{0,6}$/.test(s.max)) f.max = s.max;
    if (ORDENS.includes(s.ordem)) f.ordem = s.ordem;
    if (typeof s.busca === 'string') f.busca = s.busca.slice(0, 100);
    return f;
  }
  const st = {
    dados: null, execs: [], marcas: {}, erro: null, lento: false, porId: {},
    f: filtrosValidos(ler(CHAVE_FILTROS, null)),
    sync: { api: null, chave: null, estado: 'local', ultima: 0 },
    notaId: null
  };
  gravar('aguas-claras.filtros.v1', null); gravar('aguas-claras.filtros.v2', null);
  { const m = ler(CHAVE_MARCAS, null); if (m && typeof m === 'object') st.marcas = m; }
  { const c = ler(CHAVE_SYNC, null); if (typeof c === 'string' && CHAVE_VALIDA.test(c)) st.sync.chave = c; }

  // ---------- Marcações (favorito, oculto, nota) ----------
  const marcaVazia = (m) => !m || (!m.fav && !m.oculto && !m.nota);
  const limparMarca = (m) => ({ fav: !!(m && m.fav), oculto: !!(m && m.oculto), nota: String((m && m.nota) || '').slice(0, MAX_NOTA) });
  function normalizarMarcas(obj) {
    const out = {};
    for (const [id, m] of Object.entries(obj || {})) { if (/^\d+$/.test(id) && !marcaVazia(m)) out[id] = limparMarca(m); }
    return out;
  }

  // ---------- Sincronização com a API ----------
  function base64url(bytes) { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function lerChaveDoLink() {
    const m = location.hash.match(/(?:^#|&)chave=([A-Za-z0-9_-]{43})(?:&|$)/);
    if (!m) return null;
    history.replaceState(null, '', location.pathname + location.search);
    return m[1];
  }
  async function api(metodo, caminho, corpo) {
    const headers = { authorization: 'Bearer ' + st.sync.chave };
    if (corpo) headers['content-type'] = 'application/json';
    const r = await fetch(st.sync.api + caminho, { method: metodo, cache: 'no-store', headers, body: corpo ? JSON.stringify(corpo) : undefined });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  const uniaoFeita = () => ler(CHAVE_UNIAO, null) === st.sync.chave.slice(0, 8);

  async function sincronizar() {
    if (!st.sync.api || !st.sync.chave) return;
    st.sync.estado = 'carregando'; render();
    try {
      const { marcas } = await api('GET', '/marcas');
      const servidor = normalizarMarcas(marcas);
      if (!uniaoFeita()) {
        // Primeira sincronização neste aparelho: o que só existia aqui sobe para o servidor.
        for (const [id, m] of Object.entries(st.marcas)) {
          if (servidor[id] || marcaVazia(m)) continue;
          await api('PUT', '/marcas/' + id, limparMarca(m));
          servidor[id] = limparMarca(m);
        }
        gravar(CHAVE_UNIAO, st.sync.chave.slice(0, 8));
      }
      st.marcas = servidor; gravar(CHAVE_MARCAS, st.marcas);
      st.sync.estado = 'ok'; st.sync.ultima = Date.now();
    } catch (e) {
      st.sync.estado = 'erro';
      if (e.status === 401) aviso('A chave de sincronização é inválida. Desative e ative de novo.');
    }
    render();
  }

  const filas = {};
  function enviar(id, marca) {
    if (!st.sync.api || !st.sync.chave) return;
    filas[id] = (filas[id] || Promise.resolve()).then(async () => {
      try {
        if (marcaVazia(marca)) await api('DELETE', '/marcas/' + id);
        else await api('PUT', '/marcas/' + id, limparMarca(marca));
        if (st.sync.estado !== 'ok') { st.sync.estado = 'ok'; render(); }
      } catch (e) {
        aviso('Não foi possível salvar no servidor. A alteração ficou só neste aparelho.');
        st.sync.estado = 'erro'; render();
      }
    });
  }

  function salvarMarca(id, nova) {
    const marcas = { ...st.marcas };
    if (marcaVazia(nova)) delete marcas[id]; else marcas[id] = limparMarca(nova);
    st.marcas = marcas;
    if (!gravar(CHAVE_MARCAS, marcas) && !st.sync.chave) aviso('Este navegador não permite guardar marcações nesta página.');
    render();
    enviar(id, nova);
  }

  async function ativarSync() {
    if (!st.sync.api) return;
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    st.sync.chave = base64url(bytes);
    gravar(CHAVE_SYNC, st.sync.chave);
    await sincronizar();
  }
  const linkSync = () => location.origin + location.pathname + '#chave=' + st.sync.chave;
  let tCopia = null;
  async function copiarLink() {
    const b = $('#ds-copiar'), campo = $('#ds-link');
    try { await navigator.clipboard.writeText(linkSync()); b.textContent = 'Copiado'; }
    catch (e) { campo.focus(); campo.select(); b.textContent = 'Selecionado'; }
    clearTimeout(tCopia); tCopia = setTimeout(() => { b.textContent = 'Copiar'; }, 2500);
  }
  function desativarSync() {
    st.sync.chave = null; st.sync.estado = 'local';
    gravar(CHAVE_SYNC, null); gravar(CHAVE_UNIAO, null);
    $('#dlg-sync').close();
    aviso('Sincronização desativada neste aparelho. As marcações continuam salvas aqui e no servidor.');
    render();
  }

  // ---------- Dados ----------
  function itens() {
    const im = st.dados && st.dados.imoveis && typeof st.dados.imoveis === 'object' ? st.dados.imoveis : {};
    const inicio = String((st.dados && st.dados.inicio) || '');
    const h = hoje();
    const out = [];
    for (const id of Object.keys(im)) {
      const x = im[id];
      if (!/^\d+$/.test(id) || !x || typeof x !== 'object') continue;
      const p = Number(x.p) || 0, a = Number(x.a) || 0;
      const c = x.c == null || x.c === '' ? null : Number(x.c);
      const hist = x.h && typeof x.h === 'object' ? x.h : null;
      let mud = null;
      if (hist) { const k = Object.keys(hist).sort().pop(); if (k && dias(k, h) <= 14 && Number(hist[k]) !== p) mud = { em: k, de: Number(hist[k]) }; }
      const m = st.marcas[id] || {};
      out.push({
        id, p, a, c, q: Number(x.q) || 0, s: Number(x.s) || 0, v: Number(x.v) || 0,
        rua: caso(x.r), b: x.b === 'S' ? 'S' : 'N', t: String(x.t || ''), an: String(x.an || ''), pu: String(x.pu || ''),
        d: String(x.d || ''), saiu: x.x ? String(x.x) : '', volta: x.rv ? String(x.rv) : '',
        m2: a ? p / a : Infinity, mud,
        novo: !x.x && !!x.d && !!inicio && String(x.d) > inicio && dias(String(x.d), h) <= 7,
        voltou: !x.x && !!x.rv && dias(String(x.rv), h) <= 7,
        fav: !!m.fav, oculto: !!m.oculto, nota: String(m.nota || '')
      });
    }
    return out;
  }

  const maxNum = () => { const n = Number(st.f.max); return st.f.max !== '' && n > 0 ? n : 0; };
  const filtrosAtivos = () => !!(st.f.bairro || st.f.quartos > 2 || st.f.vagas || maxNum() || st.f.busca.trim());
  function passaBase(x) {
    const f = st.f;
    if (f.bairro && x.b !== f.bairro) return false;
    if (f.quartos && x.q < f.quartos) return false;
    if (f.vagas && x.v < f.vagas) return false;
    if (f.busca.trim()) {
      const alvo = sem(x.rua + ' ' + (x.b === 'N' ? 'norte' : 'sul') + ' ' + x.t + ' ' + x.an + ' ' + x.nota);
      if (!sem(f.busca).split(/\s+/).filter(Boolean).every((w) => alvo.includes(w))) return false;
    }
    return true;
  }
  function passaFiltros(x) { if (!passaBase(x)) return false; const m = maxNum(); return !(m && x.p > m); }

  const NA_VISTA = {
    disp: (x) => !x.saiu && !x.oculto,
    novos: (x) => !x.saiu && !x.oculto && (x.novo || x.voltou),
    fav: (x) => x.fav,
    notas: (x) => !!x.nota,
    sairam: (x) => !!x.saiu,
    ocultos: (x) => x.oculto && !x.saiu
  };
  const ORDEM = {
    aluguel: (a, b) => a.p - b.p || (a.c ?? Infinity) - (b.c ?? Infinity),
    condominio: (a, b) => (a.c ?? Infinity) - (b.c ?? Infinity) || a.p - b.p,
    area: (a, b) => b.a - a.a || a.p - b.p,
    m2: (a, b) => a.m2 - b.m2 || a.p - b.p,
    recentes: (a, b) => (b.pu > a.pu ? 1 : b.pu < a.pu ? -1 : a.p - b.p)
  };

  // ---------- Abertura ----------
  function desenhaManchete(todos) {
    const h = $('#manchete');
    if (st.erro) { h.textContent = 'Não foi possível carregar a lista.'; return; }
    if (!st.dados) { h.textContent = st.lento ? 'A lista está demorando para carregar.' : 'Carregando os apartamentos…'; return; }
    const disp = todos.filter((x) => !x.saiu).map((x) => x.p).sort((a, b) => a - b);
    if (!disp.length) { h.textContent = 'Nenhum apartamento disponível hoje.'; return; }
    const num = (t) => el('span', 'num', t);
    h.replaceChildren(
      num(disp.length.toLocaleString('pt-BR') + (disp.length === 1 ? ' apartamento' : ' apartamentos')),
      document.createTextNode(disp.length === 1 ? ' disponível. ' : ' disponíveis. '),
      document.createTextNode('Metade tem aluguel de até '), num(reais(metade(disp))), document.createTextNode('.')
    );
  }

  function resumoMudancas(e) {
    const n = tam(e.novos), v = tam(e.voltaram), r = tam(e.sairam), pr = tam(e.precos);
    const partes = [];
    if (n) partes.push(plural(n, 'novo', 'novos'));
    if (v) partes.push(v === 1 ? '1 voltou' : v + ' voltaram');
    if (r) partes.push(r === 1 ? '1 saiu' : r + ' saíram');
    if (pr) partes.push(pr === 1 ? '1 mudou de preço' : pr + ' mudaram de preço');
    return emLista(partes);
  }

  function desenhaStatus() {
    const s = $('#status'), alerta = $('#alerta');
    s.replaceChildren(); alerta.hidden = true;
    if (st.erro) { s.textContent = 'Recarregue a página para tentar de novo.'; return; }
    if (!st.dados) return;
    const d = st.dados, ult = st.execs[0];
    s.append('Atualizado ', el('strong', null, quando(d.atualizadoEm) || 'em data desconhecida'), '. ');
    if (ult && ult.ok && !ult.nota) { const m = resumoMudancas(ult); s.append(m ? 'Na última coleta, ' + m + '. ' : 'Nenhuma mudança na última coleta. '); }
    if (d.agenda) s.append('Coleta automática ' + String(d.agenda) + '.');
    if (ult && ult.ok === false) { alerta.textContent = 'A coleta de ' + quando(ult.em) + ' não terminou (' + String(ult.erro || 'motivo não informado') + '). A lista mostra a última coleta completa.'; alerta.hidden = false; }
    else if (d.atualizadoEm && Date.now() - Date.parse(d.atualizadoEm) > 36 * 3600e3) { alerta.textContent = 'A lista não é atualizada desde ' + quando(d.atualizadoEm) + '.'; alerta.hidden = false; }
  }

  // ---------- Cartões ----------
  function cartao(x) {
    const li = el('li', 'cartao' + (x.saiu ? ' saiu' : ''));
    li.dataset.id = x.id;

    const selos = el('div', 'selos');
    if (x.saiu) selos.append(el('span', 'selo saiu', 'Saiu do site em ' + ddmm(x.saiu)));
    if (x.novo) { const s = el('span', 'selo novo', 'Novo'); s.title = 'Entrou na lista em ' + ddmm(x.d); selos.append(s); }
    if (x.voltou) { const s = el('span', 'selo volta', 'Voltou ao site'); s.title = 'Voltou em ' + ddmm(x.volta); selos.append(s); }
    if (x.mud && x.mud.de) {
      const desce = x.p < x.mud.de;
      const s = el('span', 'selo ' + (desce ? 'desce' : 'sobe'), (desce ? 'Baixou ' : 'Subiu ') + reais(Math.abs(x.p - x.mud.de)));
      s.title = 'O aluguel era ' + reais(x.mud.de) + ' até ' + ddmm(x.mud.em);
      selos.append(s);
    }
    const fav = el('button', 'c-fav'); fav.type = 'button'; fav.dataset.acao = 'fav';
    fav.setAttribute('aria-pressed', String(x.fav));
    fav.setAttribute('aria-label', x.fav ? 'Tirar dos favoritos' : 'Favoritar'); fav.title = fav.getAttribute('aria-label');
    fav.innerHTML = ICONE.estrela;
    const total = el('div', 'c-total');
    total.append(el('span', 'valor', reais(x.p)), el('span', 'mes', 'por mês'), fav);
    const comp = el('p', 'c-composicao', x.c != null ? 'Condomínio ' + reais(x.c) : 'Condomínio a consultar');

    const end = el('h2', 'c-endereco');
    end.append(x.rua || 'Endereço não informado', ' ', el('span', 'c-bairro', x.b === 'N' ? 'Norte' : 'Sul'));

    if (selos.childElementCount) li.append(selos);
    li.append(total, comp, end);
    if (x.t) { const t = el('p', 'c-titulo', caso(x.t)); t.title = x.t; li.append(t); }

    const specs = el('ul', 'c-specs');
    const spec = (icone, texto, dica) => { const i = el('li'); i.insertAdjacentHTML('afterbegin', icone); i.append(texto); if (dica) i.title = dica; specs.append(i); };
    spec(ICONE.cama, plural(x.q, 'quarto', 'quartos') + (x.s ? ', ' + plural(x.s, 'suíte', 'suítes') : ''));
    spec(ICONE.carro, x.v ? plural(x.v, 'vaga', 'vagas') : 'Sem vaga');
    if (x.a) spec(ICONE.area, x.a + ' m²', 'Aluguel de ' + reais(x.m2) + ' por m²');
    li.append(specs);

    const anuncio = [x.an, idade(x.pu)].filter(Boolean).join(', ');
    if (anuncio) li.append(el('p', 'c-anuncio', anuncio.charAt(0).toUpperCase() + anuncio.slice(1)));
    if (x.nota) li.append(el('p', 'c-nota', x.nota));

    const acoes = el('div', 'c-acoes');
    const acao = (tipo, icone, texto) => { const b = el('button', 'acao'); b.type = 'button'; b.dataset.acao = tipo; b.innerHTML = icone; b.append(texto); return b; };
    acoes.append(
      acao('nota', ICONE.nota, 'Nota'),
      acao('oculto', x.oculto ? ICONE.mostrar : ICONE.ocultar, x.oculto ? 'Mostrar' : 'Ocultar'),
      el('span', 'espaco')
    );
    const ver = el('a', 'acao ver', 'Ver anúncio');
    ver.href = 'https://www.dfimoveis.com.br/imovel/apartamento-' + x.id; ver.target = '_blank'; ver.rel = 'noopener noreferrer';
    ver.insertAdjacentHTML('beforeend', ICONE.externo);
    acoes.append(ver);
    li.append(acoes);
    return li;
  }

  function vazio(titulo, texto) { const li = el('li', 'vazio'); li.append(el('strong', null, titulo), texto); return li; }
  const MSG_VAZIO = {
    disp: ['Nenhum apartamento com esses filtros', 'Afrouxe algum filtro, aumente o limite de aluguel ou limpe a busca.'],
    novos: ['Nenhum anúncio novo nos últimos 7 dias', 'Os que entrarem no site aparecem aqui depois da coleta diária.'],
    fav: ['Nenhum favorito', 'Use a estrela de um anúncio para guardá-lo aqui.'],
    notas: ['Nenhuma nota', 'Use o botão Nota de um anúncio para registrar contato, visita ou impressões.'],
    sairam: ['Nenhum anúncio saiu do site recentemente', 'Anúncios removidos ficam aqui por 45 dias.'],
    ocultos: ['Nenhum anúncio oculto', 'Oculte os que não interessam para limpar a lista principal.']
  };

  // ---------- Rodapé, sincronização e controles ----------
  function desenhaHistorico() {
    const ol = $('#hist'); ol.replaceChildren();
    if (!st.execs.length) { ol.append(el('li', null, 'Nenhuma coleta registrada ainda.')); return; }
    for (const e of st.execs.slice(0, 10)) {
      const li = el('li');
      li.append(el('span', 'quando', quando(e.em)));
      if (e.ok) {
        li.append(el('span', null, plural(Number(e.total) || 0, 'anúncio', 'anúncios')));
        const m = resumoMudancas(e);
        li.append(el('span', null, e.nota ? String(e.nota) : m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Sem mudanças'));
      } else {
        li.append(el('span', 'falha', 'Falhou: ' + String(e.erro || 'motivo não informado')));
      }
      ol.append(li);
    }
  }

  function desenhaSync() {
    const b = $('#sync-btn');
    b.hidden = !st.sync.api;
    if (!st.sync.api) return;
    const estado = st.sync.chave ? st.sync.estado : 'local';
    b.dataset.estado = estado;
    $('#sync-rotulo').textContent = { local: 'Sincronizar', carregando: 'Sincronizando', ok: 'Sincronizado', erro: 'Sem conexão' }[estado];
    $('#ds-local').hidden = !!st.sync.chave;
    $('#ds-ativo').hidden = !st.sync.chave;
    $('#ds-ativar').hidden = !!st.sync.chave;
    $('#ds-desativar').hidden = !st.sync.chave;
    $('#ds-tentar').hidden = estado !== 'erro';
    $('#ds-estado').textContent = {
      carregando: 'Sincronizando…',
      ok: 'Favoritos, ocultos e notas estão sincronizados com o servidor.',
      erro: 'Sem conexão com o servidor. As marcações deste aparelho continuam salvas aqui.'
    }[estado] || '';
    if (st.sync.chave) { const campo = $('#ds-link'), link = linkSync(); if (campo.value !== link) campo.value = link; }
  }

  function sincronizaControles() {
    const f = st.f;
    const marca = (attr, valor) => document.querySelectorAll('[data-' + attr + ']').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(valor))));
    marca('vista', f.vista); marca('bairro', f.bairro); marca('quartos', f.quartos); marca('vagas', f.vagas);
    const o = $('#f-ordem'); if (o.value !== f.ordem) o.value = f.ordem;
    const mx = $('#f-max'); if (document.activeElement !== mx && mx.value !== f.max) mx.value = f.max;
    const bu = $('#f-busca'); if (document.activeElement !== bu && bu.value !== f.busca) bu.value = f.busca;
    $('#limpar').hidden = !filtrosAtivos();
  }

  // ---------- Desenho ----------
  let agendado = false;
  function render() { if (agendado) return; agendado = true; requestAnimationFrame(() => { agendado = false; desenha(); }); }

  function desenha() {
    sincronizaControles();
    desenhaSync();
    desenhaHistorico();
    desenhaStatus();
    const grade = $('#grade');
    if (!st.dados) {
      desenhaManchete([]);
      grade.replaceChildren(st.erro ? vazio('Lista indisponível agora', 'Recarregue a página em instantes.') : vazio('Carregando a lista', st.lento ? 'Está demorando mais que o normal.' : 'Só um instante.'));
      $('#contagem').textContent = '';
      document.querySelectorAll('[data-conta]').forEach((e) => { e.textContent = ''; });
      return;
    }
    const todos = itens();
    st.porId = Object.fromEntries(todos.map((x) => [x.id, x]));
    desenhaManchete(todos);

    const filtrados = todos.filter(passaFiltros);
    for (const k of VISTAS) { const e = document.querySelector('[data-conta="' + k + '"]'); if (e) e.textContent = filtrados.filter(NA_VISTA[k]).length.toLocaleString('pt-BR'); }
    const vista = st.f.vista;
    const sel = filtrados.filter(NA_VISTA[vista]);
    const desc = (k) => (a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : ORDEM[st.f.ordem](a, b));
    if (vista === 'novos') sel.sort(desc((x) => x.volta || x.d));
    else if (vista === 'sairam') sel.sort(desc((x) => x.saiu));
    else sel.sort(ORDEM[st.f.ordem]);

    const txtOrdem = vista === 'novos' ? 'dos que entraram há menos tempo' : vista === 'sairam' ? 'dos que saíram há menos tempo' : '';
    $('#contagem').textContent = sel.length ? plural(sel.length, 'apartamento', 'apartamentos') + (txtOrdem ? ', ' + txtOrdem : '') : '';
    const frag = document.createDocumentFragment();
    if (!sel.length) {
      const [titulo, texto] = MSG_VAZIO[vista];
      frag.append(vazio(titulo, vista !== 'disp' && filtrosAtivos() ? 'Há filtros ativos. Limpe os filtros para ver todos.' : texto));
    } else sel.forEach((x) => frag.append(cartao(x)));
    grade.replaceChildren(frag);
  }

  function setF(patch) { st.f = { ...st.f, ...patch }; gravar(CHAVE_FILTROS, st.f); render(); }

  let toastT = null;
  function aviso(txt, acao) {
    const t = $('#toast');
    t.replaceChildren(el('span', null, txt));
    if (acao) {
      const b = el('button', null, acao.rotulo); b.type = 'button';
      b.addEventListener('click', () => { t.hidden = true; acao.fn(); });
      t.append(b);
    }
    t.hidden = false; clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, acao ? 6000 : 4000);
  }

  // ---------- Nota ----------
  const dlgNota = $('#dlg-nota');
  function contaNota() { $('#dn-conta').textContent = $('#dn-texto').value.length + ' de ' + MAX_NOTA + ' caracteres'; }
  function abrirNota(id) {
    const x = st.porId[id]; if (!x) return;
    st.notaId = id;
    $('#dn-titulo').textContent = x.nota ? 'Editar nota' : 'Nova nota';
    $('#dn-sub').textContent = (x.rua || 'Endereço não informado') + ' ' + (x.b === 'N' ? 'Norte' : 'Sul') + ', aluguel de ' + reais(x.p);
    const ta = $('#dn-texto'); ta.value = x.nota; contaNota();
    $('#dn-apagar').hidden = !x.nota;
    dlgNota.returnValue = '';
    dlgNota.showModal();
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  dlgNota.addEventListener('close', () => {
    const id = st.notaId; st.notaId = null;
    if (!id) return;
    const atual = limparMarca(st.marcas[id]);
    if (dlgNota.returnValue === 'salvar') {
      const texto = $('#dn-texto').value.replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTA);
      if (texto !== atual.nota) { salvarMarca(id, { ...atual, nota: texto }); aviso(texto ? 'Nota salva.' : 'Nota apagada.'); }
    } else if (dlgNota.returnValue === 'apagar' && atual.nota) {
      salvarMarca(id, { ...atual, nota: '' }); aviso('Nota apagada.');
    }
  });
  $('#dn-texto').addEventListener('input', contaNota);
  $('#dn-texto').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dlgNota.close('salvar'); } });

  // ---------- Eventos ----------
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => setF({ vista: b.dataset.vista })));
  document.querySelectorAll('[data-bairro]').forEach((b) => b.addEventListener('click', () => setF({ bairro: b.dataset.bairro })));
  document.querySelectorAll('[data-quartos]').forEach((b) => b.addEventListener('click', () => setF({ quartos: Number(b.dataset.quartos) })));
  document.querySelectorAll('[data-vagas]').forEach((b) => b.addEventListener('click', () => setF({ vagas: Number(b.dataset.vagas) })));
  $('#f-ordem').addEventListener('change', (e) => setF({ ordem: ORDENS.includes(e.target.value) ? e.target.value : 'aluguel' }));
  let tBusca = null;
  $('#f-busca').addEventListener('input', (e) => { clearTimeout(tBusca); const v = e.target.value.slice(0, 100); tBusca = setTimeout(() => setF({ busca: v }), 150); });
  let tMax = null;
  $('#f-max').addEventListener('input', (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (v !== e.target.value) e.target.value = v;
    clearTimeout(tMax); tMax = setTimeout(() => setF({ max: v }), 400);
  });
  $('#f-max').addEventListener('change', (e) => { clearTimeout(tMax); setF({ max: e.target.value.replace(/\D/g, '').slice(0, 6) }); });
  $('#limpar').addEventListener('click', () => {
    clearTimeout(tBusca); clearTimeout(tMax);
    st.f = { ...PADRAO, vista: st.f.vista, ordem: st.f.ordem };
    $('#f-max').value = ''; $('#f-busca').value = '';
    gravar(CHAVE_FILTROS, st.f); render();
  });

  $('#grade').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acao]'); if (!b) return;
    const id = b.closest('li[data-id]').dataset.id, atual = limparMarca(st.marcas[id]);
    if (b.dataset.acao === 'fav') salvarMarca(id, { ...atual, fav: !atual.fav });
    else if (b.dataset.acao === 'nota') abrirNota(id);
    else if (b.dataset.acao === 'oculto') {
      salvarMarca(id, { ...atual, oculto: !atual.oculto });
      aviso(atual.oculto ? 'Anúncio de volta à lista.' : 'Anúncio ocultado.', { rotulo: 'Desfazer', fn: () => salvarMarca(id, { ...limparMarca(st.marcas[id]), oculto: atual.oculto }) });
    }
  });

  const dlgSync = $('#dlg-sync');
  $('#sync-btn').addEventListener('click', () => { desenhaSync(); dlgSync.showModal(); });
  $('#ds-ativar').addEventListener('click', ativarSync);
  $('#ds-copiar').addEventListener('click', copiarLink);
  $('#ds-tentar').addEventListener('click', sincronizar);
  $('#ds-desativar').addEventListener('click', desativarSync);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && st.sync.chave && st.sync.api && st.sync.estado !== 'carregando' && Date.now() - st.sync.ultima > 30000 && !dlgNota.open) sincronizar();
  });

  // ---------- Carga ----------
  async function carregar() {
    const timer = setTimeout(() => { if (!st.dados) { st.lento = true; render(); } }, 10000);
    try {
      const t = Date.now();
      const [r1, r2] = await Promise.all([
        fetch('data/imoveis.json?t=' + t, { cache: 'no-store' }),
        fetch('data/execucoes.json?t=' + t, { cache: 'no-store' })
      ]);
      if (!r1.ok) throw new Error('HTTP ' + r1.status);
      st.dados = await r1.json();
      try { const ex = r2.ok ? await r2.json() : []; st.execs = Array.isArray(ex) ? ex : []; } catch (e) { st.execs = []; }
    } catch (e) {
      st.erro = e;
    } finally {
      clearTimeout(timer);
      render();
    }
  }

  async function carregarApi() {
    try {
      const r = await fetch('api.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const { url } = await r.json();
      if (typeof url === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) st.sync.api = url.replace(/\/$/, '');
    } catch (e) { /* sem API publicada: marcações ficam só no navegador */ }
  }

  const chaveDoLink = lerChaveDoLink();
  if (chaveDoLink) {
    if (st.sync.chave !== chaveDoLink) gravar(CHAVE_UNIAO, null);
    st.sync.chave = chaveDoLink; gravar(CHAVE_SYNC, chaveDoLink);
  }
  render();
  carregar();
  carregarApi().then(() => {
    if (st.sync.chave && st.sync.api) {
      sincronizar().then(() => { if (chaveDoLink && st.sync.estado === 'ok') aviso('Aparelho conectado: marcações sincronizadas.'); });
    } else render();
  });
})();
