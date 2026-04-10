// ===== URLS DE GOOGLE APPS SCRIPT =====
const SCRIPT_URL_USUARIOS = "https://script.google.com/macros/s/AKfycbwRDhofBv-AyXF9AgzekgPeII37Fw-6JmKSfYR6U-3-5eInkL-sdXS7wthzBbbASUFYeA/exec";
const SCRIPT_URL_REGISTRO = "https://script.google.com/macros/s/AKfycbw6WM72PGsbbRacwHNv7VLiOe4r8DcXZ0Vjrvbcgh9etbzbtvCXCMdaYTI9eX4KS62LdQ/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');

const welcomeCard = document.getElementById('welcome-card');
const deniedCard = document.getElementById('denied-card');
const welcomeName = document.getElementById('welcome-name');
const welcomeCompany = document.getElementById('welcome-company');
const userRut = document.getElementById('user-rut');
const userRole = document.getElementById('user-role');

let usuariosRegistrados = [];
let usuariosFiltrados = [];
let usuarioSeleccionadoParaEliminar = null;
let timeoutOcultarCard = null;
let ultimaDeteccion = null;
let tiempoEspera = 4000;
let deteccionEnProceso = false;
let timeoutReactivacion = null;

// ===== REGISTRAR ACCESO =====
async function registrarAccesoEnArchivoSeparado(usuario) {
    try {
        const payload = {
            id: usuario.id,
            rut: usuario.rut,
            name: usuario.name,
            empresa: usuario.empresa,
            fecha: new Date().toISOString()
        };
        await fetch(SCRIPT_URL_REGISTRO, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        console.log("✅ Acceso registrado:", usuario.name);
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

// ===== INICIAR SISTEMA =====
async function iniciarSistema() {
    try {
        updateStatus("Cargando modelos...", "fa-spinner fa-pulse");
        await faceapi.nets.tinyFaceDetector.loadFromUri('.');
        await faceapi.nets.faceLandmark68Net.loadFromUri('.');
        await faceapi.nets.faceRecognitionNet.loadFromUri('.');
        
        updateStatus("Cargando usuarios...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            updateStatus("Sistema activo", "fa-eye");
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            
            setInterval(async () => {
                if (deteccionEnProceso) {
                    if (ultimaDeteccion) dibujarCuadroDesdeUltimaDeteccion(ultimaDeteccion, displaySize);
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
                    const resultado = buscarCoincidencia(rostro.descriptor);
                    
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        personaAutorizada = true;
                        datosPersona = resultado.datos;
                        ultimaDeteccion = { tipo: 'autorizado', datos: datosPersona, rostro: rostro };
                    } else {
                        ultimaDeteccion = { tipo: 'denegado', rostro: rostro };
                    }
                    dibujarCuadroDeteccion(ctx, rostro, personaAutorizada);
                } else {
                    ultimaDeteccion = null;
                    ocultarTarjetas();
                }
                
                if (personaAutorizada && datosPersona) {
                    mostrarTarjetaBienvenida(datosPersona);
                } else if (rostroEncontrado && !personaAutorizada) {
                    mostrarTarjetaDenegada();
                }
                
                if (rostroEncontrado) {
                    if (timeoutReactivacion) clearTimeout(timeoutReactivacion);
                    timeoutReactivacion = setTimeout(() => {
                        deteccionEnProceso = false;
                        updateStatus("Sistema activo", "fa-eye");
                        if (ultimaDeteccion) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                        }
                    }, tiempoEspera);
                    updateStatus(`Esperando ${tiempoEspera/1000}s`, "fa-clock");
                } else {
                    deteccionEnProceso = false;
                    if (timeoutReactivacion) clearTimeout(timeoutReactivacion);
                }
            }, 100);
        };
    } catch (err) {
        updateStatus("Error: " + err.message, "fa-exclamation-triangle");
        console.error(err);
    }
}

function dibujarCuadroDeteccion(ctx, rostro, esAutorizado) {
    if (esAutorizado) {
        ctx.strokeStyle = "#2ecc71";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, rostro.detection.box.width, rostro.detection.box.height);
        ctx.fillStyle = "#2ecc71";
        ctx.font = "bold 16px 'Inter'";
        ctx.fillText("✓ AUTORIZADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    } else {
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, rostro.detection.box.width, rostro.detection.box.height);
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 16px 'Inter'";
        ctx.fillText("✗ ACCESO DENEGADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    }
}

function dibujarCuadroDesdeUltimaDeteccion(ultimaDeteccion, displaySize) {
    if (!ultimaDeteccion || !ultimaDeteccion.rostro) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dibujarCuadroDeteccion(ctx, ultimaDeteccion.rostro, ultimaDeteccion.tipo === 'autorizado');
}

function mostrarTarjetaBienvenida(usuario) {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    registrarAccesoEnArchivoSeparado(usuario);
    deniedCard.style.display = 'none';
    welcomeName.textContent = usuario.name || "Usuario";
    const companySpan = welcomeCompany.querySelector('span');
    companySpan.textContent = usuario.empresa || "No especificada";
    userRut.textContent = usuario.rut || "No registrado";
    userRole.textContent = usuario.role || "No especificado";
    welcomeCard.style.display = 'block';
    document.getElementById('status').style.opacity = '0.5';
    timeoutOcultarCard = setTimeout(() => ocultarTarjetas(), 4000);
}

function mostrarTarjetaDenegada() {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'block';
    document.getElementById('status').style.opacity = '0.5';
    timeoutOcultarCard = setTimeout(() => ocultarTarjetas(), 3000);
}

function ocultarTarjetas() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'none';
    document.getElementById('status').style.opacity = '1';
}

function updateStatus(texto, icono) {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL_USUARIOS);
        const data = await response.json();
        usuariosRegistrados = data.filter(user => user.name && user.name !== "").map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("✅ Usuarios cargados:", usuariosRegistrados.length);
        usuariosFiltrados = [...usuariosRegistrados];
        mostrarListaUsuarios();
    } catch (e) {
        console.error("Error:", e);
        usuariosRegistrados = [];
        usuariosFiltrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) return { label: "Desconocido", datos: null };
    const labeledDescriptors = usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor]));
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
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
        alert("❌ Completa todos los campos");
        return;
    }
    
    const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;
    if (!rutRegex.test(rut)) {
        alert("⚠️ Formato de RUT inválido. Ej: 12.345.678-9");
        return;
    }
    
    updateStatus("Capturando rostro...", "fa-camera");
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    
    if (detection) {
        const payload = {
            id: Date.now().toString(),
            rut: rut,
            name: name.toUpperCase(),
            role: role,
            empresa: empresa.toUpperCase(),
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        await fetch(SCRIPT_URL_USUARIOS, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        alert(`✅ Usuario ${name} registrado correctamente`);
        location.reload();
    } else {
        alert("❌ No se detectó ningún rostro");
        updateStatus("No se detectó rostro", "fa-face-frown");
    }
}

// ===== FUNCIONES PARA BUSCAR Y ELIMINAR USUARIOS =====
function filtrarUsuarios() {
    const searchTerm = document.getElementById('searchUser').value.toLowerCase();
    
    if (searchTerm === "") {
        usuariosFiltrados = [...usuariosRegistrados];
    } else {
        usuariosFiltrados = usuariosRegistrados.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            user.rut.toLowerCase().includes(searchTerm) ||
            user.empresa.toLowerCase().includes(searchTerm)
        );
    }
    
    mostrarListaUsuarios();
}

function mostrarListaUsuarios() {
    const userListDiv = document.getElementById('userList');
    
    if (usuariosFiltrados.length === 0) {
        userListDiv.innerHTML = '<div class="empty-message"><i class="fas fa-user-slash"></i> No se encontraron usuarios</div>';
        document.getElementById('btnEliminarSeleccionado').disabled = true;
        return;
    }
    
    let html = '';
    usuariosFiltrados.forEach(user => {
        const isSelected = usuarioSeleccionadoParaEliminar && usuarioSeleccionadoParaEliminar.id === user.id;
        html += `
            <div class="user-item ${isSelected ? 'selected' : ''}" onclick="seleccionarUsuario('${user.id}')">
                <div class="user-item-info">
                    <div class="user-item-name"><i class="fas fa-user"></i> ${user.name}</div>
                    <div class="user-item-rut"><i class="fas fa-id-card"></i> ${user.rut}</div>
                    <div class="user-item-empresa"><i class="fas fa-building"></i> ${user.empresa}</div>
                </div>
                <button class="user-item-delete" onclick="event.stopPropagation(); abrirModalEliminar('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    userListDiv.innerHTML = html;
}

function seleccionarUsuario(userId) {
    const user = usuariosRegistrados.find(u => u.id === userId);
    if (user) {
        usuarioSeleccionadoParaEliminar = user;
        mostrarListaUsuarios();
        document.getElementById('btnEliminarSeleccionado').disabled = false;
    }
}

function abrirModalEliminar(userId) {
    const user = usuariosRegistrados.find(u => u.id === userId);
    if (user) {
        usuarioSeleccionadoParaEliminar = user;
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmMessage').innerHTML = `
            ¿Eliminar a <strong>${user.name}</strong><br>
            RUT: <strong>${user.rut}</strong><br>
            Empresa: <strong>${user.empresa}</strong><br><br>
            <span style="color: #e74c3c;">⚠️ Esta acción no se puede deshacer</span>
        `;
        modal.style.display = 'flex';
    }
}

function eliminarUsuarioSeleccionado() {
    if (usuarioSeleccionadoParaEliminar) {
        abrirModalEliminar(usuarioSeleccionadoParaEliminar.id);
    } else {
        alert("❌ Selecciona un usuario para eliminar");
    }
}

function cerrarModalEliminar() {
    document.getElementById('confirmModal').style.display = 'none';
    usuarioSeleccionadoParaEliminar = null;
}

async function confirmarEliminacionFinal() {
    if (!usuarioSeleccionadoParaEliminar) return;
    
    updateStatus("Eliminando usuario...", "fa-spinner fa-pulse");
    
    try {
        const payload = { 
            accion: 'delete', 
            id: usuarioSeleccionadoParaEliminar.id, 
            rut: usuarioSeleccionadoParaEliminar.rut 
        };
        
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        
        alert(`✅ Usuario ${usuarioSeleccionadoParaEliminar.name} eliminado correctamente`);
        cerrarModalEliminar();
        location.reload();
        
    } catch (error) {
        console.error("Error:", error);
        alert("⚠️ Error al eliminar. Recargando...");
        location.reload();
    }
}

// Iniciar el sistema
iniciarSistema();
