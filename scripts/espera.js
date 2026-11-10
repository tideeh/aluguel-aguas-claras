await new Promise((res) => { const t0 = Date.now(); (function w() { const J = window.__rot; if (!J || J.status !== 'rodando' || Date.now() - t0 > 45000) res(); else setTimeout(w, 1000); })(); });
const J = window.__rot;
!J ? { status: 'sem-rotina' } : J.status === 'rodando' ? { status: 'rodando', fase: J.fase, pagina: J.pagina, det: J.det, totalDet: J.totalDet } : J.status === 'ok' ? J.resultado : { status: 'erro', erro: J.erro, execucao_id: J.execucao_id }
