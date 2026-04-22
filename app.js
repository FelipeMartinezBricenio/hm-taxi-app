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
        document.getElementById('btn-nuevo-viaje').style.display = 'flex';
        cargarChoferesEnListas();
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
        container.innerHTML = `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">MIS VIAJES</button><button class="tab-btn" onclick="setStatusFilter('terminados', this)">HISTORIAL</button>`;
    }
}

function setStatusFilter(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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
        const grid = document.createElement('div'); grid.className = 'viajes-grid';
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
        const trayecto = [
            { dir: v.direccion_origen, label: 'Inicio' },
            { dir: v.direccion_parada1, label: 'P1' },
            { dir: v.direccion_parada2, label: 'P2' },
            { dir: v.direccion_destino, label: 'Fin' }
        ].filter(p => p.dir && p.dir.toString().trim() !== "" && p.dir !== "null");

        const destinoFinal = trayecto[trayecto.length - 1]?.dir || "";
        const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinoFinal)}`;

        card.className = `viaje-card ${statusClass}`;
        card.innerHTML = `
            <div class="v-header">
                <span>${currentTab === 'por_liquidar' ? `<input type="checkbox" class="liq-check" value="${v.id}"> ` : ''}#${v.id}</span>
                <span>S/ ${v.monto}</span>
            </div>
            <div class="v-body">
                <div class="ruta-contenedor">
                    ${trayecto.map(p => `<div class="ruta-item"><b>${p.label}:</b> ${p.dir}</div>`).join('')}
                </div>
                <div class="info-footer-card">
                    <span><i class="fas fa-user"></i> ${v.chofer}</span>
                    <span><i class="fas fa-calendar"></i> ${v.fecha}</span>
                </div>
            </div>
            <div class="v-footer">
                <div class="v-actions">
                    ${currentUser.rol === 'admin' ? `<button class="btn-delete" onclick="eliminarViaje(${v.id})"><i class="fas fa-trash"></i></button>` : ''}
                    ${(v.estado !== 'liquidado' && v.estado !== 'cerrado') ? `<a href="${urlMaps}" target="_blank" class="btn-nav">Mapa</a>` : ''}
                </div>
                <div class="v-actions">${renderBotones(v)}</div>
            </div>
        `;
        parent.appendChild(card);
    });
}

function renderBotones(v) {
    if (v.estado === 'liquidado') return '<i class="fas fa-check-double" style="color:var(--success)"></i>';
    if (currentUser.rol === 'admin') {
        if (v.estado === 'finalizado') return `<button class="btn-step" onclick="updateEstado(${v.id}, 'cerrado')">Cerrar</button>`;
        return `<span class="v-status">${v.estado}</span>`;
    }
    if (v.estado === 'en camino') return `<button class="btn-step btn-success" onclick="abrirModalPago(${v.id}, ${v.monto})">Cobrar</button>`;
    const flujo = { 'disponible': 'aceptado', 'aceptado': 'en camino' };
    return flujo[v.estado] ? `<button class="btn-step" onclick="updateEstado(${v.id}, '${flujo[v.estado]}')">${flujo[v.estado]}</button>` : `<span class="v-status">${v.estado}</span>`;
}

// --- FUNCIONES ADMIN: NUEVO VIAJE ---
function abrirModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'flex'; }
function cerrarModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'none'; }

async function guardarNuevoViaje() {
    const v = {
        chofer: document.getElementById('reg-chofer').value,
        monto: parseFloat(document.getElementById('reg-monto').value),
        direccion_origen: document.getElementById('reg-origen').value,
        direccion_parada1: document.getElementById('reg-p1').value || null,
        direccion_parada2: document.getElementById('reg-p2').value || null,
        direccion_destino: document.getElementById('reg-destino').value,
        estado: 'disponible',
        fecha: new Date().toISOString().split('T')[0].replace(/-/g, '')
    };

    if(!v.monto || !v.direccion_origen || !v.direccion_destino) return alert("Completa los campos obligatorios");

    const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
    });
    if(res.ok) { cerrarModalNuevoViaje(); fetchViajes(); }
}

async function eliminarViaje(id) {
    if(!confirm(`¿Estás seguro de eliminar el viaje #${id}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if(res.ok) fetchViajes();
}

async function cargarChoferesEnListas() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?rol=eq.chofer`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    document.getElementById('filter-chofer').innerHTML = '<option value="">Todos</option>' + d.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    document.getElementById('reg-chofer').innerHTML = d.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
}

// --- FUNCIONES COMUNES ---
async function updateEstado(id, nuevo) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo })
    });
    fetchViajes();
}

function abrirModalPago(id, monto) { idViajeEnProceso = id; document.getElementById('pago-monto-label').innerText = `Total: S/ ${monto}`; document.getElementById('pago-modal').style.display = 'flex'; }
function closePagoModal() { document.getElementById('pago-modal').style.display = 'none'; }
async function confirmarPago() {
    const met = document.getElementById('pago-metodo').value;
    const des = document.getElementById('pago-destino').value;
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${idViajeEnProceso}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'finalizado', metodo_pago: met, pago_destino: des })
    });
    closePagoModal(); fetchViajes();
}

async function handleLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${u}&password=eq.${p}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    if (d.length > 0) { localStorage.setItem('userSession', JSON.stringify(d[0])); location.reload(); }
    else alert("Error");
}
function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }
function renderAgrupado(viajes, parent, prop) {
    const grupos = {};
    viajes.forEach(v => { 
        let k = v[prop] || 'Sin asignar'; 
        if (prop === 'fecha' && k !== 'Sin asignar') k = k.toString().replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if(!grupos[k]) grupos[k] = []; grupos[k].push(v); 
    });
    for (let k in grupos) {
        const section = document.createElement('div');
        section.innerHTML = `<div class="group-header"><b>${k.toUpperCase()}</b> <span>${grupos[k].length}</span></div>`;
        const grid = document.createElement('div'); grid.className = 'viajes-grid';
        renderLista(grupos[k], grid);
        section.appendChild(grid); parent.appendChild(section);
    }
}