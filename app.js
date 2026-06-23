'use strict';

// ── Supabase ──────────────────────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Estado ────────────────────────────────────────────────────────
let usuario = null;
let appCarregado = false;

// ── Utilitários ───────────────────────────────────────────────────
function R$(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hoje() { return new Date().toISOString().slice(0, 10); }
function mesAtual() { return new Date().toISOString().slice(0, 7); }

function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo;
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function confirmar(msg) { return confirm(msg); }

function skeleton(el, tipo = 'cards', n = 3) {
  if (tipo === 'cards') {
    el.innerHTML = Array(n).fill(`<div class="skeleton sk-card"></div>`).join('');
  } else if (tipo === 'tabela') {
    el.innerHTML = Array(n).fill(`
      <div class="anim-fade" style="display:flex;gap:10px;margin-bottom:8px">
        <div class="skeleton sk-linha" style="flex:0.8"></div>
        <div class="skeleton sk-linha" style="flex:2"></div>
        <div class="skeleton sk-linha" style="flex:1"></div>
        <div class="skeleton sk-linha" style="flex:0.8"></div>
      </div>`).join('');
  } else if (tipo === 'kpi') {
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
      ${Array(4).fill(`<div class="skeleton sk-kpi"></div>`).join('')}
    </div>`;
  }
}

// ── Navegação ─────────────────────────────────────────────────────
const TITULOS = {
  dashboard: 'Dashboard', insumos: 'Insumos', locais: 'Locais',
  produtos: 'Produtos', despesas: 'Despesas', producao: 'Produção',
  vendas: 'Vendas', transferencias: 'Transferências',
  estoque: 'Estoque', relatorios: 'Relatórios', configuracoes: 'Configurações',
};

function navegar(tela) {
  localStorage.setItem('tela_atual', tela);
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));

  const el = document.getElementById('tela-' + tela);
  if (el) el.classList.add('ativa');

  const btn = document.querySelector(`.nav-item[data-tela="${tela}"]`);
  if (btn) btn.classList.add('ativo');

  document.getElementById('topbar-titulo').textContent = TITULOS[tela] || tela;

  fecharSidebar();

  if (tela === 'dashboard')      carregarDashboard();
  if (tela === 'insumos')        carregarInsumos();
  if (tela === 'locais')         carregarLocais();
  if (tela === 'produtos')       carregarProdutos();
  if (tela === 'despesas')       carregarDespesas();
  if (tela === 'producao')       carregarProducoes();
  if (tela === 'vendas')         carregarVendas();
  if (tela === 'transferencias') carregarTransferencias();
  if (tela === 'estoque')        carregarEstoque();
  if (tela === 'relatorios')     carregarRelatorios();
  if (tela === 'configuracoes')  carregarConfiguracoes();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navegar(btn.dataset.tela));
});

// ── Sidebar mobile ────────────────────────────────────────────────
function abrirSidebar()  { document.getElementById('sidebar').classList.add('aberta'); document.getElementById('sidebar-overlay').classList.add('visivel'); }
function fecharSidebar() { document.getElementById('sidebar').classList.remove('aberta'); document.getElementById('sidebar-overlay').classList.remove('visivel'); }

document.getElementById('btn-menu').addEventListener('click', abrirSidebar);
document.getElementById('sidebar-close').addEventListener('click', fecharSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', fecharSidebar);

// ── Auth ──────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', () => {
  db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) mostrarApp(session.user);
  else mostrarLogin();

  db.auth.onAuthStateChange((event, session) => {
    if (session) mostrarApp(session.user);
    else mostrarLogin();
  });
}

function mostrarLogin() {
  appCarregado = false;
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  window._scene3d?.start();
}

async function garantirPerfil(user) {
  await db.from('perfis').upsert({
    user_id: user.id,
    email: user.email,
    nome: user.user_metadata?.full_name || null,
  }, { onConflict: 'user_id' });

  // Ativar convites pendentes para este email
  const { data: pendentes } = await db.from('parceiros')
    .select('id')
    .eq('email_b', user.email)
    .eq('status', 'pendente');

  for (const p of pendentes || []) {
    await db.from('parceiros').update({ user_id_b: user.id, status: 'ativo' }).eq('id', p.id);
  }
}

function mostrarApp(user) {
  usuario = user;
  document.getElementById('usuario-nome').textContent = user.user_metadata?.full_name || user.email || '';

  if (appCarregado) return; // token refresh — não reinicializar
  appCarregado = true;

  window._scene3d?.stop();
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  garantirPerfil(user);

  const mc = mesAtual();
  const dfm = document.getElementById('despesa-filtro-mes');
  const vfm = document.getElementById('venda-filtro-mes');
  const rm  = document.getElementById('rel-mes');
  if (dfm) { dfm.value = mc; dfm.addEventListener('change', carregarDespesas); }
  if (vfm) { vfm.value = mc; vfm.addEventListener('change', carregarVendas); }
  if (rm)  { rm.value  = mc; rm.addEventListener('change', carregarRelatorios); }

  navegar(localStorage.getItem('tela_atual') || 'dashboard');
}

// ── Helpers de selects ────────────────────────────────────────────
async function popularSelect(id, tabela, placeholder = 'Selecione...') {
  const sel = document.getElementById(id);
  if (!sel) return;
  const { data } = await db.from(tabela).select('id, nome').eq('ativo', true).order('nome');
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    (data || []).map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
}

// ── DASHBOARD ─────────────────────────────────────────────────────
async function carregarDashboard() {
  skeleton(document.getElementById('dash-estoque-local'), 'kpi');
  const mc = mesAtual();
  const ini = mc + '-01';
  const fim = mc + '-31';

  const [{ data: vendas }, { data: despesas }, { data: estoque }] = await Promise.all([
    db.from('vendas').select('valor_total').gte('data_venda', ini).lte('data_venda', fim),
    db.from('despesas').select('valor_total').gte('data_compra', ini).lte('data_compra', fim),
    db.from('estoque_local').select('quantidade'),
  ]);

  const receita = (vendas  || []).reduce((s, v) => s + parseFloat(v.valor_total || 0), 0);
  const despesa = (despesas|| []).reduce((s, v) => s + parseFloat(v.valor_total || 0), 0);
  const lucro   = receita - despesa;
  const totalEstoque = (estoque || []).reduce((s, v) => s + (v.quantidade || 0), 0);

  document.getElementById('dash-receita').textContent = R$(receita);
  document.getElementById('dash-despesa').textContent = R$(despesa);
  document.getElementById('dash-lucro').textContent   = R$(lucro);
  document.getElementById('dash-estoque').textContent = totalEstoque;
  aplicarTilt('.dash-card');

  // Estoque por local
  const { data: estoqueDetalhado } = await db
    .from('estoque_local')
    .select('quantidade, produtos(nome), locais(nome)')
    
    .gt('quantidade', 0);

  const porLocal = {};
  (estoqueDetalhado || []).forEach(e => {
    const loc = e.locais?.nome || 'Sem local';
    if (!porLocal[loc]) porLocal[loc] = [];
    porLocal[loc].push({ produto: e.produtos?.nome || '?', qtd: e.quantidade });
  });

  const elEstoqueLocal = document.getElementById('dash-estoque-local');
  if (!Object.keys(porLocal).length) {
    elEstoqueLocal.innerHTML = '<div class="lista-vazia">Sem estoque registrado.</div>';
  } else {
    elEstoqueLocal.innerHTML = Object.entries(porLocal).map(([loc, items]) =>
      `<div style="margin-bottom:10px"><strong style="font-size:.8rem;color:var(--accent2)">${loc}</strong>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
          ${items.map(i => `<span class="badge badge-choc">${i.produto}: ${i.qtd}</span>`).join('')}
        </div>
      </div>`
    ).join('');
  }

  // Últimas vendas
  const { data: ult } = await db
    .from('vendas')
    .select('data_venda, valor_total, quantidade, produtos(nome)')
    
    .order('created_at', { ascending: false })
    .limit(5);

  const elUlt = document.getElementById('dash-ultimas-vendas');
  if (!ult?.length) {
    elUlt.innerHTML = '<div class="lista-vazia">Sem vendas registradas.</div>';
  } else {
    elUlt.innerHTML = ult.map(v => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <div>
          <div style="font-size:.85rem;font-weight:700">${v.produtos?.nome || '?'}</div>
          <div style="font-size:.75rem;color:var(--muted)">${v.data_venda} · ${v.quantidade} un.</div>
        </div>
        <span style="font-weight:700;color:var(--green)">${R$(v.valor_total)}</span>
      </div>`).join('');
  }
}

// ── INSUMOS ───────────────────────────────────────────────────────
let insumoEditandoId = null;

async function carregarInsumos() {
  const el = document.getElementById('lista-insumos');
  skeleton(el);
  const { data } = await db.from('insumos').select('*').eq('ativo', true).order('nome');
  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhum insumo cadastrado.</div>'; return; }
  el.innerHTML = data.map((i, idx) => `
    <div class="item-card anim-entrada" style="animation-delay:${idx * 0.06}s">
      <div class="item-card-header">
        <span class="item-card-nome">${i.nome}</span>
        <div class="item-card-acoes">
          <button class="btn-icon editar" onclick="editarInsumo('${i.id}')">✏️</button>
          <button class="btn-icon deletar" onclick="deletarInsumo('${i.id}')">🗑️</button>
        </div>
      </div>
      <span class="item-card-meta">${i.unidade}${i.estoque_minimo > 0 ? ' · mín: ' + i.estoque_minimo : ''}</span>
    </div>`).join('');
}

function abrirModalInsumo(titulo) {
  document.getElementById('insumo-modal-titulo').textContent = titulo;
  document.getElementById('modal-insumo').style.display = 'flex';
}

function fecharModalInsumo() {
  document.getElementById('modal-insumo').style.display = 'none';
  document.getElementById('insumo-nome').value    = '';
  document.getElementById('insumo-unidade').value = 'unidade';
  document.getElementById('insumo-minimo').value  = '0';
  insumoEditandoId = null;
}

document.getElementById('btn-novo-insumo').addEventListener('click', () => { insumoEditandoId = null; abrirModalInsumo('Novo Insumo'); });
document.getElementById('btn-cancelar-insumo').addEventListener('click', fecharModalInsumo);

document.getElementById('btn-salvar-insumo').addEventListener('click', async () => {
  const nome    = document.getElementById('insumo-nome').value.trim();
  const unidade = document.getElementById('insumo-unidade').value;
  const minimo  = parseFloat(document.getElementById('insumo-minimo').value) || 0;
  if (!nome) { toast('Informe o nome do insumo.', 'err'); return; }

  const dados = { nome, unidade, estoque_minimo: minimo, user_id: usuario.id, ativo: true };
  const { error } = insumoEditandoId
    ? await db.from('insumos').update(dados).eq('id', insumoEditandoId)
    : await db.from('insumos').insert(dados);

  if (error) { toast('Erro: ' + error.message, 'err'); return; }
  toast(insumoEditandoId ? 'Insumo atualizado!' : 'Insumo adicionado!');
  fecharModalInsumo();
  carregarInsumos();
});

window.editarInsumo = async (id) => {
  const { data } = await db.from('insumos').select('*').eq('id', id).single();
  if (!data) return;
  insumoEditandoId = id;
  document.getElementById('insumo-nome').value    = data.nome;
  document.getElementById('insumo-unidade').value = data.unidade;
  document.getElementById('insumo-minimo').value  = data.estoque_minimo;
  abrirModalInsumo('Editar Insumo');
};

window.deletarInsumo = async (id) => {
  if (!confirmar('Deletar este insumo?')) return;
  const { error } = await db.from('insumos').update({ ativo: false }).eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  carregarInsumos();
};

// ── LOCAIS ────────────────────────────────────────────────────────
let localEditandoId = null;

async function carregarLocais() {
  const el = document.getElementById('lista-locais');
  skeleton(el);
  const { data } = await db.from('locais').select('*').eq('ativo', true).order('nome');
  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhum local cadastrado.</div>'; return; }
  el.innerHTML = data.map((l, idx) => `
    <div class="item-card anim-entrada" style="animation-delay:${idx * 0.06}s">
      <div class="item-card-header">
        <span class="item-card-nome">📍 ${l.nome}</span>
        <div class="item-card-acoes">
          <button class="btn-icon editar" onclick="editarLocal('${l.id}')">✏️</button>
          <button class="btn-icon deletar" onclick="deletarLocal('${l.id}')">🗑️</button>
        </div>
      </div>
      ${l.descricao ? `<span class="item-card-meta">${l.descricao}</span>` : ''}
    </div>`).join('');
}

function fecharModalLocal() {
  document.getElementById('modal-local').style.display = 'none';
  document.getElementById('local-nome').value      = '';
  document.getElementById('local-descricao').value = '';
  localEditandoId = null;
}

document.getElementById('btn-novo-local').addEventListener('click', () => { localEditandoId = null; document.getElementById('local-modal-titulo').textContent = 'Novo Local'; document.getElementById('modal-local').style.display = 'flex'; });
document.getElementById('btn-cancelar-local').addEventListener('click', fecharModalLocal);

document.getElementById('btn-salvar-local').addEventListener('click', async () => {
  const nome      = document.getElementById('local-nome').value.trim();
  const descricao = document.getElementById('local-descricao').value.trim();
  if (!nome) { toast('Informe o nome do local.', 'err'); return; }
  const dados = { nome, descricao, user_id: usuario.id, ativo: true };
  const { error } = localEditandoId
    ? await db.from('locais').update(dados).eq('id', localEditandoId)
    : await db.from('locais').insert(dados);
  if (error) { toast('Erro: ' + error.message, 'err'); return; }
  toast(localEditandoId ? 'Local atualizado!' : 'Local adicionado!');
  fecharModalLocal();
  carregarLocais();
});

window.editarLocal = async (id) => {
  const { data } = await db.from('locais').select('*').eq('id', id).single();
  if (!data) return;
  localEditandoId = id;
  document.getElementById('local-nome').value      = data.nome;
  document.getElementById('local-descricao').value = data.descricao || '';
  document.getElementById('local-modal-titulo').textContent = 'Editar Local';
  document.getElementById('modal-local').style.display = 'flex';
};

window.deletarLocal = async (id) => {
  if (!confirmar('Deletar este local?')) return;
  const { error } = await db.from('locais').update({ ativo: false }).eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  carregarLocais();
};

// ── PRODUTOS ──────────────────────────────────────────────────────
let produtoEditandoId = null;

async function carregarProdutos() {
  const el = document.getElementById('lista-produtos');
  skeleton(el);
  const { data } = await db.from('produtos').select('*').eq('ativo', true).order('nome');
  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhum produto cadastrado.</div>'; return; }
  el.innerHTML = data.map((p, idx) => `
    <div class="item-card anim-entrada" style="animation-delay:${idx * 0.06}s">
      <div class="item-card-header">
        <span class="item-card-nome">🍬 ${p.nome}</span>
        <div class="item-card-acoes">
          <button class="btn-icon editar" onclick="editarProduto('${p.id}')">✏️</button>
          <button class="btn-icon deletar" onclick="deletarProduto('${p.id}')">🗑️</button>
        </div>
      </div>
      <span class="item-card-meta">${R$(p.preco_venda)}/un. · 3+ un.: ${R$(PRECO_PROMO)}/un.</span>
      ${p.descricao ? `<span class="item-card-meta">${p.descricao}</span>` : ''}
    </div>`).join('');
}

function fecharModalProduto() {
  document.getElementById('modal-produto').style.display = 'none';
  document.getElementById('produto-nome').value      = '';
  document.getElementById('produto-preco').value     = '5.50';
  document.getElementById('produto-descricao').value = '';
  produtoEditandoId = null;
}

document.getElementById('btn-novo-produto').addEventListener('click', () => { produtoEditandoId = null; document.getElementById('produto-modal-titulo').textContent = 'Novo Produto'; document.getElementById('modal-produto').style.display = 'flex'; });
document.getElementById('btn-cancelar-produto').addEventListener('click', fecharModalProduto);

document.getElementById('btn-salvar-produto').addEventListener('click', async () => {
  const nome      = document.getElementById('produto-nome').value.trim();
  const preco     = parseFloat(document.getElementById('produto-preco').value) || 0;
  const descricao = document.getElementById('produto-descricao').value.trim();
  if (!nome) { toast('Informe o nome do produto.', 'err'); return; }
  const dados = { nome, preco_venda: preco, descricao, user_id: usuario.id, ativo: true };
  const { error } = produtoEditandoId
    ? await db.from('produtos').update(dados).eq('id', produtoEditandoId)
    : await db.from('produtos').insert(dados);
  if (error) { toast('Erro: ' + error.message, 'err'); return; }
  toast(produtoEditandoId ? 'Produto atualizado!' : 'Produto adicionado!');
  fecharModalProduto();
  carregarProdutos();
});

window.editarProduto = async (id) => {
  const { data } = await db.from('produtos').select('*').eq('id', id).single();
  if (!data) return;
  produtoEditandoId = id;
  document.getElementById('produto-nome').value      = data.nome;
  document.getElementById('produto-preco').value     = data.preco_venda;
  document.getElementById('produto-descricao').value = data.descricao || '';
  document.getElementById('produto-modal-titulo').textContent = 'Editar Produto';
  document.getElementById('modal-produto').style.display = 'flex';
};

window.deletarProduto = async (id) => {
  if (!confirmar('Deletar este produto?')) return;
  const { error } = await db.from('produtos').update({ ativo: false }).eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  carregarProdutos();
};

// ── DESPESAS ──────────────────────────────────────────────────────
async function carregarDespesas() {
  skeleton(document.getElementById('lista-despesas'), 'tabela', 4);
  const mes = document.getElementById('despesa-filtro-mes')?.value || mesAtual();
  const ini = mes + '-01', fim = mes + '-31';

  const [{ data }, { data: historico }] = await Promise.all([
    db.from('despesas')
      .select('*, insumos(nome, unidade)')
      
      .gte('data_compra', ini).lte('data_compra', fim)
      .order('data_compra', { ascending: false }),
    db.from('despesas')
      .select('data_compra, valor_unitario, quantidade, valor_total, insumos(id, nome, unidade)')
      
      .order('data_compra', { ascending: true })
      .limit(200),
  ]);

  const el = document.getElementById('lista-despesas');

  // ── Tabela do mês ──────────────────────────────────────────────
  let html = '';
  if (!data?.length) {
    html += '<div class="lista-vazia">Nenhuma despesa neste mês.</div>';
  } else {
    const total = data.reduce((s, d) => s + parseFloat(d.valor_total || 0), 0);
    html += `
      <div style="margin-bottom:10px;font-size:.85rem;color:var(--muted)">Total do mês: <strong style="color:var(--red)">${R$(total)}</strong></div>
      <table class="tabela">
        <thead><tr><th>Data</th><th>Insumo</th><th>Qtd</th><th>Valor unit.</th><th>Total</th><th></th></tr></thead>
        <tbody>${data.map(d => {
          const pu = parseFloat(d.valor_unitario) || (d.quantidade > 0 ? d.valor_total / d.quantidade : 0);
          return `<tr>
            <td>${d.data_compra}</td>
            <td>${d.insumos?.nome || '—'}</td>
            <td>${d.quantidade} ${d.insumos?.unidade || ''}</td>
            <td style="color:var(--accent)">${R$(pu)}/${d.insumos?.unidade || 'un'}</td>
            <td style="color:var(--red)">${R$(d.valor_total)}</td>
            <td><button class="btn-icon deletar" onclick="deletarDespesa('${d.id}')">🗑️</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  // ── Histórico de preços por insumo ──────────────────────────────
  if (historico?.length) {
    const porInsumo = {};
    historico.forEach(d => {
      const id   = d.insumos?.id;
      const nome = d.insumos?.nome;
      const un   = d.insumos?.unidade || 'un';
      if (!id || !nome) return;
      if (!porInsumo[id]) porInsumo[id] = { nome, un, compras: [] };
      const pu = parseFloat(d.valor_unitario) || (d.quantidade > 0 ? d.valor_total / d.quantidade : 0);
      porInsumo[id].compras.push({ data: d.data_compra, pu });
    });

    const insumosComHistorico = Object.values(porInsumo).filter(i => i.compras.length > 0);
    if (insumosComHistorico.length) {
      html += `<div class="rel-section" style="margin-top:24px">
        <div class="rel-section-titulo">Histórico de Preços por Insumo</div>
        ${insumosComHistorico.map(({ nome, un, compras }) => {
          const ultimo = compras[compras.length - 1].pu;
          const anterior = compras.length > 1 ? compras[compras.length - 2].pu : null;
          const tendencia = anterior === null ? '' : ultimo > anterior
            ? '<span style="color:var(--red);font-size:.8rem"> ▲</span>'
            : ultimo < anterior
              ? '<span style="color:var(--green);font-size:.8rem"> ▼</span>'
              : '<span style="color:var(--muted);font-size:.8rem"> –</span>';
          const linhas = compras.slice(-6).map((c, i, arr) => {
            const prev = i > 0 ? arr[i-1].pu : null;
            const cor  = prev === null ? '' : c.pu > prev ? 'color:var(--red)' : c.pu < prev ? 'color:var(--green)' : 'color:var(--muted)';
            return `<tr><td style="color:var(--muted);font-size:.78rem">${c.data}</td><td style="text-align:right;${cor}">${R$(c.pu)}/${un}</td></tr>`;
          }).join('');
          return `<div class="historico-insumo-card">
            <div class="historico-insumo-titulo">${nome}${tendencia}</div>
            <div style="font-size:.8rem;color:var(--muted);margin-bottom:6px">Último: <strong style="color:var(--accent)">${R$(ultimo)}/${un}</strong></div>
            <table class="tabela" style="margin:0"><tbody>${linhas}</tbody></table>
          </div>`;
        }).join('')}
      </div>`;
    }
  }

  el.innerHTML = html;
}

function recalcularTotalDespesa() {
  const qtd   = parseFloat(document.getElementById('despesa-qtd').value)   || 0;
  const vunit = parseFloat(document.getElementById('despesa-vunit').value) || 0;
  const total = qtd * vunit;
  document.getElementById('despesa-total-display').textContent = R$(total);
}

document.getElementById('btn-nova-despesa').addEventListener('click', async () => {
  await popularSelect('despesa-insumo', 'insumos');
  document.getElementById('despesa-data').value  = hoje();
  document.getElementById('despesa-qtd').value   = '1';
  document.getElementById('despesa-vunit').value = '0';
  document.getElementById('despesa-total-display').textContent = R$(0);
  document.getElementById('modal-despesa').style.display = 'flex';
});
document.getElementById('despesa-qtd').addEventListener('input',   recalcularTotalDespesa);
document.getElementById('despesa-vunit').addEventListener('input',  recalcularTotalDespesa);
document.getElementById('btn-cancelar-despesa').addEventListener('click', () => { document.getElementById('modal-despesa').style.display = 'none'; });

document.getElementById('btn-salvar-despesa').addEventListener('click', async () => {
  const insumo_id = document.getElementById('despesa-insumo').value;
  const qtd       = parseFloat(document.getElementById('despesa-qtd').value)   || 0;
  const vunit     = parseFloat(document.getElementById('despesa-vunit').value) || 0;
  const data_c    = document.getElementById('despesa-data').value;
  const obs       = document.getElementById('despesa-obs').value.trim();

  if (!insumo_id) { toast('Selecione o insumo.', 'err'); return; }
  if (qtd <= 0)   { toast('Informe a quantidade.', 'err'); return; }
  if (vunit <= 0) { toast('Informe o valor unitário.', 'err'); return; }
  if (!data_c)    { toast('Informe a data.', 'err'); return; }

  const valor_total = qtd * vunit;
  const { error } = await db.from('despesas').insert({
    user_id: usuario.id, insumo_id, quantidade: qtd,
    valor_unitario: vunit, valor_total, data_compra: data_c, observacao: obs,
  });
  if (error) { toast('Erro: ' + error.message, 'err'); return; }
  toast('Despesa registrada!');
  document.getElementById('modal-despesa').style.display = 'none';
  carregarDespesas();
});

window.deletarDespesa = async (id) => {
  if (!confirmar('Deletar esta despesa?')) return;
  const { error } = await db.from('despesas').delete().eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  carregarDespesas();
};

// ── PRODUÇÃO ──────────────────────────────────────────────────────
async function carregarProducoes() {
  const el = document.getElementById('lista-producoes');
  skeleton(el, 'tabela', 5);
  const { data } = await db.from('producoes')
    .select('*, produtos(nome), locais(nome)')

    .order('data_producao', { ascending: false })
    .limit(50);

  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhuma produção registrada.</div>'; return; }
  el.innerHTML = `<table class="tabela">
    <thead><tr><th>Data</th><th>Produto</th><th>Local</th><th>Qtd</th><th>Custo</th><th></th></tr></thead>
    <tbody>${data.map((p, idx) => `<tr class="anim-entrada" style="animation-delay:${idx*0.06}s">
      <td>${p.data_producao}</td>
      <td>${p.produtos?.nome || '—'}</td>
      <td>${p.locais?.nome   || '—'}</td>
      <td>${p.quantidade}</td>
      <td>${p.custo_estimado > 0 ? R$(p.custo_estimado) : '—'}</td>
      <td><button class="btn-icon deletar" onclick="deletarProducao('${p.id}', '${p.produto_id}', '${p.local_id}', ${p.quantidade})">🗑️</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

document.getElementById('btn-nova-producao').addEventListener('click', async () => {
  await Promise.all([
    popularSelect('producao-produto', 'produtos'),
    popularSelect('producao-local', 'locais'),
  ]);
  document.getElementById('producao-data').value = hoje();
  document.getElementById('modal-producao').style.display = 'flex';
});
document.getElementById('btn-cancelar-producao').addEventListener('click', () => { document.getElementById('modal-producao').style.display = 'none'; });

document.getElementById('btn-salvar-producao').addEventListener('click', async () => {
  const produto_id = document.getElementById('producao-produto').value;
  const local_id   = document.getElementById('producao-local').value;
  const qtd        = parseInt(document.getElementById('producao-qtd').value) || 0;
  const custo      = parseFloat(document.getElementById('producao-custo').value) || 0;
  const data_p     = document.getElementById('producao-data').value;
  const obs        = document.getElementById('producao-obs').value.trim();

  if (!produto_id) { toast('Selecione o produto.', 'err'); return; }
  if (!local_id)   { toast('Selecione o local.', 'err'); return; }
  if (qtd <= 0)    { toast('Informe a quantidade.', 'err'); return; }

  const { error } = await db.from('producoes').insert({ user_id: usuario.id, produto_id, local_id, quantidade: qtd, custo_estimado: custo, data_producao: data_p, observacao: obs });
  if (error) { toast('Erro: ' + error.message, 'err'); return; }

  // Atualizar estoque
  await upsertEstoque(produto_id, local_id, qtd);

  toast('Produção registrada!');
  document.getElementById('modal-producao').style.display = 'none';
  carregarProducoes();
});

window.deletarProducao = async (id, produto_id, local_id, qtd) => {
  if (!confirmar('Deletar esta produção? O estoque será ajustado.')) return;
  const { error } = await db.from('producoes').delete().eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  await upsertEstoque(produto_id, local_id, -qtd);
  carregarProducoes();
};

// ── ESTOQUE helper ────────────────────────────────────────────────
async function upsertEstoque(produto_id, local_id, delta) {
  const { data: ex } = await db.from('estoque_local')
    .select('id, quantidade')
    .eq('produto_id', produto_id).eq('local_id', local_id)
    .maybeSingle();

  if (ex) {
    const nova = Math.max(0, (ex.quantidade || 0) + delta);
    await db.from('estoque_local').update({ quantidade: nova }).eq('id', ex.id);
  } else if (delta > 0) {
    await db.from('estoque_local').insert({ user_id: usuario.id, produto_id, local_id, quantidade: delta });
  }
}

// ── VENDAS ────────────────────────────────────────────────────────
const PRECO_UNIT  = 5.50; // preço fora do grupo de 3
const PRECO_PROMO = 5.00; // preço dentro do grupo de 3

function calcularTotalVenda(qtd) {
  const grupos = Math.floor(qtd / 3);
  const resto  = qtd % 3;
  return grupos * 3 * PRECO_PROMO + resto * PRECO_UNIT;
}

function atualizarPrecoVenda() {
  const qtd = parseInt(document.getElementById('venda-qtd').value) || 0;
  document.getElementById('venda-valor').value = calcularTotalVenda(qtd).toFixed(2);

  const info = document.getElementById('venda-preco-info');
  if (qtd === 0) { info.style.display = 'none'; return; }

  const grupos = Math.floor(qtd / 3);
  const resto  = qtd % 3;

  let msg;
  if (grupos > 0 && resto > 0) {
    msg = `<span style="color:var(--green)">${grupos * 3} × ${R$(PRECO_PROMO)}</span> + <span style="color:var(--muted)">${resto} × ${R$(PRECO_UNIT)}</span>`;
  } else if (grupos > 0) {
    msg = `<span style="color:var(--green)">${qtd} × ${R$(PRECO_PROMO)} (grupos de 3)</span>`;
  } else {
    const faltam = 3 - qtd;
    msg = `<span style="color:var(--muted)">${qtd} × ${R$(PRECO_UNIT)} · Faltam <strong>${faltam}</strong> un. para grupo de 3 (${R$(PRECO_PROMO)}/un.)</span>`;
  }
  info.innerHTML = msg;
  info.style.display = 'block';
}
async function carregarVendas() {
  const el = document.getElementById('lista-vendas');
  skeleton(el, 'tabela', 5);
  const mes = document.getElementById('venda-filtro-mes')?.value || mesAtual();
  const ini = mes + '-01', fim = mes + '-31';

  const { data } = await db.from('vendas')
    .select('*, produtos(nome), locais(nome)')

    .gte('data_venda', ini).lte('data_venda', fim)
    .order('data_venda', { ascending: false });

  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhuma venda neste mês.</div>'; return; }

  const total = data.reduce((s, v) => s + parseFloat(v.valor_total || 0), 0);
  el.innerHTML = `
    <div style="margin-bottom:10px;font-size:.85rem;color:var(--muted)">Total: <strong style="color:var(--green)">${R$(total)}</strong></div>
    <table class="tabela">
      <thead><tr><th>Data</th><th>Produto</th><th>Local</th><th>Qtd</th><th>Valor</th><th></th></tr></thead>
      <tbody>${data.map((v, idx) => `<tr class="anim-entrada" style="animation-delay:${idx*0.06}s">
        <td>${v.data_venda}</td>
        <td>${v.produtos?.nome || '—'}</td>
        <td>${v.locais?.nome   || '—'}</td>
        <td>${v.quantidade}</td>
        <td style="color:var(--green)">${R$(v.valor_total)}</td>
        <td><button class="btn-icon deletar" onclick="deletarVenda('${v.id}', '${v.produto_id}', '${v.local_id}', ${v.quantidade})">🗑️</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
}

document.getElementById('btn-nova-venda').addEventListener('click', async () => {
  await Promise.all([
    popularSelect('venda-produto', 'produtos'),
    popularSelect('venda-local', 'locais'),
  ]);
  document.getElementById('venda-qtd').value   = '1';
  document.getElementById('venda-preco-info').style.display = 'none';
  document.getElementById('venda-data').value  = hoje();
  atualizarPrecoVenda();
  document.getElementById('modal-venda').style.display = 'flex';
});

document.getElementById('venda-qtd').addEventListener('input', atualizarPrecoVenda);

document.getElementById('btn-cancelar-venda').addEventListener('click', () => {
  document.getElementById('modal-venda').style.display = 'none';
});

document.getElementById('btn-salvar-venda').addEventListener('click', async () => {
  const produto_id = document.getElementById('venda-produto').value;
  const local_id   = document.getElementById('venda-local').value;
  const qtd        = parseInt(document.getElementById('venda-qtd').value) || 0;
  const valor      = parseFloat(document.getElementById('venda-valor').value) || 0;
  const data_v     = document.getElementById('venda-data').value;
  const obs        = document.getElementById('venda-obs').value.trim();

  if (!produto_id) { toast('Selecione o produto.', 'err'); return; }
  if (!local_id)   { toast('Selecione o local.', 'err'); return; }
  if (qtd <= 0)    { toast('Informe a quantidade.', 'err'); return; }
  if (valor <= 0)  { toast('Informe o valor.', 'err'); return; }

  // Verificar estoque
  const { data: es } = await db.from('estoque_local').select('quantidade').eq('produto_id', produto_id).eq('local_id', local_id).maybeSingle();
  if (!es || (es.quantidade || 0) < qtd) {
    toast(`Estoque insuficiente neste local (disponível: ${es?.quantidade || 0}).`, 'err'); return;
  }

  const { error } = await db.from('vendas').insert({ user_id: usuario.id, produto_id, local_id, quantidade: qtd, valor_total: valor, data_venda: data_v, observacao: obs });
  if (error) { toast('Erro: ' + error.message, 'err'); return; }

  await upsertEstoque(produto_id, local_id, -qtd);
  toast('Venda registrada!');
  document.getElementById('modal-venda').style.display = 'none';
  carregarVendas();
});

window.deletarVenda = async (id, produto_id, local_id, qtd) => {
  if (!confirmar('Deletar esta venda? O estoque será revertido.')) return;
  const { error } = await db.from('vendas').delete().eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  await upsertEstoque(produto_id, local_id, qtd);
  carregarVendas();
};

// ── TRANSFERÊNCIAS ────────────────────────────────────────────────
async function carregarTransferencias() {
  const el = document.getElementById('lista-transferencias');
  skeleton(el, 'tabela', 5);
  const { data } = await db.from('transferencias')
    .select('*, produtos(nome), origem:local_origem_id(nome), destino:local_destino_id(nome)')

    .order('data_transferencia', { ascending: false })
    .limit(50);

  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Nenhuma transferência registrada.</div>'; return; }
  el.innerHTML = `<table class="tabela">
    <thead><tr><th>Data</th><th>Produto</th><th>Origem</th><th>Destino</th><th>Qtd</th><th></th></tr></thead>
    <tbody>${data.map((t, idx) => `<tr class="anim-entrada" style="animation-delay:${idx*0.06}s">
      <td>${t.data_transferencia}</td>
      <td>${t.produtos?.nome || '—'}</td>
      <td>${t.origem?.nome   || '—'}</td>
      <td>${t.destino?.nome  || '—'}</td>
      <td>${t.quantidade}</td>
      <td><button class="btn-icon deletar" onclick="deletarTransferencia('${t.id}', '${t.produto_id}', '${t.local_origem_id}', '${t.local_destino_id}', ${t.quantidade})">🗑️</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

document.getElementById('btn-nova-transferencia').addEventListener('click', async () => {
  await Promise.all([
    popularSelect('transf-produto', 'produtos'),
    popularSelect('transf-origem', 'locais', 'Origem...'),
    popularSelect('transf-destino', 'locais', 'Destino...'),
  ]);
  document.getElementById('transf-data').value = hoje();
  document.getElementById('transf-aviso').style.display = 'none';
  document.getElementById('modal-transferencia').style.display = 'flex';
});
document.getElementById('btn-cancelar-transf').addEventListener('click', () => { document.getElementById('modal-transferencia').style.display = 'none'; });

// Verificar estoque disponível ao mudar produto/origem
['transf-produto', 'transf-origem'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', async () => {
    const prod = document.getElementById('transf-produto').value;
    const orig = document.getElementById('transf-origem').value;
    const aviso = document.getElementById('transf-aviso');
    if (prod && orig) {
      const { data } = await db.from('estoque_local').select('quantidade').eq('produto_id', prod).eq('local_id', orig).maybeSingle();
      const disp = data?.quantidade || 0;
      aviso.textContent = `Disponível na origem: ${disp} un.`;
      aviso.style.display = 'block';
      aviso.style.background = disp > 0 ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)';
      aviso.style.borderColor = disp > 0 ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)';
      aviso.style.color = disp > 0 ? 'var(--green)' : 'var(--red)';
    }
  });
});

document.getElementById('btn-salvar-transf').addEventListener('click', async () => {
  const produto_id = document.getElementById('transf-produto').value;
  const origem_id  = document.getElementById('transf-origem').value;
  const destino_id = document.getElementById('transf-destino').value;
  const qtd        = parseInt(document.getElementById('transf-qtd').value) || 0;
  const data_t     = document.getElementById('transf-data').value;

  if (!produto_id)            { toast('Selecione o produto.', 'err'); return; }
  if (!origem_id)             { toast('Selecione a origem.', 'err'); return; }
  if (!destino_id)            { toast('Selecione o destino.', 'err'); return; }
  if (origem_id === destino_id) { toast('Origem e destino não podem ser iguais.', 'err'); return; }
  if (qtd <= 0)               { toast('Informe a quantidade.', 'err'); return; }

  const { data: es } = await db.from('estoque_local').select('quantidade').eq('produto_id', produto_id).eq('local_id', origem_id).maybeSingle();
  if (!es || (es.quantidade || 0) < qtd) { toast(`Estoque insuficiente na origem (disponível: ${es?.quantidade || 0}).`, 'err'); return; }

  const { error } = await db.from('transferencias').insert({ user_id: usuario.id, produto_id, local_origem_id: origem_id, local_destino_id: destino_id, quantidade: qtd, data_transferencia: data_t });
  if (error) { toast('Erro: ' + error.message, 'err'); return; }

  await upsertEstoque(produto_id, origem_id, -qtd);
  await upsertEstoque(produto_id, destino_id, qtd);
  toast('Transferência realizada!');
  document.getElementById('modal-transferencia').style.display = 'none';
  carregarTransferencias();
});

window.deletarTransferencia = async (id, produto_id, orig, dest, qtd) => {
  if (!confirmar('Desfazer esta transferência?')) return;
  const { error } = await db.from('transferencias').delete().eq('id', id).eq('user_id', usuario.id);
  if (error) { toast('Erro ao deletar: ' + error.message, 'err'); return; }
  await upsertEstoque(produto_id, orig,  qtd);
  await upsertEstoque(produto_id, dest, -qtd);
  carregarTransferencias();
};

// ── ESTOQUE ───────────────────────────────────────────────────────
async function carregarEstoque() {
  const el = document.getElementById('painel-estoque');
  skeleton(el, 'card', 3);
  const { data } = await db.from('estoque_local')
    .select('quantidade, produtos(id, nome), locais(id, nome)')

    .order('quantidade', { ascending: false });

  if (!data?.length) { el.innerHTML = '<div class="lista-vazia">Sem estoque registrado.</div>'; return; }

  const porLocal = {};
  data.forEach(e => {
    const loc = e.locais?.nome || 'Sem local';
    if (!porLocal[loc]) porLocal[loc] = [];
    porLocal[loc].push({ produto: e.produtos?.nome || '?', qtd: e.quantidade });
  });

  el.innerHTML = Object.entries(porLocal).map(([loc, items], idx) => `
    <div class="estoque-local-card anim-entrada" style="animation-delay:${idx*0.08}s">
      <div class="estoque-local-titulo">📍 ${loc}</div>
      <div class="estoque-grid">
        ${items.map(i => `
          <div class="estoque-item">
            <span class="estoque-produto">${i.produto}</span>
            <span class="estoque-qtd ${i.qtd <= 0 ? 'baixo' : ''}">${i.qtd}</span>
            <span style="font-size:.72rem;color:var(--muted)">unidades</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

document.getElementById('btn-atualizar-estoque').addEventListener('click', carregarEstoque);

// ── RELATÓRIOS ────────────────────────────────────────────────────
async function carregarRelatorios() {
  const mes = document.getElementById('rel-mes')?.value || mesAtual();
  const ini = mes + '-01', fim = mes + '-31';
  const el  = document.getElementById('painel-relatorios');
  skeleton(el, 'kpi', 5);

  const [{ data: vendas }, { data: despesas }, { data: producoes }] = await Promise.all([
    db.from('vendas').select('valor_total, quantidade, produto_id, produtos(nome)').gte('data_venda', ini).lte('data_venda', fim),
    db.from('despesas').select('valor_total, insumo_id, insumos(nome)').gte('data_compra', ini).lte('data_compra', fim),
    db.from('producoes').select('quantidade, custo_estimado, produtos(nome)').gte('data_producao', ini).lte('data_producao', fim),
  ]);

  const receita  = (vendas    || []).reduce((s, v) => s + parseFloat(v.valor_total || 0), 0);
  const despesa  = (despesas  || []).reduce((s, v) => s + parseFloat(v.valor_total || 0), 0);
  const lucro    = receita - despesa;
  const qtdVend  = (vendas    || []).reduce((s, v) => s + (v.quantidade || 0), 0);
  const qtdProd  = (producoes || []).reduce((s, v) => s + (v.quantidade || 0), 0);

  // Por produto (vendas)
  const porProd = {};
  (vendas || []).forEach(v => {
    const n = v.produtos?.nome || '?';
    if (!porProd[n]) porProd[n] = { qtd: 0, valor: 0 };
    porProd[n].qtd   += v.quantidade || 0;
    porProd[n].valor += parseFloat(v.valor_total || 0);
  });

  // Por insumo (despesas)
  const porInsumo = {};
  (despesas || []).forEach(d => {
    const n = d.insumos?.nome || 'Outros';
    porInsumo[n] = (porInsumo[n] || 0) + parseFloat(d.valor_total || 0);
  });

  el.innerHTML = `
    <div class="rel-grid">
      <div class="rel-card anim-entrada" style="animation-delay:0s"><span class="rel-valor" style="color:var(--green)">${R$(receita)}</span><span class="rel-label">Receita</span></div>
      <div class="rel-card anim-entrada" style="animation-delay:0.06s"><span class="rel-valor" style="color:var(--red)">${R$(despesa)}</span><span class="rel-label">Despesas</span></div>
      <div class="rel-card anim-entrada" style="animation-delay:0.12s"><span class="rel-valor" style="color:${lucro >= 0 ? 'var(--green)' : 'var(--red)'}">${R$(lucro)}</span><span class="rel-label">Lucro líquido</span></div>
      <div class="rel-card anim-entrada" style="animation-delay:0.18s"><span class="rel-valor">${qtdVend}</span><span class="rel-label">Trufas vendidas</span></div>
      <div class="rel-card anim-entrada" style="animation-delay:0.24s"><span class="rel-valor">${qtdProd}</span><span class="rel-label">Trufas produzidas</span></div>
    </div>

    <div class="rel-section anim-entrada" style="animation-delay:0.32s">
      <div class="rel-section-titulo">Vendas por produto</div>
      ${Object.keys(porProd).length ? `<table class="tabela">
        <thead><tr><th>Produto</th><th>Qtd</th><th>Receita</th><th>Preço médio</th></tr></thead>
        <tbody>${Object.entries(porProd).sort((a,b) => b[1].valor - a[1].valor).map(([n, v], idx) => `<tr class="anim-entrada" style="animation-delay:${0.38 + idx*0.05}s">
          <td>${n}</td><td>${v.qtd}</td>
          <td style="color:var(--green)">${R$(v.valor)}</td>
          <td style="color:var(--muted)">${R$(v.qtd > 0 ? v.valor/v.qtd : 0)}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="lista-vazia">Sem vendas neste mês.</div>'}
    </div>

    <div class="rel-section anim-entrada" style="animation-delay:0.44s">
      <div class="rel-section-titulo">Despesas por insumo</div>
      ${Object.keys(porInsumo).length ? `<table class="tabela">
        <thead><tr><th>Insumo</th><th>Total gasto</th></tr></thead>
        <tbody>${Object.entries(porInsumo).sort((a,b) => b[1] - a[1]).map(([n, v], idx) => `<tr class="anim-entrada" style="animation-delay:${0.5 + idx*0.05}s">
          <td>${n}</td><td style="color:var(--red)">${R$(v)}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="lista-vazia">Sem despesas neste mês.</div>'}
    </div>`;
}

// ── CONFIGURAÇÕES / PARCEIROS ─────────────────────────────────────
async function carregarConfiguracoes() {
  const el = document.getElementById('config-usuario-info');
  if (el) el.textContent = usuario.email;

  const { data } = await db.from('parceiros')
    .select('*')
    .or(`user_id_a.eq.${usuario.id},user_id_b.eq.${usuario.id}`);

  const lista = document.getElementById('lista-parceiros');
  if (!data?.length) {
    lista.innerHTML = '<div class="lista-vazia">Nenhum compartilhamento ativo.</div>';
    return;
  }

  lista.innerHTML = data.map(p => {
    const isOwner  = p.user_id_a === usuario.id;
    const label    = isOwner ? p.email_b : 'você (convidado)';
    const badge    = p.status === 'ativo'
      ? '<span class="badge badge-ok">ativo</span>'
      : '<span class="badge badge-pend">pendente</span>';
    return `<div class="parceiro-item">
      <div>
        <div style="font-size:.88rem;font-weight:600">${label}</div>
        <div style="font-size:.75rem;color:var(--muted)">${isOwner ? 'convidado por você' : 'convidado por ' + p.user_id_a}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${badge}
        ${isOwner ? `<button class="btn-icon deletar" onclick="removerParceiro('${p.id}')">🗑️</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

document.getElementById('btn-enviar-convite').addEventListener('click', async () => {
  const email = document.getElementById('convite-email').value.trim().toLowerCase();
  if (!email) { toast('Informe o e-mail.', 'err'); return; }
  if (email === usuario.email) { toast('Você não pode convidar a si mesmo.', 'err'); return; }

  const { error } = await db.from('parceiros').insert({
    user_id_a: usuario.id,
    email_b: email,
    status: 'pendente',
  });

  if (error?.code === '23505') { toast('Este e-mail já foi convidado.', 'err'); return; }
  if (error) { toast('Erro: ' + error.message, 'err'); return; }

  document.getElementById('convite-email').value = '';
  toast('Convite enviado! A pessoa verá os dados ao fazer login.');
  carregarConfiguracoes();
});

document.getElementById('btn-logout-config').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

window.removerParceiro = async (id) => {
  if (!confirmar('Remover este compartilhamento?')) return;
  await db.from('parceiros').delete().eq('id', id);
  toast('Compartilhamento removido.');
  carregarConfiguracoes();
};

// ── Efeito 3D nos cards ───────────────────────────────────────────
function aplicarTilt(seletor) {
  document.querySelectorAll(seletor).forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.03)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });

    // Touch (mobile)
    card.addEventListener('touchmove', e => {
      const r = card.getBoundingClientRect();
      const t = e.touches[0];
      const x = (t.clientX - r.left) / r.width  - 0.5;
      const y = (t.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) scale(1.02)`;
    }, { passive: true });
    card.addEventListener('touchend', () => { card.style.transform = ''; });
  });
}

// ── Init ──────────────────────────────────────────────────────────
initAuth();
window._scene3d?.start();
