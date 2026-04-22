const SUPABASE_URL = 'https://xmvuvnmsypcrcvtjaoso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnV2bm1zeXBjcmN2dGphb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODgxMDksImV4cCI6MjA5MTY2NDEwOX0.swF0BN51SpUNwXbyarMouP_peukIfod5qzApGcK_oa4';

let currentUser = JSON.parse(localStorage.getItem('userSession')) || null;
let currentTab = 'activos';
let idViajeEnProceso = null;

document.addEventListener('DOMContentLoaded', () => { if (currentUser) showApp(); });

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = currentUser.nombre;
    document.getElementById('user-role').innerText = currentUser.rol;
    renderTabs();
    if (currentUser.rol === 'admin') {
        document.getElementById('admin-only-filter').style.display = 'block';
        cargarListaChoferes();
    }
    fetchViajes();
}

function renderTabs() {
    const container = document.getElementById('status-tabs-container');
    if (currentUser.rol === 'admin') {
        container.innerHTML = `
            <button class="tab-btn active" onclick="setStatusFilter('activos', this)">ACTIVOS</button>
            <button class="tab-btn" onclick="setStatusFilter('finalizados', this)">POR CERRAR</button>
            <button class="tab-btn" onclick="setStatusFilter('por_liquidar', this)">PARA LIQUIDAR</button>
            <button class="tab-btn" onclick="setStatusFilter('liquidados', this)">LIQUIDADOS</button>
        `;
    } else {
        container.innerHTML = `
            <button class="tab-btn active" onclick="setStatusFilter('activos', this)">MIS VIAJES</button>
            <button class="tab-btn" onclick="setStatusFilter('terminados', this)">HISTORIAL</button>
        `;
    }
}

function setStatusFilter(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const btnLiq = document.getElementById('btn-liquidar-seleccion');
    if (btnLiq) btnLiq.style.display = (tab === 'por_liquidar') ? 'block' : 'none';
    fetchViajes();
}

async function fetchViajes() {
    const contenedor = document.getElementById('viajes-list');
    const fFecha = document.getElementById('filter-fecha').value;
    const modoAgrupacion = document.getElementById('group-by').value;
    let query = `?select=*&order=id.desc`;

    if (currentTab === 'activos') query += `&estado=in.("disponible","aceptado","en camino")`;
    else if (currentTab === 'finalizados') query += `&estado=eq.finalizado`;
    else if (currentTab === 'por_liquidar') query += `&estado=eq.cerrado`;
    else if (currentTab === 'liquidados') query += `&estado=eq.liquidado`;
    else if (currentTab === 'terminados') query += `&estado=in.("finalizado","cerrado","liquidado")`;

    if (currentUser.rol !== 'admin') query += `&chofer=eq.${currentUser.nombre}`;
    else {
        const fChofer = document.getElementById('filter-chofer').value;
        if (fChofer) query += `&chofer=eq.${fChofer}`;
    }
    if (fFecha) query += `&fecha=eq.${fFecha.replace(/-/g, '')}`;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes${query}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const viajes = await res.json();
    document.getElementById('total-viajes').innerText = viajes.length;
    contenedor.innerHTML = '';

    if (modoAgrupacion === 'lista') {
        const grid = document.createElement('div');
        grid.className = 'viajes-grid';
        renderLista(viajes, grid);
        contenedor.appendChild(grid);
    } else {
        renderAgrupado(viajes, contenedor, modoAgrupacion);
    }
}

function renderLista(viajes, parent) {
    viajes.forEach(v => {
        const card = document.createElement('div');
        const statusClass = `st-border-${v.estado.replace(/\s+/g, '-')}`;
        const isLiqTab = (currentTab === 'por_liquidar');

        const trayecto = [
            { dir: v.direccion_origen, icon: 'fa-location-dot', col: 'var(--hm-navy)', label: 'Inicio' },
            { dir: v.direccion_parada1, icon: 'fa-circle-dot', col: 'var(--hm-orange)', label: 'Parada 1' },
            { dir: v.direccion_parada2, icon: 'fa-circle-dot', col: 'var(--hm-orange)', label: 'Parada 2' },
            { dir: v.direccion_destino, icon: 'fa-flag-checkered', col: 'var(--success)', label: 'Destino' }
        ].filter(p => p.dir && p.dir.toString().trim() !== "" && p.dir !== "null");

        const htmlRuta = trayecto.map((p, index) => `
            <div class="ruta-item">
                <div class="ruta-icon-wrapper"><i class="fas ${p.icon}" style="color: ${p.col}"></i></div>
                <div class="ruta-texto"><small>${p.label}</small><span>${p.dir}</span></div>
            </div>
            ${index < trayecto.length - 1 ? '<div class="ruta-linea"></div>' : ''}
        `).join('');

        // LÓGICA DE MAPA: Navegar a la última parada disponible
        const destinoFinal = trayecto[trayecto.length - 1]?.dir || "";
        const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinoFinal)}`;

        card.className = `viaje-card ${statusClass}`;
        card.innerHTML = `
            <div class="v-header">
                <span>${isLiqTab ? `<input type="checkbox" class="liq-check" value="${v.id}">` : ''} #${v.id}</span>
                <span>S/ ${v.monto}</span>
            </div>
            <div class="v-body">
                <div class="ruta-contenedor">${htmlRuta}</div>
                <div class="info-footer-card">
                    <span><i class="fas fa-user"></i> ${v.chofer}</span>
                    <span><i class="fas fa-wallet"></i> ${v.metodo_pago || '-'}</span>
                </div>
            </div>
            <div class="v-footer">
                <span class="v-status">${v.estado.toUpperCase()}</span>
                <div class="v-actions">
                    ${v.estado !== 'liquidado' && v.estado !== 'cerrado' ?
                `<a href="${urlMaps}" target="_blank" class="btn-nav"><i class="fas fa-map-marker-alt"></i> Mapa</a>` : ''}
                    ${renderBotones(v)}
                </div>
            </div>
        `;
        parent.appendChild(card);
    });
}

function renderAgrupado(viajes, parent, prop) {
    const grupos = {};
    viajes.forEach(v => {
        let k = v[prop] || 'Sin asignar';
        if (prop === 'fecha' && k !== 'Sin asignar') {
            k = k.toString().replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        }
        if (!grupos[k]) grupos[k] = [];
        grupos[k].push(v);
    });

    for (let k in grupos) {
        const section = document.createElement('div');
        const icon = prop === 'chofer' ? 'fa-user' : 'fa-calendar-alt';
        section.innerHTML = `<div class="group-header"><div><i class="fas ${icon}"></i> <b>${k.toUpperCase()}</b></div><span>${grupos[k].length} servicios</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'viajes-grid';
        renderLista(grupos[k], grid);
        section.appendChild(grid);
        parent.appendChild(section);
    }
}

function renderBotones(v) {
    if (v.estado === 'liquidado') return '<i class="fas fa-check-double" style="color:var(--success)"></i>';
    if (currentUser.rol === 'admin') {
        if (v.estado === 'finalizado') return `<button class="btn-step" onclick="updateEstado(${v.id}, 'cerrado')">Cerrar</button>`;
        return '';
    }
    if (v.estado === 'en camino') return `<button class="btn-step btn-success" onclick="abrirModalPago(${v.id}, ${v.monto})">Cobrar</button>`;
    const flujo = { 'disponible': 'aceptado', 'aceptado': 'en camino' };
    return flujo[v.estado] ? `<button class="btn-step" onclick="updateEstado(${v.id}, '${flujo[v.estado]}')">${flujo[v.estado]}</button>` : '';
}

async function updateEstado(id, nuevo) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo })
    });
    fetchViajes();
}

function abrirModalPago(id, monto) {
    idViajeEnProceso = id;
    document.getElementById('pago-monto-label').innerText = `Total: S/ ${monto}`;
    document.getElementById('pago-modal').style.display = 'flex';
}

function closePagoModal() { document.getElementById('pago-modal').style.display = 'none'; }

async function confirmarPago() {
    const met = document.getElementById('pago-metodo').value;
    const des = document.getElementById('pago-destino').value;
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${idViajeEnProceso}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'finalizado', metodo_pago: met, pago_destino: des })
    });
    closePagoModal();
    fetchViajes();
}

async function liquidarSeleccionados() {
    const sel = Array.from(document.querySelectorAll('.liq-check:checked')).map(c => c.value);
    if (sel.length === 0) return alert("Selecciona viajes");
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=in.(${sel.join(',')})`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'liquidado' })
    });
    fetchViajes();
}

async function handleLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${u}&password=eq.${p}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    if (d.length > 0) { localStorage.setItem('userSession', JSON.stringify(d[0])); location.reload(); }
    else alert("Credenciales incorrectas");
}

function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }

async function cargarListaChoferes() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?rol=eq.chofer`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    const sel = document.getElementById('filter-chofer');
    if (sel) {
        sel.innerHTML = '<option value="">Todos los conductores</option>';
        d.forEach(c => sel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`);
    }
}