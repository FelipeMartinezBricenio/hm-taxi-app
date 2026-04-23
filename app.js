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
        ? `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">ACTIVOS</button><button class="tab-btn" onclick="setStatusFilter('finalizados', this)">HISTORIAL</button>`
        : `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">MIS VIAJES</button><button class="tab-btn" onclick="setStatusFilter('terminados', this)">HISTORIAL</button>`;
}

function setStatusFilter(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fetchViajes();
}

// --- LÓGICA DE DATOS ---
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
        const puntos = [];
        if (v.direccion_origen) puntos.push({ label: 'Origen', dir: v.direccion_origen, status: v.estado_origen, color: '#0d1b32' });
        if (v.direccion_parada1 && v.direccion_parada1 !== "null") puntos.push({ label: 'Parada 1', dir: v.direccion_parada1, precio: v.monto_p1, status: v.estado_p1, color: '#0d1b32' });
        if (v.direccion_parada2 && v.direccion_parada2 !== "null") puntos.push({ label: 'Parada 2', dir: v.direccion_parada2, precio: v.monto_p2, status: v.estado_p2, color: '#0d1b32' });
        if (v.direccion_destino) puntos.push({ label: 'Destino', dir: v.direccion_destino, status: v.estado, color: '#ef4444' });

        const card = document.createElement('div');
        card.style.background = "#fff"; card.style.borderRadius = "20px"; card.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)"; card.style.overflow = "hidden";

        const mapId = `map-${v.id}`;
        card.innerHTML = `
            <div style="padding:15px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#0d1b32; font-size:0.9rem;">SERVICIO #${v.id}</span>
                <span style="color:#f37a1f; font-weight:bold; background:#fff4eb; padding:5px 12px; border-radius:12px;">S/ ${v.monto}</span>
            </div>
            <div style="padding:15px;">
                <div style="border-left:2px solid #e2e8f0; margin-left:10px; padding-left:20px; position:relative;">
                    ${puntos.map((p, idx) => `
                        <div style="margin-bottom:12px; position:relative;">
                            <div style="position:absolute; left:-27px; top:4px; width:12px; height:12px; border-radius:50%; background:${(p.status === 'completado' || p.status === 'finalizado') ? '#10b981' : p.color}; border:2px solid #fff;"></div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="flex:1;">
                                    <b style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase;">${p.label} ${p.status === 'completado' ? '✓' : ''}</b>
                                    <div style="font-size:0.85rem; font-weight:500;">${p.dir}</div>
                                </div>
                                ${p.precio > 0 ? `<span style="font-size:0.75rem; font-weight:bold; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:6px; margin-left:8px;">+ S/ ${p.precio}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div id="${mapId}" style="height:200px; width:100%; border-radius:15px; margin-top:10px; background:#f8fafc; border:1px solid #e2e8f0; z-index:1;"></div>
            </div>
            <div style="padding:12px; background:#f8fafc; display:flex; justify-content:space-between;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.direccion_destino)}" target="_blank" style="text-decoration:none; background:#2563eb; color:white; padding:10px 15px; border-radius:10px; font-weight:bold; font-size:0.75rem;">GOOGLE MAPS</a>
                <div>${renderBotonAccionInteligente(v)}</div>
            </div>`;
        
        parent.appendChild(card);
        setTimeout(() => inicializarMapa(mapId, puntos), 600);
    });
}

function renderBotonAccionInteligente(v) {
    if (v.estado === 'finalizado') return '<span style="color:#10b981; font-weight:bold;">✓ CERRADO</span>';
    if (v.estado === 'disponible') return `<button onclick="updateEstadoViaje(${v.id}, {estado:'aceptado'})" class="btn-step">ACEPTAR</button>`;
    if (v.estado === 'aceptado') return `<button onclick="updateEstadoViaje(${v.id}, {estado:'en camino', estado_origen:'completado'})" class="btn-step" style="background:#10b981;">LLEGUÉ AL ORIGEN</button>`;

    if (v.estado === 'en camino') {
        if (v.direccion_parada1 && v.direccion_parada1 !== "null" && v.estado_p1 !== 'completado') {
            return `<button onclick="updateEstadoViaje(${v.id}, {estado_p1:'completado'})" class="btn-step" style="background:#f37a1f;">FIN PARADA 1</button>`;
        }
        if (v.direccion_parada2 && v.direccion_parada2 !== "null" && v.estado_p2 !== 'completado') {
            return `<button onclick="updateEstadoViaje(${v.id}, {estado_p2:'completado'})" class="btn-step" style="background:#f37a1f;">FIN PARADA 2</button>`;
        }
        return `<button onclick="updateEstadoViaje(${v.id}, {estado:'finalizado'})" class="btn-step" style="background:#10b981;">FINALIZAR</button>`;
    }
}

// --- MAPA CORREGIDO ---
async function inicializarMapa(mapId, puntosRuta) {
    const el = document.getElementById(mapId);
    if (!el) return;

    try {
        const map = L.map(mapId, { zoomControl: false }).setView([-12.046374, -77.042793], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' }).addTo(map);

        const coordsParaEncuadre = [];

        // Buscar cada punto con un pequeño retraso para evitar bloqueo de API
        for (const punto of puntosRuta) {
            const cleanDir = punto.dir.split(',')[0].trim() + ", Lima, Peru"; // Limpieza básica
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanDir)}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                    L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: (punto.status === 'completado' || punto.status === 'finalizado') ? '#10b981' : punto.color,
                        color: "#fff",
                        weight: 2,
                        fillOpacity: 1
                    }).addTo(map).bindPopup(punto.label);
                    coordsParaEncuadre.push(latlng);
                }
            } catch (e) { console.error("Error buscando:", cleanDir); }
        }

        // GPS Conductor
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const driverPos = [pos.coords.latitude, pos.coords.longitude];
                L.marker(driverPos, { icon: L.divIcon({ html: '<i class="fas fa-taxi" style="color:#f37a1f; font-size:18px;"></i>', className: '' }) }).addTo(map);
                coordsParaEncuadre.push(driverPos);
                if (coordsParaEncuadre.length > 1) map.fitBounds(coordsParaEncuadre, { padding: [30, 30] });
            });
        }

        if (coordsParaEncuadre.length > 0) {
            map.fitBounds(coordsParaEncuadre, { padding: [40, 40] });
        }

        mapsActive[mapId] = map;
        setTimeout(() => map.invalidateSize(), 300);
    } catch (e) { console.error("Fallo mapa:", e); }
}

async function updateEstadoViaje(id, datos) {
    await fetch(`${SUPABASE_URL}/rest/v1/viajes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    fetchViajes();
}

async function cargarChoferesFormulario() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?rol=eq.chofer`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    const select = document.getElementById('reg-chofer');
    if(select) select.innerHTML = d.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
}

async function guardarNuevoViaje() {
    const v = {
        chofer: document.getElementById('reg-chofer').value,
        monto: parseFloat(document.getElementById('reg-monto').value) || 0,
        direccion_origen: document.getElementById('reg-origen').value,
        estado_origen: 'pendiente',
        direccion_parada1: document.getElementById('reg-p1').value || null,
        monto_p1: parseFloat(document.getElementById('reg-monto-p1').value) || 0,
        estado_p1: 'pendiente',
        direccion_parada2: document.getElementById('reg-p2').value || null,
        monto_p2: parseFloat(document.getElementById('reg-monto-p2').value) || 0,
        estado_p2: 'pendiente',
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