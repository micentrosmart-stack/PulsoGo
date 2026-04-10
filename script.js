// ===== LAS DOS URLS DE GOOGLE APPS SCRIPT =====
// URL del archivo de USUARIOS - ACTUALIZA CON TU NUEVA URL
const SCRIPT_URL_USUARIOS = "https://script.google.com/macros/s/AKfycbw44eZoDUG6jSMjE1x6LEq_8xp9LeVihqZ1fjQx7NSnNBuaeWZ5Fgk09WXdUWR7ZWP1xQ/exec";

// URL del archivo de REGISTRO DE ACCESOS
const SCRIPT_URL_REGISTRO = "https://script.google.com/macros/s/AKfycbw6WM72PGsbbRacwHNv7VLiOe4r8DcXZ0Vjrvbcgh9etbzbtvCXCMdaYTI9eX4KS62LdQ/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

// Elementos de la tarjeta moderna
const welcomeCard = document.getElementById('welcome-card');
const deniedCard = document.getElementById('denied-card');
const welcomeName = document.getElementById('welcome-name');
const welcomeCompany = document.getElementById('welcome-company');
const userRut = document.getElementById('user-rut');
const userRole = document.getElementById('user-role');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let timeoutOcultarCard = null;

// Variables para el cooldown
let ultimaDeteccion = null;
let tiempoUltimaDeteccion = 0;
let tiempoEspera = 4000;
let deteccionEnProceso = false;
let timeoutReactivacion = null;

// ===== FUNCIÓN: Registrar acceso =====
async function registrarAccesoEnArchivoSeparado(usuario) {
    try {
        const payload = {
            id: usuario.id,
            rut: usuario.rut,
            name: usuario.name,
            empresa: usuario.empresa,
            fecha: new Date().toISOString()
        };
        
        console.log("📝 Registrando acceso:", usuario.name);
        
        await fetch(SCRIPT_URL_REGISTRO, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
        
        console.log("✅ Acceso registrado");
    } catch (err) {
        console.error("❌ Error registrando acceso:", err);
    }
}

// ===== FUNCIÓN: ELIMINAR usuario (VERSIÓN CORREGIDA) =====
async function eliminarUsuario(idUsuario, rutUsuario, nombreUsuario) {
    // El confirm debe ejecutarse en el navegador, NO en el servidor
    const confirmar = confirm(`¿Estás seguro de eliminar al usuario "${nombreUsuario}" (${rutUsuario})?`);
    if (!confirmar) return false;
    
    try {
        console.log("🗑️ Eliminando usuario:", { id: idUsuario, rut: rutUsuario });
        
        const payload = {
            operacion: "eliminar",
            id: idUsuario,
            rut: rutUsuario
        };
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',  // Usamos no-cors para evitar CORS
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        alert("✅ Usuario eliminado correctamente");
        
        // Recargar la lista de usuarios
        setTimeout(async () => {
            await cargarUsuariosDesdeExcel();
            location.reload();
        }, 1000);
        
        return true;
    } catch (err) {
        console.error("❌ Error eliminando usuario:", err);
        alert("❌ Error al eliminar: " + err.message);
        return false;
    }
}

// ===== FUNCIÓN: EDITAR usuario =====
async function editarUsuario(idUsuario, nuevosDatos) {
    try {
        const payload = {
            operacion: "editar",
            id: idUsuario,
            ...nuevosDatos
        };
        
        console.log("📝 Editando usuario:", payload);
        
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        alert("✅ Usuario actualizado correctamente");
        
        setTimeout(async () => {
            await cargarUsuariosDesdeExcel();
            location.reload();
        }, 1000);
        
        return true;
    } catch (err) {
        console.error("❌ Error editando usuario:", err);
        alert("❌ Error al editar: " + err.message);
        return false;
    }
}

// ===== FUNCIÓN: Obtener usuario por ID =====
async function obtenerUsuario(idUsuario) {
    try {
        const response = await fetch(`${SCRIPT_URL_USUARIOS}?id=${idUsuario}`);
        const usuario = await response.json();
        return usuario;
    } catch (err) {
        console.error("Error obteniendo usuario:", err);
        return null;
    }
}

// ===== GENERAR LISTA HTML DE USUARIOS =====
function generarListaUsuariosHTML() {
    if (usuariosRegistrados.length === 0) {
        return '<p style="color: white; text-align: center; padding: 40px;">No hay usuarios registrados</p>';
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    usuariosRegistrados.forEach(usuario => {
        html += `
            <div style="background: #0f1422; border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 12px;">
                    <div style="flex: 1;">
                        <h3 style="color: white; margin-bottom: 8px;">
                            <i class="fas fa-user-circle" style="color: #3498db;"></i> ${escapeHtml(usuario.name)}
                        </h3>
                        <p style="color: #8b8faa; font-size: 12px;">📋 RUT: ${escapeHtml(usuario.rut)}</p>
                        <p style="color: #8b8faa; font-size: 12px;">💼 ${escapeHtml(usuario.role)} | 🏢 ${escapeHtml(usuario.empresa)}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick='abrirEditorUsuario(${JSON.stringify(usuario).replace(/'/g, "&apos;")})' 
                                style="background: #3498db; border: none; padding: 8px 16px; border-radius: 8px; color: white; cursor: pointer;">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button onclick='eliminarUsuario("${usuario.id}", "${usuario.rut}", "${usuario.name.replace(/"/g, '&quot;')}")' 
                                style="background: #e74c3c; border: none; padding: 8px 16px; border-radius: 8px; color: white; cursor: pointer;">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// ===== ESCAPAR HTML =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== MOSTRAR PANEL DE ADMINISTRACIÓN =====
function mostrarPanelAdmin() {
    const existingPanel = document.getElementById('panel-admin-modal');
    if (existingPanel) existingPanel.remove();
    
    const modal = document.createElement('div');
    modal.id = 'panel-admin-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1f2e 0%, #0f1422 100%); border-radius: 24px; max-width: 800px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
                <h2 style="color: white;"><i class="fas fa-users-cog"></i> Administrar Usuarios</h2>
                <button onclick="document.getElementById('panel-admin-modal').remove()" 
                        style="background: rgba(255,255,255,0.1); border: none; color: white; font-size: 24px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer;">
                    &times;
                </button>
            </div>
            <div id="lista-usuarios-admin">
                ${generarListaUsuariosHTML()}
            </div>
            <div style="text-align: center; padding-top: 16px;">
                <button onclick="refrescarListaAdmin()" 
                        style="background: #2ecc71; border: none; padding: 10px 24px; border-radius: 40px; color: white; cursor: pointer;">
                    <i class="fas fa-sync-alt"></i> Refrescar Lista
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===== REFRESCAR LISTA ADMIN =====
async function refrescarListaAdmin() {
    const listaDiv = document.getElementById('lista-usuarios-admin');
    if (listaDiv) {
        listaDiv.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-pulse"></i> Cargando...</div>';
        await cargarUsuariosDesdeExcel();
        listaDiv.innerHTML = generarListaUsuariosHTML();
    }
}

// ===== ABRIR EDITOR DE USUARIO =====
function abrirEditorUsuario(usuario) {
    const existingEditor = document.getElementById('editor-usuario-modal');
    if (existingEditor) existingEditor.remove();
    
    const modal = document.createElement('div');
    modal.id = 'editor-usuario-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.98);
        z-index: 1001;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1f2e; border-radius: 24px; max-width: 500px; width: 100%; padding: 28px;">
            <h3 style="color: white; margin-bottom: 24px;"><i class="fas fa-user-edit"></i> Editar Usuario</h3>
            <input type="text" id="edit-nombre" value="${escapeHtml(usuario.name)}" placeholder="Nombre" 
                   style="width: 100%; padding: 12px; margin-bottom: 12px; border-radius: 8px; background: #0f1422; color: white; border: 1px solid #333;">
            <input type="text" id="edit-rut" value="${escapeHtml(usuario.rut)}" placeholder="RUT" 
                   style="width: 100%; padding: 12px; margin-bottom: 12px; border-radius: 8px; background: #0f1422; color: white; border: 1px solid #333;">
            <input type="text" id="edit-cargo" value="${escapeHtml(usuario.role)}" placeholder="Cargo" 
                   style="width: 100%; padding: 12px; margin-bottom: 12px; border-radius: 8px; background: #0f1422; color: white; border: 1px solid #333;">
            <input type="text" id="edit-empresa" value="${escapeHtml(usuario.empresa)}" placeholder="Empresa" 
                   style="width: 100%; padding: 12px; margin-bottom: 24px; border-radius: 8px; background: #0f1422; color: white; border: 1px solid #333;">
            <div style="display: flex; gap: 12px;">
                <button onclick="editarUsuario('${usuario.id}', {
                    name: document.getElementById('edit-nombre').value,
                    rut: document.getElementById('edit-rut').value,
                    role: document.getElementById('edit-cargo').value,
                    empresa: document.getElementById('edit-empresa').value
                }).then(() => location.reload())" 
                        style="flex: 1; background: #2ecc71; border: none; padding: 12px; border-radius: 8px; color: white; cursor: pointer;">
                    Guardar
                </button>
                <button onclick="document.getElementById('editor-usuario-modal').remove()" 
                        style="flex: 1; background: #7f8c8d; border: none; padding: 12px; border-radius: 8px; color: white; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===== AGREGAR BOTÓN DE ADMIN =====
function agregarBotonAdmin() {
    const btnAdmin = document.createElement('button');
    btnAdmin.innerHTML = '<i class="fas fa-user-shield"></i> Administrar';
    btnAdmin.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        border: none;
        color: white;
        padding: 12px 24px;
        border-radius: 40px;
        cursor: pointer;
        font-weight: 600;
        z-index: 100;
        font-family: 'Inter', sans-serif;
    `;
    btnAdmin.onclick = mostrarPanelAdmin;
    document.body.appendChild(btnAdmin);
}

// ===== FUNCIONES PRINCIPALES DEL SISTEMA =====
async function iniciarSistema() {
    try {
        updateStatus("Cargando modelos faciales...", "fa-spinner fa-pulse");
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        updateStatus("Cargando usuarios...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        console.log("✅ Sistema listo - Usuarios:", usuariosRegistrados.length);

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            updateStatus("Sistema activo", "fa-eye");
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                if (deteccionEnProceso) return;
                deteccionEnProceso = true;
                
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (resized.length > 0) {
                    const rostro = resized[0];
                    const descriptor = rostro.descriptor;
                    const resultado = buscarCoincidencia(descriptor);
                    
                    if (resultado.label !== "Desconocido") {
                        mostrarTarjetaBienvenida(resultado.datos);
                        dibujarCuadroDeteccion(ctx, rostro, true);
                    } else {
                        mostrarTarjetaDenegada();
                        dibujarCuadroDeteccion(ctx, rostro, false);
                    }
                    
                    setTimeout(() => { deteccionEnProceso = false; }, 4000);
                } else {
                    deteccionEnProceso = false;
                    ocultarTarjetas();
                }
            }, 100);
        };
        
        setTimeout(agregarBotonAdmin, 2000);
        
    } catch (err) {
        updateStatus("Error: " + err.message, "fa-exclamation-triangle");
        console.error("Error:", err);
    }
}

function dibujarCuadroDeteccion(ctx, rostro, esAutorizado) {
    ctx.strokeStyle = esAutorizado ? "#2ecc71" : "#e74c3c";
    ctx.lineWidth = 4;
    ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                 rostro.detection.box.width, rostro.detection.box.height);
    ctx.font = "bold 16px 'Inter'";
    ctx.fillStyle = esAutorizado ? "#2ecc71" : "#e74c3c";
    ctx.fillText(esAutorizado ? "✓ AUTORIZADO" : "✗ DENEGADO", 
                rostro.detection.box.x, rostro.detection.box.y - 8);
}

function mostrarTarjetaBienvenida(usuario) {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    
    registrarAccesoEnArchivoSeparado(usuario);
    
    deniedCard.style.display = 'none';
    welcomeName.textContent = usuario.name;
    userRut.textContent = usuario.rut;
    userRole.textContent = usuario.role;
    document.querySelector('#welcome-company span').textContent = usuario.empresa;
    welcomeCard.style.display = 'block';
    
    timeoutOcultarCard = setTimeout(() => ocultarTarjetas(), 4000);
}

function mostrarTarjetaDenegada() {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'block';
    timeoutOcultarCard = setTimeout(() => ocultarTarjetas(), 3000);
}

function ocultarTarjetas() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'none';
}

function updateStatus(texto, icono) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL_USUARIOS);
        const data = await response.json();
        
        usuariosRegistrados = data.map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        console.log("✅ Usuarios cargados:", usuariosRegistrados.length);
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) {
        return { label: "Desconocido", datos: null };
    }

    const labeledDescriptors = usuariosRegistrados.map(u => 
        new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])
    );
    
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    if (bestMatch.label !== "unknown") {
        const usuarioEncontrado = usuariosRegistrados.find(u => u.name === bestMatch.label);
        return { label: bestMatch.label, datos: usuarioEncontrado };
    }
    return { label: "Desconocido", datos: null };
}

async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    
    if (!rut || !name || !role || !empresa) {
        alert("Completa todos los campos");
        return;
    }

    updateStatus("Capturando rostro...", "fa-camera");
    
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        const payload = {
            operacion: "crear",
            id: Date.now().toString(),
            rut: rut,
            name: name.toUpperCase(),
            role: role,
            empresa: empresa.toUpperCase(),
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        await fetch(SCRIPT_URL_USUARIOS, { 
            method: 'POST', 
            mode: 'no-cors',
            body: JSON.stringify(payload) 
        });
        
        alert("✅ Registro exitoso");
        location.reload();
    } else {
        alert("❌ No se detectó ningún rostro");
    }
}

// Iniciar
iniciarSistema();
