const SUPABASE_URL = 'https://xmvuvnmsypcrcvtjaoso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnV2bm1zeXBjcmN2dGphb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODgxMDksImV4cCI6MjA5MTY2NDEwOX0.swF0BN51SpUNwXbyarMouP_peukIfod5qzApGcK_oa4';

let currentUser = JSON.parse(localStorage.getItem('userSession')) || null;
let currentTab = 'activos';

document.addEventListener('DOMContentLoaded', () => { if (currentUser) showApp(); });

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = currentUser.nombre;
    document.getElementById('user-role').innerText = currentUser.rol;
    renderTabs();
    if (currentUser.rol === 'admin') {
        document.getElementById('btn-nuevo-viaje').style.display = 'flex';
        cargarChoferesFormulario();
    }
    fetchViajes();
}

function renderTabs() {
    const container = document.getElementById('status-tabs-container');
    if (currentUser.rol === 'admin') {
        container.innerHTML = `
            <button class="tab-btn active" onclick="setStatusFilter('activos', this)">ACTIVOS</button>
            <button class="tab-btn" onclick="setStatusFilter('finalizados', this)">POR CERRAR</button>
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
    fetchViajes();
}

async function fetchViajes() {
    const contenedor = document.getElementById('viajes-list');
    let query = `?select=*&order=id.desc`;

    if (currentTab === 'activos') query += `&estado=in.("disponible","aceptado","en camino")`;
    else if (currentTab === 'finalizados') query += `&estado=eq.finalizado`;
    else if (currentTab === 'liquidados') query += `&estado=eq.liquidado`;
    else if (currentTab === 'terminados') query += `&estado=in.("finalizado","liquidado")`;

    if (currentUser.rol !== 'admin') query += `&chofer=eq.${currentUser.nombre}`;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes${query}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const viajes = await res.json();
    contenedor.innerHTML = '<div class="viajes-grid"></div>';
    renderLista(viajes, contenedor.firstChild);
}

function renderLista(viajes, parent) {
    viajes.forEach(v => {
        const card = document.createElement('div');
        const trayecto = [
            { dir: v.direccion_origen, label: 'Punto de Inicio', class: '' },
            { dir: v.direccion_parada1, label: 'Parada 1', class: '' },
            { dir: v.direccion_parada2, label: 'Parada 2', class: '' },
            { dir: v.direccion_destino, label: 'Destino Final', class: 'destino' }
        ].filter(p => p.dir && p.dir.toString().trim() !== "" && p.dir !== "null");

        const destinoFinal = trayecto[trayecto.length - 1]?.dir || "";
        const urlMaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoFinal)}`;

        card.className = `viaje-card`;
        card.innerHTML = `
            <div class="v-header">
                <span style="font-size:0.8rem; font-weight:700; color:#94a3b8">#${v.id}</span>
                <span class="monto-badge">S/ ${v.monto}</span>
            </div>
            <div class="v-body">
                <div class="ruta-contenedor">
                    ${trayecto.map(p => `
                        <div class="ruta-item ${p.class}">
                            <b>${p.label}</b>
                            <span>${p.dir}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:20px; font-size:0.75rem; color:#94a3b8;">
                    <span><i class="fas fa-user"></i> ${v.chofer}</span>
                    <span><i class="fas fa-calendar"></i> ${v.fecha}</span>
                </div>
            </div>
            <div class="v-footer">
                <div style="display:flex; gap:10px;">
                    ${currentUser.rol === 'admin' ? `<button class="btn-delete" onclick="eliminarViaje(${v.id})"><i class="fas fa-trash"></i></button>` : ''}
                    ${(v.estado !== 'liquidado') ? `<a href="${urlMaps}" target="_blank" class="btn-nav"><i class="fab fa-google"></i> Mapa</a>` : ''}
                </div>
                <div>${renderBotones(v)}</div>
            </div>
        `;
        parent.appendChild(card);
    });
}

function renderBotones(v) {
    if (v.estado === 'liquidado') return '<span style="color:var(--success); font-weight:bold"><i class="fas fa-check-circle"></i> PAGADO</span>';
    if (currentUser.rol === 'admin' && v.estado === 'finalizado') {
        return `<button class="btn-step" onclick="updateEstado(${v.id}, 'liquidado')">Liquidar</button>`;
    }
    if (v.estado === 'en camino') return `<button class="btn-step" style="background:var(--success)" onclick="updateEstado(${v.id}, 'finalizado')">Cobrar</button>`;
    
    const flujo = { 'disponible': 'aceptado', 'aceptado': 'en camino' };
    return flujo[v.estado] ? `<button class="btn-step" onclick="updateEstado(${v.id}, '${flujo[v.estado]}')">${flujo[v.estado].toUpperCase()}</button>` : `<span style="font-size:0.75rem; font-weight:bold; color:#cbd5e1">${v.estado.toUpperCase()}</span>`;
}

// --- FUNCIONES ADMIN ---
async function cargarChoferesFormulario() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?rol=eq.chofer`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    document.getElementById('reg-chofer').innerHTML = d.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
}

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/viajes`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
    });
    if(res.ok) { cerrarModalNuevoViaje(); fetchViajes(); }
}

async function eliminarViaje(id) {
    if(!confirm(`¿Eliminar viaje #${id}?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    fetchViajes();
}

async function updateEstado(id, nuevo) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo })
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
}

function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }