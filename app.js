const SUPABASE_URL = 'https://xmvuvnmsypcrcvtjaoso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnV2bm1zeXBjcmN2dGphb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODgxMDksImV4cCI6MjA5MTY2NDEwOX0.swF0BN51SpUNwXbyarMouP_peukIfod5qzApGcK_oa4';

let currentUser = JSON.parse(localStorage.getItem('userSession')) || null;
let currentTab = 'activos';
let mapsActive = {};

document.addEventListener('DOMContentLoaded', () => { if (currentUser) showApp(); });

// --- AUTENTICACIÓN ---
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
    } else { alert("Usuario o clave incorrecta"); }
}

function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }

// --- VISTAS ---
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

// --- LÓGICA DE VIAJES ---
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
    contenedor.innerHTML = '<div style="padding:15px; display:flex; flex-direction:column; gap:20px;"></div>';
    renderLista(viajes, contenedor.firstChild);
}

function renderLista(viajes, parent) {
    Object.values(mapsActive).forEach(m => m.remove());
    mapsActive = {};

    viajes.forEach(v => {
        const puntos = [
            { label: 'Origen', dir: v.direccion_origen },
            { label: 'Parada 1', dir: v.direccion_parada1 },
            { label: 'Parada 2', dir: v.direccion_parada2 },
            { label: 'Destino', dir: v.direccion_destino }
        ].filter(p => p.dir && p.dir.toString().trim() !== "" && p.dir !== "null");

        const card = document.createElement('div');
        card.style.background = "#fff"; card.style.borderRadius = "20px"; card.style.boxShadow = "0 5px 15px rgba(0,0,0,0.05)"; card.style.overflow = "hidden";

        const mapId = `map-${v.id}`;
        card.innerHTML = `
            <div style="padding:15px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between;">
                <span style="font-weight:bold; font-size:0.9rem;">SERVICIO #${v.id}</span>
                <span style="color:#f37a1f; font-weight:bold;">S/ ${v.monto}</span>
            </div>
            <div style="padding:15px;">
                <div style="border-left:2px solid #e2e8f0; margin-left:10px; padding-left:20px;">
                    ${puntos.map((p, idx) => `
                        <div style="margin-bottom:10px; position:relative;">
                            <div style="position:absolute; left:-27px; top:4px; width:12px; height:12px; border-radius:50%; background:${idx === puntos.length-1 ? '#10b981' : '#0d1b32'};"></div>
                            <b style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;">${p.label}</b>
                            <div style="font-size:0.85rem;">${p.dir}</div>
                        </div>
                    `).join('')}
                </div>
                <div id="${mapId}" style="height:200px; width:100%; border-radius:15px; margin-top:10px; background:#eee;"></div>
            </div>
            <div style="padding:12px; background:#f8fafc; display:flex; justify-content:space-between;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.direccion_destino)}" target="_blank" style="text-decoration:none; background:#2563eb; color:white; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:0.75rem;">GPS</a>
                ${renderBotonAccion(v)}
            </div>`;
        
        parent.appendChild(card);
        setTimeout(() => inicializarMapa(mapId, puntos), 300);
    });
}

// --- MAPA DINÁMICO (RUTA + GPS) ---
async function inicializarMapa(mapId, puntosRuta) {
    try {
        const map = L.map(mapId, { zoomControl: false }).setView([-12.046374, -77.042793], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' }).addTo(map);

        const coordsParaEncuadre = [];

        for (const punto of puntosRuta) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(punto.dir + ", Lima, Peru")}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const coord = [data[0].lat, data[0].lon];
                L.marker(coord).addTo(map).bindPopup(punto.dir);
                coordsParaEncuadre.push(coord);
            }
        }

        // GPS Conductor
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const driverCoord = [pos.coords.latitude, pos.coords.longitude];
                L.marker(driverCoord, { icon: L.divIcon({ html: '<i class="fas fa-taxi" style="color:#f37a1f; font-size:20px;"></i>', className: '' }) }).addTo(map);
                coordsParaEncuadre.push(driverCoord);
                if (coordsParaEncuadre.length > 0) map.fitBounds(coordsParaEncuadre, { padding: [30, 30] });
            });
        }
        
        mapsActive[mapId] = map;
    } catch (e) { console.error("Error mapa:", e); }
}

function renderBotonAccion(v) {
    const flujo = { 'disponible': 'aceptado', 'aceptado': 'en camino', 'en camino': 'finalizado' };
    if (v.estado === 'finalizado') return '<span style="color:#10b981; font-weight:bold; font-size:0.8rem;">✓ CERRADO</span>';
    return `<button onclick="updateEstado(${v.id}, '${flujo[v.estado]}')" style="border:none; background:#0d1b32; color:white; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:0.75rem;">${flujo[v.estado].toUpperCase()}</button>`;
}

// --- CRUD ---
async function updateEstado(id, nuevo) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo })
    });
    fetchViajes();
}

async function eliminarViaje(id) {
    if(confirm("¿Eliminar servicio?")) {
        await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        fetchViajes();
    }
}

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
        monto: parseFloat(document.getElementById('reg-monto').value) || 0,
        direccion_origen: document.getElementById('reg-origen').value,
        direccion_parada1: document.getElementById('reg-p1').value || null,
        direccion_parada2: document.getElementById('reg-p2').value || null,
        direccion_destino: document.getElementById('reg-destino').value,
        estado: 'disponible',
        fecha: new Date().toLocaleDateString('es-PE')
    };
    await fetch(`${SUPABASE_URL}/rest/v1/viajes`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(v)
    });
    cerrarModalNuevoViaje();
    fetchViajes();
}

function abrirModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'flex'; }
function cerrarModalNuevoViaje() { document.getElementById('nuevo-viaje-modal').style.display = 'none'; }