(() => {
  const KNOWN = window.__KNOWN;
  if (!KNOWN || typeof KNOWN.a !== 'object' || typeof KNOWN.r !== 'object') return 'ERRO: window.__KNOWN ausente ou inválido';
  if (window.__rot && window.__rot.status === 'rodando') return 'ja-rodando';
  const BASE = 'https://www.dfimoveis.com.br/aluguel/df/aguas-claras/norte,sul/apartamento?valorinicial=2500&valorfinal=4500&ordenamento=mais-recente';
  const TZ = 'America/Sao_Paulo';
  const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
  const HHMM = new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '-');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s, n) => { s = String(s || '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const J = window.__rot = { status: 'rodando', fase: 'lista', pagina: 0, det: 0, totalDet: 0 };
  function parseList(doc) {
    const ldS = [...doc.querySelectorAll('script[type="application/ld+json"]')].find((s) => s.textContent.includes('"ItemList"'));
    let ld = []; try { ld = ldS ? JSON.parse(ldS.textContent).itemListElement.map((x) => x.item) : []; } catch (e) {}
    const byId = Object.fromEntries(ld.map((i) => [String(i.identifier), i]));
    const total = parseInt((doc.title.match(/^(\d+)/) || [])[1]);
    const out = [...doc.querySelectorAll('a.imovel-card')].map((a) => {
      const href = a.getAttribute('href') || ''; const id = (href.match(/-(\d+)$/) || [])[1]; const i = byId[id] || {};
      const feats = [...a.querySelectorAll('.imovel-feature > div')].map((d) => d.textContent.trim());
      const num = (re) => { const f = feats.find((t) => re.test(t)); return f ? parseInt(f) : 0; };
      const parts = (a.querySelector('h2[itemprop=name]')?.textContent || '').trim().split(',').map((s) => s.trim());
      return { id, path: href, rua: parts[0] || '', bairro: parts[1] || '',
        titulo: (a.querySelector('p.web-ellipse-view')?.textContent || i.name || '').trim().replace(/^[,\s-]+/, ''),
        preco: i.offers ? +i.offers.price : parseInt((a.querySelector('[itemprop=price]')?.getAttribute('content') || '').replace(/\D/g, '')),
        area: i.floorSize?.value ?? num(/m²/), quartos: num(/Quarto/), suites: num(/Suíte/), vagas: num(/Vaga/),
        anunciante: (a.querySelector('.imovel-anunciante img')?.getAttribute('alt') || '').trim(), publicado: i.datePosted || '' };
    }).filter((x) => x.id && x.preco > 0);
    return { total, out };
  }
  (async () => {
    try {
      const atual = new Map(); let total = null;
      for (let p = 1; p <= 40; p++) {
        J.pagina = p;
        const r = await fetch(BASE + '&pagina=' + p, { credentials: 'include' });
        if (!r.ok) throw new Error('o site respondeu HTTP ' + r.status + ' na página ' + p + ' da busca');
        const d = new DOMParser().parseFromString(await r.text(), 'text/html');
        const { total: t, out } = parseList(d);
        if (p === 1 && !(t >= 0)) throw new Error('a página de busca veio sem a contagem de anúncios (layout mudou ou o site pediu verificação)');
        if (total === null) total = t;
        out.forEach((x) => { if (!atual.has(x.id)) atual.set(x.id, x); });
        if (out.length === 0 || atual.size >= total) break;
        await sleep(600);
      }
      const ativosAnt = Object.keys(KNOWN.a);
      if (total === 0 && ativosAnt.length > 0) throw new Error('a busca voltou vazia');
      if (atual.size < total * 0.9) throw new Error('foram lidos ' + atual.size + ' de ' + total + ' anúncios (paginação incompleta)');
      const sairam = ativosAnt.filter((id) => !atual.has(id));
      if (ativosAnt.length >= 20 && sairam.length > ativosAnt.length * 0.4) throw new Error(sairam.length + ' de ' + ativosAnt.length + ' anúncios teriam saído de uma vez; coleta descartada por segurança');
      const novos = [], voltaram = [], precos = [];
      for (const [id, x] of atual) {
        if (Object.prototype.hasOwnProperty.call(KNOWN.a, id)) { if (Number(KNOWN.a[id]) !== x.preco) precos.push({ id, de: Number(KNOWN.a[id]), para: x.preco, endereco: clean(x.rua, 50) + (x.bairro === 'SUL' ? ' Sul' : ' Norte') }); }
        else if (Object.prototype.hasOwnProperty.call(KNOWN.r, id)) voltaram.push({ id, p: x.preco });
        else novos.push(x);
      }
      J.fase = 'detalhes'; J.totalDet = Math.min(novos.length, 120);
      for (const x of novos.slice(0, 120)) {
        x.condo = null;
        try {
          const r = await fetch(x.path, { credentials: 'include' });
          const html = r.ok ? await r.text() : '';
          if (/Área Útil/i.test(html)) {
            const d = new DOMParser().parseFromString(html, 'text/html');
            const m = (d.body.textContent || '').replace(/\s+/g, ' ').match(/Condom[ií]nio\s*R\$\s*:?\s*([\d.]+)/i);
            x.condo = m ? parseInt(m[1].replace(/\./g, '')) : null;
          }
        } catch (e) {}
        J.det++;
        await sleep(400);
      }
      const im = {};
      for (const x of novos) im[x.id] = { r: clean(x.rua, 50), b: x.bairro === 'SUL' ? 'S' : 'N', t: clean(x.titulo, 70), p: x.preco, c: x.condo ?? null, a: Math.round(x.area || 0), q: x.quartos, s: x.suites, v: x.vagas, an: clean(x.anunciante, 40), pu: x.publicado || '', d: HOJE };
      for (const id of sairam) im[id] = { x: HOJE };
      for (const v of voltaram) im[v.id] = { x: { __delete__: true }, rv: HOJE, p: v.p };
      for (const c of precos) im[c.id] = { p: c.para, h: { [HOJE]: c.de } };
      const corte = new Date(Date.parse(HOJE + 'T12:00:00Z') - 45 * 864e5).toISOString().slice(0, 10);
      const podados = Object.keys(KNOWN.r).filter((id) => String(KNOWN.r[id]) < corte && !atual.has(id));
      for (const id of podados) im[id] = { __delete__: true };
      const agora = new Date().toISOString();
      const resumoNovo = (x) => ({ id: x.id, endereco: clean(x.rua, 50) + (x.bairro === 'SUL' ? ' Sul' : ' Norte'), quartos: x.quartos, area: Math.round(x.area || 0), aluguel: x.preco, condominio: x.condo ?? null, link: 'https://www.dfimoveis.com.br/imovel/apartamento-' + x.id });
      J.resultado = {
        status: 'ok', hoje: HOJE, totalNoSite: total, lidos: atual.size,
        contagem: { novos: novos.length, sairam: sairam.length, voltaram: voltaram.length, precos: precos.length, podados: podados.length },
        novos: novos.map(resumoNovo), precos,
        escrita: {
          painel_imoveis_update: { atualizadoEm: agora, total, imoveis: im },
          execucao_id: HOJE + 'T' + HHMM,
          execucao_set: { em: agora, ok: true, total, novos: novos.map((x) => x.id), sairam, voltaram: voltaram.map((v) => v.id), precos }
        }
      };
      J.status = 'ok';
    } catch (e) {
      J.status = 'erro'; J.erro = String((e && e.message) || e); J.execucao_id = HOJE + 'T' + HHMM;
    }
  })();
  return 'iniciado com ' + Object.keys(KNOWN.a).length + ' ativos e ' + Object.keys(KNOWN.r).length + ' removidos conhecidos';
})()
