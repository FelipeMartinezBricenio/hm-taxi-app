const SUPABASE_URL = 'https://xmvuvnmsypcrcvtjaoso.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdnV2bm1zeXBjcmN2dGphb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODgxMDksImV4cCI6MjA5MTY2NDEwOX0.swF0BN51SpUNwXbyarMouP_peukIfod5qzApGcK_oa4';

let currentUser = JSON.parse(localStorage.getItem('userSession')) || null;
let currentTab = 'activos';
let mapsActive = {};

document.addEventListener('DOMContentLoaded', () => { if (currentUser) showApp(); });

// --- AUTH ---
async function handleLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${u}&password=eq.${p}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const d = await res.json();
    if (d.length > 0) { localStorage.setItem('userSession', JSON.stringify(d[0])); location.reload(); }
    else { alert("Error"); }
}

function handleLogout() { localStorage.removeItem('userSession'); location.reload(); }

function showApp() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = currentUser.nombre;
    renderTabs();
    if (currentUser.rol === 'admin') document.getElementById('btn-nuevo-viaje').style.display = 'flex';
    if (currentUser.rol === 'admin') cargarChoferesFormulario();
    fetchViajes();
}

function renderTabs() {
    const container = document.getElementById('status-tabs-container');
    container.innerHTML = `<button class="tab-btn active" onclick="setStatusFilter('activos', this)">ACTIVOS</button><button class="tab-btn" onclick="setStatusFilter('finalizados', this)">HISTORIAL</button>`;
}

function setStatusFilter(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fetchViajes();
}

// --- DATA ---
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
        card.style.background = "#fff"; card.style.borderRadius = "20px"; card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.05)"; card.style.overflow = "hidden";

        const mapId = `map-${v.id}`;
        card.innerHTML = `
            <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; font-size:0.8rem;">VIAJE #${v.id}</span>
                <span style="color:var(--hm-orange); font-weight:bold;">S/ ${v.monto}</span>
            </div>
            <div style="padding:15px;">
                <div style="border-left:2px solid #e2e8f0; margin-left:10px; padding-left:20px;">
                    ${puntos.map(p => `
                        <div style="margin-bottom:10px; position:relative;">
                            <div style="position:absolute; left:-27px; top:4px; width:12px; height:12px; border-radius:50%; background:${(p.status === 'completado' || p.status === 'finalizado') ? '#10b981' : p.color}; border:2px solid #fff;"></div>
                            <div style="display:flex; justify-content:space-between;">
                                <div style="flex:1;"><b style="font-size:0.6rem; color:#94a3b8;">${p.label}</b><div style="font-size:0.8rem;">${p.dir}</div></div>
                                ${p.precio > 0 ? `<span style="font-size:0.7rem; font-weight:bold;">+ S/ ${p.precio}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div id="${mapId}" style="height:220px; width:100%; border-radius:15px; margin-top:10px; background:#f8fafc; z-index:1;"></div>
            </div>
            <div style="padding:12px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.direccion_destino)}" target="_blank" style="text-decoration:none; color:#2563eb; font-weight:bold; font-size:0.7rem;"><i class="fas fa-map-marked-alt"></i> GOOGLE MAPS</a>
                ${renderBotonAccionInteligente(v)}
            </div>`;
        
        parent.appendChild(card);
        setTimeout(() => inicializarMapa(mapId, puntos), 800);
    });
}

function renderBotonAccionInteligente(v) {
    if (v.estado === 'finalizado') return '<span style="color:#10b981; font-weight:bold; font-size:0.7rem;">CERRADO</span>';
    if (v.estado === 'disponible') return `<button onclick="updateEstadoViaje(${v.id}, {estado:'aceptado'})" class="btn-step">ACEPTAR</button>`;
    if (v.estado === 'aceptado') return `<button onclick="updateEstadoViaje(${v.id}, {estado:'en camino', estado_origen:'completado'})" class="btn-step" style="background:#10b981;">LLEGUÉ</button>`;

    if (v.estado === 'en camino') {
        if (v.direccion_parada1 && v.direccion_parada1 !== "null" && v.estado_p1 !== 'completado') {
            return `<button onclick="updateEstadoViaje(${v.id}, {estado_p1:'completado'})" class="btn-step" style="background:#f37a1f;">P1 LISTO</button>`;
        }
        if (v.direccion_parada2 && v.direccion_parada2 !== "null" && v.estado_p2 !== 'completado') {
            return `<button onclick="updateEstadoViaje(${v.id}, {estado_p2:'completado'})" class="btn-step" style="background:#f37a1f;">P2 LISTO</button>`;
        }
        return `<button onclick="updateEstadoViaje(${v.id}, {estado:'finalizado'})" class="btn-step" style="background:#10b981;">FINALIZAR</button>`;
    }
}

// --- MAPA CON RUTA ---
async function inicializarMapa(mapId, puntosRuta) {
    const el = document.getElementById(mapId);
    if (!el) return;

    try {
        const map = L.map(mapId, { zoomControl: false }).setView([-12.04, -77.04], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        const waypoints = [];

        for (const p of puntosRuta) {
            const cleanDir = p.dir.split(',')[0].trim() + ", Lima, Peru";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanDir)}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const latlng = L.latLng(data[0].lat, data[0].lon);
                    waypoints.push(latlng);
                    
                    // Marcador personalizado
                    L.circleMarker(latlng, {
                        radius: 7, 
                        fillColor: (p.status === 'completado' || p.status === 'finalizado') ? '#10b981' : p.color,
                        color: "#fff", weight: 2, fillOpacity: 1
                    }).addTo(map).bindPopup(p.label);
                }
            } catch (e) { console.error("Error coordenadas", e); }
        }

        // DIBUJAR RUTA
        if (waypoints.length >= 2) {
            L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: false,
                addWaypoints: false,
                createMarker: function() { return null; }, // Evitar marcadores por defecto del routing
                lineOptions: { styles: [{ color: '#2563eb', opacity: 0.6, weight: 5 }] },
                show: false
            }).addTo(map);
            
            const bounds = L.latLngBounds(waypoints);
            map.fitBounds(bounds, { padding: [30, 30] });
        }

        mapsActive[mapId] = map;
        setTimeout(() => map.invalidateSize(), 400);
    } catch (e) { console.error("Error mapa", e); }
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