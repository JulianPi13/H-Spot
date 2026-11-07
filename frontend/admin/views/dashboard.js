import { html, setHTML, icon, cop, fmtDate, $ } from '/js/core/dom.js';
import { api } from '/js/core/api.js';
import { st, qs } from '../ui.js';

// Gráfica de barras simple en SVG: pedidos web (gris) y confirmados (blanco) por día
function chart(series) {
  const W = 760; const H = 220; const pad = { l: 56, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...series.map((d) => d.web));
  const n = series.length; const bw = (W - pad.l - pad.r) / n;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const fmtK = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
  const step = Math.ceil(n / 8);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas diarias del período">
    ${ticks.map((t) => html`<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="#292929"/><text x="${pad.l - 8}" y="${y(t) + 3}" text-anchor="end">${fmtK(t)}</text>`)}
    ${series.map((d, i) => html`
      <rect x="${pad.l + i * bw + bw * 0.15}" y="${y(d.web)}" width="${bw * 0.7}" height="${H - pad.b - y(d.web)}" fill="#3A3A3A"><title>${d.date}: web ${cop(d.web)}, confirmado ${cop(d.confirmed)}</title></rect>
      <rect x="${pad.l + i * bw + bw * 0.15}" y="${y(d.confirmed)}" width="${bw * 0.7}" height="${H - pad.b - y(d.confirmed)}" fill="#F5F5F5"/>
      ${i % step === 0 ? html`<text x="${pad.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${d.date.slice(5)}</text>` : ''}`)}
  </svg>`;
}

export async function render(root, { query }) {
  const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const from = query.get('desde') || new Date(Date.now() - 5 * 3600e3 - 29 * 86400e3).toISOString().slice(0, 10);
  const to = query.get('hasta') || today;
  const d = await api('/admin/dashboard?' + qs({ desde: from, hasta: to }));
  const maxUnits = Math.max(1, ...d.topProducts.map((t) => t.units));

  setHTML(root, html`
    <form class="toolbar" data-range>
      <label class="field-label" for="desde">Desde</label><input class="input" type="date" id="desde" name="desde" value="${from}" max="${today}">
      <label class="field-label" for="hasta">Hasta</label><input class="input" type="date" id="hasta" name="hasta" value="${to}" max="${today}">
      <button class="btn btn-sm" type="submit">Aplicar</button>
    </form>
    <div class="kpis">
      <div class="kpi"><span class="label">Pedidos web hoy</span><span class="v">${cop(d.webOrders.today.total)}</span><span class="s">${d.webOrders.today.count} pedido(s) creados, sin cancelar. No equivale a ventas confirmadas.</span></div>
      <div class="kpi"><span class="label">Confirmado hoy</span><span class="v">${cop(d.confirmedRevenue.today.total)}</span><span class="s">${d.confirmedRevenue.today.count} pedido(s) confirmados por el negocio</span></div>
      <div class="kpi"><span class="label">Confirmado este mes</span><span class="v">${cop(d.confirmedRevenue.month.total)}</span><span class="s">${d.confirmedRevenue.month.count} pedido(s) · Pedidos web del mes: ${cop(d.webOrders.month.total)}</span></div>
      <div class="kpi"><span class="label">Pagado este mes</span><span class="v">${cop(d.paidRevenue.month.total)}</span><span class="s">${d.paidRevenue.month.count} pedido(s) marcados como pagados</span></div>
    </div>
    <div class="grid-2">
      <section class="card-a"><h2>Ventas por día <span class="legend"><span><i style="background:#3A3A3A"></i>Pedidos web</span><span><i style="background:#F5F5F5"></i>Confirmados</span></span></h2>
        ${chart(d.series)}
        <p class="small muted" style="margin:10px 0 0">Período: confirmados ${cop(d.confirmedRevenue.range.total)} (${d.confirmedRevenue.range.count}) · pagados ${cop(d.paidRevenue.range.total)} (${d.paidRevenue.range.count}). Los cancelados no cuentan como ingresos.</p>
      </section>
      <section class="card-a"><h2>Pedidos por estado <span class="muted small">en el período</span></h2>
        <div class="bars-list">${d.ordersByStatus.map((s) => html`<a class="row" href="#/pedidos?${qs({ estado: s.status, desde: from, hasta: to })}"><span>${st(s.status, s.label)}</span><strong>${s.count}</strong></a>`)}</div>
      </section>
    </div>
    <div class="grid-2">
      <section class="card-a"><h2>Últimos pedidos <a class="text-btn" href="#/pedidos">Ver todos ${icon('arrow-right', 'icon-sm')}</a></h2>
        ${d.latestOrders.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th class="num">Total</th></tr></thead><tbody>
          ${d.latestOrders.map((o) => html`<tr><td><a class="rowlink mono" href="#/pedidos/${o.id}">${o.orderNumber}</a></td><td>${o.customerName}</td><td>${fmtDate(o.createdAt, true)}</td><td>${st(o.status, o.statusLabel)}</td><td class="num">${cop(o.total)}</td></tr>`)}
        </tbody></table></div>` : html`<p class="muted">Todavía no hay pedidos.</p>`}
      </section>
      <section class="card-a"><h2>Más vendidos <span class="muted small">confirmados</span></h2>
        ${d.topProducts.length ? html`<div class="bars-list">${d.topProducts.map((t) => html`<div class="row"><span>${t.name}</span><span class="muted">${t.units} u · ${cop(t.revenue)}</span><div class="bar"><span style="width:${(t.units / maxUnits) * 100}%"></span></div></div>`)}</div>` : html`<p class="muted">Aún no hay ventas confirmadas en el período.</p>`}
      </section>
    </div>
    <div class="grid-2e">
      <section class="card-a"><h2>Inventario</h2>
        <dl class="dl"><dt>Productos activos</dt><dd>${d.products.active}</dd><dt>Productos agotados</dt><dd><a class="link" href="#/productos?stock=agotados">${d.products.soldOut}</a></dd><dt>Variantes con stock bajo</dt><dd><a class="link" href="#/productos?stock=bajo">${d.products.lowStock.length}</a> (≤ ${d.products.lowStockThreshold} unidades)</dd></dl>
      </section>
      <section class="card-a"><h2>Stock bajo</h2>
        ${d.products.lowStock.length ? html`<div class="table-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Variante</th><th class="num">Stock</th></tr></thead><tbody>${d.products.lowStock.map((v) => html`<tr><td><a class="rowlink" href="#/productos/${v.product.id}">${v.product.name}</a></td><td>${v.color} / ${v.size}</td><td class="num">${v.stock}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Sin alertas de inventario.</p>`}
      </section>
    </div>`);

  $('[data-range]', root).addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = '#/?' + qs({ desde: e.target.desde.value, hasta: e.target.hasta.value });
  });
}
