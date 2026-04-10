// ===== LAS DOS URLS DE GOOGLE APPS SCRIPT =====
// URL del archivo de USUARIOS (donde están los descriptores faciales)
const SCRIPT_URL_USUARIOS = "https://script.google.com/macros/s/AKfycbwRDhofBv-AyXF9AgzekgPeII37Fw-6JmKSfYR6U-3-5eInkL-sdXS7wthzBbbASUFYeA/exec";

// URL del archivo de REGISTRO DE ACCESOS (archivo independiente)
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
let tiempoEspera = 4000; // 4 segundos de espera
let deteccionEnProceso = false;
let timeoutReactivacion = null;

// ===== FUNCIÓN: Registrar acceso en el ARCHIVO SEPARADO =====
async function registrarAccesoEnArchivoSeparado(usuario) {
    try {
        const payload = {
            id: usuario.id,
            rut: usuario.rut,
            name: usuario.name,
            empresa: usuario.empresa,
            fecha: new Date().toISOString()
        };
        
        console.log("📝 Registrando acceso en archivo SEPARADO:", usuario.name);
        console.log("📤 Datos enviados:", payload);
        
        // Enviar al Apps Script del REGISTRO DE ACCESOS
        await fetch(SCRIPT_URL_REGISTRO, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
        
        console.log("✅ Acceso registrado en archivo independiente");
    } catch (err) {
        console.error("❌ Error registrando acceso:", err);
    }
}

// ===== FUNCIONES PARA ADMINISTRAR USUARIOS (EDITAR Y ELIMINAR) =====

// Editar usuario existente
async function editarUsuario(idUsuario, nuevosDatos) {
    try {
        const payload = {
            operacion: "editar",
            id: idUsuario,
            ...nuevosDatos
        };
        
        console.log("📝 Editando usuario:", payload);
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            alert("✅ Usuario actualizado correctamente");
            await cargarUsuariosDesdeExcel(); // Recargar lista
            return true;
        } else {
            alert("❌ Error: " + resultado.error);
            return false;
        }
    } catch (err) {
        console.error("Error editando usuario:", err);
        alert("❌ Error al editar: " + err.message);
        return false;
    }
}

// Eliminar usuario
async function eliminarUsuario(idUsuario, rutUsuario, nombreUsuario) {
    const confirmar = confirm(`¿Estás seguro de eliminar al usuario "${nombreUsuario}" (${rutUsuario})?`);
    if (!confirmar) return false;
    
    try {
        const payload = {
            operacion: "eliminar",
            id: idUsuario,
            rut: rutUsuario
        };
        
        console.log("🗑️ Eliminando usuario:", payload);
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            alert("✅ Usuario eliminado correctamente");
            await cargarUsuariosDesdeExcel(); // Recargar lista
            // Cerrar el panel admin si está abierto
            const panelAdmin = document.getElementById('panel-admin-modal');
            if (panelAdmin) panelAdmin.remove();
            return true;
        } else {
            alert("❌ Error: " + resultado.error);
            return false;
        }
    } catch (err) {
        console.error("Error eliminando usuario:", err);
        alert("❌ Error al eliminar: " + err.message);
        return false;
    }
}

// Obtener un usuario específico por ID
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

// Generar lista HTML de usuarios para el panel admin
function generarListaUsuariosHTML() {
    if (usuariosRegistrados.length === 0) {
        return '<p style="color: white; text-align: center; padding: 40px;">No hay usuarios registrados</p>';
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    usuariosRegistrados.forEach(usuario => {
        html += `
            <div style="background: #0f1422; border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 12px;">
                    <div style="flex: 1;">
                        <h3 style="color: white; margin-bottom: 8px; font-size: 18px;">
                            <i class="fas fa-user-circle" style="color: #3498db; margin-right: 8px;"></i>
                            ${escapeHtml(usuario.name)}
                        </h3>
                        <p style="color: #8b8faa; font-size: 12px; margin: 4px 0;">
                            <i class="fas fa-id-card"></i> RUT: ${escapeHtml(usuario.rut)}
                        </p>
                        <p style="color: #8b8faa; font-size: 12px; margin: 4px 0;">
                            <i class="fas fa-briefcase"></i> ${escapeHtml(usuario.role)} 
                            <i class="fas fa-building" style="margin-left: 12px;"></i> ${escapeHtml(usuario.empresa)}
                        </p>
                        <p style="color: #6c7293; font-size: 10px; margin: 4px 0;">
                            <i class="fas fa-calendar-alt"></i> Registrado: ${usuario.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString() : 'No disponible'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick='abrirEditorUsuario(${JSON.stringify(usuario).replace(/'/g, "&apos;")})' 
                                style="background: linear-gradient(135deg, #3498db, #2980b9); border: none; padding: 8px 16px; border-radius: 8px; color: white; cursor: pointer; font-size: 13px; transition: transform 0.2s;">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button onclick='eliminarUsuario("${usuario.id}", "${usuario.rut}", "${usuario.name.replace(/"/g, '&quot;')}")' 
                                style="background: linear-gradient(135deg, #e74c3c, #c0392b); border: none; padding: 8px 16px; border-radius: 8px; color: white; cursor: pointer; font-size: 13px; transition: transform 0.2s;">
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

// Función para escapar HTML y prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mostrar panel de administración
function mostrarPanelAdmin() {
    // Eliminar panel existente si lo hay
    const existingPanel = document.getElementById('panel-admin-modal');
    if (existingPanel) existingPanel.remove();
    
    // Crear modal
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
        <div style="background: linear-gradient(135deg, #1a1f2e 0%, #0f1422 100%); border-radius: 24px; max-width: 800px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 24px; border: 1px solid rgba(52,152,219,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
                <h2 style="color: white; font-size: 24px;">
                    <i class="fas fa-users-cog" style="color: #3498db;"></i> Administrar Usuarios
                </h2>
                <button onclick="document.getElementById('panel-admin-modal').remove()" 
                        style="background: rgba(255,255,255,0.1); border: none; color: white; font-size: 24px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: all 0.2s;">
                    &times;
                </button>
            </div>
            <div id="lista-usuarios-admin" style="margin-bottom: 20px;">
                ${generarListaUsuariosHTML()}
            </div>
            <div style="text-align: center; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button onclick="refrescarListaAdmin()" 
                        style="background: linear-gradient(135deg, #2ecc71, #27ae60); border: none; padding: 10px 24px; border-radius: 40px; color: white; cursor: pointer;">
                    <i class="fas fa-sync-alt"></i> Refrescar Lista
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Refrescar lista de usuarios en el panel admin
async function refrescarListaAdmin() {
    const listaDiv = document.getElementById('lista-usuarios-admin');
    if (listaDiv) {
        listaDiv.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-pulse"></i> Cargando...</div>';
        await cargarUsuariosDesdeExcel();
        listaDiv.innerHTML = generarListaUsuariosHTML();
    }
}

// Abrir editor de usuario
function abrirEditorUsuario(usuario) {
    // Eliminar editor existente
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
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1f2e 0%, #0f1422 100%); border-radius: 24px; max-width: 500px; width: 100%; padding: 28px; border: 1px solid rgba(52,152,219,0.3);">
            <h3 style="color: white; margin-bottom: 24px; font-size: 22px;">
                <i class="fas fa-user-edit" style="color: #3498db;"></i> Editar Usuario
            </h3>
            <div class="form-group">
                <label style="color: #8b8faa; font-size: 12px; margin-bottom: 5px; display: block;">Nombre Completo</label>
                <input type="text" id="edit-nombre" value="${escapeHtml(usuario.name)}" placeholder="Nombre Completo" 
                       style="width: 100%; padding: 12px; margin-bottom: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1422; color: white; font-size: 14px;">
            </div>
            <div class="form-group">
                <label style="color: #8b8faa; font-size: 12px; margin-bottom: 5px; display: block;">RUT / DNI</label>
                <input type="text" id="edit-rut" value="${escapeHtml(usuario.rut)}" placeholder="RUT" 
                       style="width: 100%; padding: 12px; margin-bottom: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1422; color: white; font-size: 14px;">
            </div>
            <div class="form-group">
                <label style="color: #8b8faa; font-size: 12px; margin-bottom: 5px; display: block;">Cargo / Puesto</label>
                <input type="text" id="edit-cargo" value="${escapeHtml(usuario.role)}" placeholder="Cargo" 
                       style="width: 100%; padding: 12px; margin-bottom: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1422; color: white; font-size: 14px;">
            </div>
            <div class="form-group">
                <label style="color: #8b8faa; font-size: 12px; margin-bottom: 5px; display: block;">Empresa</label>
                <input type="text" id="edit-empresa" value="${escapeHtml(usuario.empresa)}" placeholder="Empresa" 
                       style="width: 100%; padding: 12px; margin-bottom: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1422; color: white; font-size: 14px;">
            </div>
            <div style="display: flex; gap: 12px;">
                <button onclick="editarUsuario('${usuario.id}', {
                    name: document.getElementById('edit-nombre').value,
                    rut: document.getElementById('edit-rut').value,
                    role: document.getElementById('edit-cargo').value,
                    empresa: document.getElementById('edit-empresa').value
                }).then(() => {
                    document.getElementById('editor-usuario-modal')?.remove();
                    refrescarListaAdmin();
                })" 
                        style="flex: 1; background: linear-gradient(135deg, #2ecc71, #27ae60); border: none; padding: 12px; border-radius: 12px; color: white; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
                <button onclick="document.getElementById('editor-usuario-modal')?.remove()" 
                        style="flex: 1; background: linear-gradient(135deg, #7f8c8d, #6c7a89); border: none; padding: 12px; border-radius: 12px; color: white; cursor: pointer; font-weight: 600;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Agregar botón de administración
function agregarBotonAdmin() {
    const btnAdmin = document.createElement('button');
    btnAdmin.id = 'btn-admin';
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
    `;
    
    btnAdmin.onmouseover = () => {
        btnAdmin.style.transform = 'translateY(-2px)';
        btnAdmin.style.boxShadow = '0 8px 20px rgba(231, 76, 60, 0.4)';
    };
    btnAdmin.onmouseout = () => {
        btnAdmin.style.transform = 'translateY(0)';
        btnAdmin.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    };
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
        
        updateStatus("Cargando base de datos de usuarios...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        console.log("✅ Sistema listo");
        console.log("📋 Usuarios registrados:", usuariosRegistrados.length);
        console.log("📊 Registro de accesos se guardará en archivo SEPARADO");

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            updateStatus("Sistema activo - Mostrando rostro", "fa-eye");
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const ahora = Date.now();
                
                if (deteccionEnProceso) {
                    if (ultimaDeteccion) {
                        dibujarCuadroDesdeUltimaDeteccion(ultimaDeteccion, displaySize);
                    }
                    return;
                }
                
                deteccionEnProceso = true;
                
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let personaAutorizada = false;
                let datosPersona = null;
                let rostroEncontrado = false;
                
                if (resized.length > 0) {
                    rostroEncontrado = true;
                    const rostro = resized[0];
                    const descriptor = rostro.descriptor;
                    const resultado = buscarCoincidencia(descriptor);
                    
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        personaAutorizada = true;
                        datosPersona = resultado.datos;
                        ultimaDeteccion = { tipo: 'autorizado', datos: datosPersona, rostro: rostro };
                        console.log("✅ AUTORIZADO:", resultado.label);
                    } 
                    else {
                        ultimaDeteccion = { tipo: 'denegado', rostro: rostro };
                        console.log("🔴 ACCESO DENEGADO - Rostro no registrado");
                    }
                    
                    dibujarCuadroDeteccion(ctx, rostro, personaAutorizada);
                } else {
                    ultimaDeteccion = null;
                    ocultarTarjetas();
                }
                
                if (personaAutorizada && datosPersona) {
                    mostrarTarjetaBienvenida(datosPersona);
                } 
                else if (rostroEncontrado && !personaAutorizada) {
                    mostrarTarjetaDenegada();
                }
                
                if (rostroEncontrado) {
                    tiempoUltimaDeteccion = ahora;
                    
                    if (timeoutReactivacion) clearTimeout(timeoutReactivacion);
                    timeoutReactivacion = setTimeout(() => {
                        deteccionEnProceso = false;
                        console.log("🔄 Sistema reactivado - Listo para nueva detección");
                        updateStatus("Sistema activo - Listo para detectar", "fa-eye");
                        
                        if (ultimaDeteccion) {
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                        }
                    }, tiempoEspera);
                    
                    updateStatus(`Acceso procesado - Esperando ${tiempoEspera/1000}s`, "fa-clock");
                } else {
                    deteccionEnProceso = false;
                    if (timeoutReactivacion) clearTimeout(timeoutReactivacion);
                }
                
            }, 100);
        };
        
        // Agregar botón admin después de iniciar
        setTimeout(agregarBotonAdmin, 2000);
        
    } catch (err) {
        updateStatus("Error: " + err.message, "fa-exclamation-triangle");
        console.error("Error:", err);
    }
}

function dibujarCuadroDeteccion(ctx, rostro, esAutorizado) {
    if (esAutorizado) {
        ctx.strokeStyle = "#2ecc71";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                     rostro.detection.box.width, rostro.detection.box.height);
        ctx.font = "bold 16px 'Inter', sans-serif";
        ctx.fillStyle = "#2ecc71";
        ctx.fillText("✓ AUTORIZADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    } else {
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                     rostro.detection.box.width, rostro.detection.box.height);
        ctx.font = "bold 16px 'Inter', sans-serif";
        ctx.fillStyle = "#e74c3c";
        ctx.fillText("✗ ACCESO DENEGADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    }
}

function dibujarCuadroDesdeUltimaDeteccion(ultimaDeteccion, displaySize) {
    if (!ultimaDeteccion || !ultimaDeteccion.rostro) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const esAutorizado = ultimaDeteccion.tipo === 'autorizado';
    dibujarCuadroDeteccion(ctx, ultimaDeteccion.rostro, esAutorizado);
}

// Función con registro en archivo SEPARADO
function mostrarTarjetaBienvenida(usuario) {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    
    // === REGISTRAR EL ACCESO EN EL ARCHIVO SEPARADO ===
    registrarAccesoEnArchivoSeparado(usuario);
    
    deniedCard.style.display = 'none';
    
    welcomeName.textContent = usuario.name || "Usuario";
    
    const companySpan = welcomeCompany.querySelector('span');
    companySpan.textContent = usuario.empresa || "No especificada";
    
    userRut.textContent = usuario.rut || "No registrado";
    userRole.textContent = usuario.role || "No especificado";
    
    welcomeCard.style.display = 'block';
    
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '0.5';
    
    console.log("🎉 ACCESO CONCEDIDO - Usuario:", usuario.name);
    console.log("📊 Registro guardado en ARCHIVO SEPARADO de Google Sheets");
    
    timeoutOcultarCard = setTimeout(() => {
        ocultarTarjetas();
    }, 4000);
}

function mostrarTarjetaDenegada() {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'block';
    
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '0.5';
    
    console.log("🔴 ACCESO DENEGADO - Usuario no registrado");
    
    timeoutOcultarCard = setTimeout(() => {
        ocultarTarjetas();
    }, 3000);
}

function ocultarTarjetas() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'none';
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '1';
}

function updateStatus(texto, icono) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        // Usar la URL de USUARIOS (archivo principal)
        const response = await fetch(SCRIPT_URL_USUARIOS);
        const data = await response.json();
        
        console.log("📥 Datos recibidos del archivo USUARIOS:", data);
        
        // Verificar si hay error
        if (data.error) {
            console.error("Error del servidor:", data.error);
            usuariosRegistrados = [];
            return;
        }
        
        usuariosRegistrados = data.map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        console.log("✅ Usuarios cargados correctamente:", usuariosRegistrados.length);
        if (usuariosRegistrados.length > 0) {
            console.log("📋 Lista de usuarios autorizados:");
            usuariosRegistrados.forEach(u => console.log(`   👤 ${u.name} | 🏢 ${u.empresa} | 🆔 ${u.rut}`));
        } else {
            console.warn("⚠️ No hay usuarios registrados en la base de datos");
        }
    } catch (e) {
        console.error("❌ Error cargando usuarios:", e);
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
    
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
        const usuarioEncontrado = usuariosRegistrados.find(u => u.name === bestMatch.label);
        console.log(`✅ Coincidencia encontrada: ${bestMatch.label} (distancia: ${bestMatch.distance})`);
        return { 
            label: bestMatch.label, 
            datos: usuarioEncontrado 
        };
    } else {
        console.log(`❌ Sin coincidencia - Rostro desconocido (distancia: ${bestMatch.distance})`);
        return { label: "Desconocido", datos: null };
    }
}

async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    
    if (!rut || !name || !role || !empresa) {
        alert("❌ Por favor, completa TODOS los campos:\n- RUT\n- Nombre Completo\n- Cargo\n- Empresa");
        return;
    }
    
    // Validar formato de RUT chileno (opcional)
    const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;
    if (!rutRegex.test(rut)) {
        alert("⚠️ Formato de RUT inválido.\nEjemplo correcto: 12.345.678-9");
        return;
    }

    updateStatus("📸 Capturando rostro...", "fa-camera");
    
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
        
        console.log("📤 Registrando nuevo usuario:", payload);
        
        // Usar la URL de USUARIOS para guardar el nuevo usuario
        fetch(SCRIPT_URL_USUARIOS, { 
            method: 'POST', 
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        })
        .then(response => response.json())
        .then(resultado => {
            if (resultado.success) {
                alert(`✅ ¡REGISTRO EXITOSO!\n\n👤 ${name}\n🆔 ${rut}\n💼 ${role}\n🏢 ${empresa}\n\n🔄 La página se recargará para actualizar la base de datos.`);
                location.reload();
            } else {
                alert("❌ Error al registrar: " + resultado.error);
                updateStatus("Error en registro", "fa-exclamation-triangle");
            }
        })
        .catch(err => {
            console.error("Error en registro:", err);
            alert("❌ Error al registrar: " + err.message);
            updateStatus("Error en registro", "fa-exclamation-triangle");
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando directamente a la cámara.");
        updateStatus("No se detectó rostro", "fa-face-frown");
    }
}

// Agregar estilos CSS para animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    #btn-admin:hover {
        transform: translateY(-2px) !important;
    }
`;
document.head.appendChild(style);

// Iniciar el sistema
iniciarSistema();
