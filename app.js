const SUPABASE_URL = 'https://xmvuvnmsypcrcvtjaoso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnV2bm1zeXBjcmN2dGphb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODgxMDksImV4cCI6MjA5MTY2NDEwOX0.swF0BN51SpUNwXbyarMouP_peukIfod5qzApGcK_oa4';

let currentUser = JSON.parse(localStorage.getItem('userSession')) || null;
let currentTab = 'activos';

document.addEventListener('DOMContentLoaded', () => { if (currentUser) showApp(); });

async function handleLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${u}&password=eq.${p}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    if (d.length > 0) {
        localStorage.setItem('userSession', JSON.stringify(d[0]));
        location.reload();
    } else {
        alert("Usuario o clave incorrecta");
    }
}

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = currentUser.nombre;
    renderTabs();
    if (currentUser.rol === 'admin') {
        document.getElementById('btn-nuevo-viaje').style.display = 'flex';
        cargarChoferesFormulario();
    }
    fetchViajes();
}

function renderTabs() {
    const container = document.getElementById('status-tabs-container');
    container.innerHTML = currentUser.rol === 'admin' 
        ? `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">ACTIVOS</button><button class="tab-btn" onclick="setStatusFilter('finalizados', this)">POR CERRAR</button>`
        : `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">MIS VIAJES</button><button class="tab-btn" onclick="setStatusFilter('terminados', this)">HISTORIAL</button>`;
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
    else query += `&estado=eq.finalizado`;

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
        card.className = 'viaje-card';
        const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.direccion_destino)}`;
        
        card.innerHTML = `
            <div class="v-header"><span>#${v.id}</span><b class="monto-badge">S/ ${v.monto}</b></div>
            <div class="v-body">
                <div class="ruta-contenedor">
                    <div class="ruta-item"><b>Origen</b><span>${v.direccion_origen}</span></div>
                    <div class="ruta-item destino"><b>Destino</b><span>${v.direccion_destino}</span></div>
                </div>
            </div>
            <div class="v-footer">
                <div style="display:flex; gap:8px;">
                    ${currentUser.rol === 'admin' ? `<button class="btn-delete" onclick="eliminarViaje(${v.id})"><i class="fas fa-trash"></i></button>` : ''}
                    <a href="${urlMaps}" target="_blank" class="btn-nav"><i class="fab fa-google"></i> Mapa</a>
                </div>
                <div>${renderBotonAccion(v)}</div>
            </div>`;
        parent.appendChild(card);
    });
}

function renderBotonAccion(v) {
    const flujo = { 'disponible': 'aceptado', 'aceptado': 'en camino', 'en camino': 'finalizado' };
    if (v.estado === 'finalizado') return '<span style="color:#10b981; font-weight:bold;">✓ TERMINADO</span>';
    return `<button class="btn-step" onclick="updateEstado(${v.id}, '${flujo[v.estado]}')">${flujo[v.estado].toUpperCase()}</button>`;
}

async function updateEstado(id, nuevo) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo })
    });
    fetchViajes();
}

async function eliminarViaje(id) {
    if(!confirm("¿Eliminar viaje?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    fetchViajes();
}

function abrirModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'flex'; }
function cerrarModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'none'; }
function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }

async function cargarChoferesFormulario() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?rol=eq.chofer`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    document.getElementById('reg-chofer').innerHTML = d.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
}

async function guardarNuevoViaje() {
    const v = {
        chofer: document.getElementById('reg-chofer').value,
        monto: parseFloat(document.getElementById('reg-monto').value),
        direccion_origen: document.getElementById('reg-origen').value,
        direccion_destino: document.getElementById('reg-destino').value,
        estado: 'disponible',
        fecha: new Date().toISOString().split('T')[0]
    };
    await fetch(`${SUPABASE_URL}/rest/v1/viajes`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
    });
    cerrarModalNuevoViaje();
    fetchViajes();
}