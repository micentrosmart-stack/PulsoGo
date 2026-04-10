// ===== LAS DOS URLS DE GOOGLE APPS SCRIPT =====
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
let usuarioAEliminar = null;
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
        updateStatus("Cargando modelos faciales...", "fa-spinner fa-pulse");
        
        await faceapi.nets.tinyFaceDetector.loadFromUri('.');
        await faceapi.nets.faceLandmark68Net.loadFromUri('.');
        await faceapi.nets.faceRecognitionNet.loadFromUri('.');
        
        updateStatus("Cargando base de datos...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        
        console.log("✅ Sistema listo");
        console.log("📋 Usuarios:", usuariosRegistrados.length);

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
                    const descriptor = rostro.descriptor;
                    const resultado = buscarCoincidencia(descriptor);
                    
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        personaAutorizada = true;
                        datosPersona = resultado.datos;
                        ultimaDeteccion = { tipo: 'autorizado', datos: datosPersona, rostro: rostro };
                        console.log("✅ AUTORIZADO:", resultado.label);
                    } else {
                        ultimaDeteccion = { tipo: 'denegado', rostro: rostro };
                        console.log("🔴 ACCESO DENEGADO");
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
        console.error("Error:", err);
    }
}

function dibujarCuadroDeteccion(ctx, rostro, esAutorizado) {
    if (esAutorizado) {
        ctx.strokeStyle = "#2ecc71";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, rostro.detection.box.width, rostro.detection.box.height);
        ctx.font = "bold 16px 'Inter', sans-serif";
        ctx.fillStyle = "#2ecc71";
        ctx.fillText("✓ AUTORIZADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    } else {
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 4;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, rostro.detection.box.width, rostro.detection.box.height);
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
    if (statusEl) {
        statusEl.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL_USUARIOS);
        const data = await response.json();
        
        console.log("📥 Usuarios cargados:", data.length);
        
        usuariosRegistrados = data.filter(user => user.name && user.name !== "").map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        usuariosFiltrados = [...usuariosRegistrados];
        mostrarListaUsuarios();
        
        console.log("✅ Usuarios:", usuariosRegistrados.length);
    } catch (e) {
        console.error("❌ Error:", e);
        usuariosRegistrados = [];
        usuariosFiltrados = [];
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
        return { label: bestMatch.label, datos: usuarioEncontrado };
    } else {
        return { label: "Desconocido", datos: null };
    }
}

async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    
    if (!rut || !name || !role || !empresa) {
        alert("❌ Completa TODOS los campos");
        return;
    }
    
    const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;
    if (!rutRegex.test(rut)) {
        alert("⚠️ Formato de RUT inválido. Ej: 12.345.678-9");
        return;
    }

    updateStatus("Capturando rostro...", "fa-camera");
    
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        const payload = {
            id: Date.now().toString(),
            rut: rut,
            name: name.toUpperCase(),
            role: role,
            empresa: empresa.toUpperCase(),
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        fetch(SCRIPT_URL_USUARIOS, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ ¡REGISTRO EXITOSO!\n\n👤 ${name}\n🆔 ${rut}\n💼 ${role}\n🏢 ${empresa}`);
            location.reload(); 
        })
        .catch(err => {
            console.error("Error:", err);
            alert("❌ Error al registrar");
        });
    } else {
        alert("❌ No se detectó ningún rostro");
        updateStatus("No se detectó rostro", "fa-face-frown");
    }
}

// ===== ELIMINAR USUARIOS =====
function mostrarListaUsuarios() {
    const container = document.getElementById('userList');
    if (!container) return;
    
    if (usuariosFiltrados.length === 0) {
        container.innerHTML = '<div class="empty-message"><i class="fas fa-user-slash"></i> No se encontraron usuarios</div>';
        document.getElementById('btnEliminar').disabled = true;
        return;
    }
    
    let html = '';
    usuariosFiltrados.forEach(user => {
        const isSelected = usuarioAEliminar && usuarioAEliminar.id === user.id;
        html += `
            <div class="user-item ${isSelected ? 'selected' : ''}" onclick="seleccionarUsuario('${user.id}')">
                <div>
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
    container.innerHTML = html;
}

function filtrarUsuarios() {
    const term = document.getElementById('searchUser').value.toLowerCase();
    if (!term) {
        usuariosFiltrados = [...usuariosRegistrados];
    } else {
        usuariosFiltrados = usuariosRegistrados.filter(u => 
            u.name.toLowerCase().includes(term) || 
            u.rut.toLowerCase().includes(term) || 
            u.empresa.toLowerCase().includes(term)
        );
    }
    mostrarListaUsuarios();
}

function seleccionarUsuario(userId) {
    usuarioAEliminar = usuariosRegistrados.find(u => u.id === userId);
    document.getElementById('btnEliminar').disabled = false;
    mostrarListaUsuarios();
}

function abrirModalEliminar(userId) {
    const user = usuariosRegistrados.find(u => u.id === userId);
    if (user) {
        usuarioAEliminar = user;
        document.getElementById('confirmMessage').innerHTML = `¿Eliminar a <strong>${user.name}</strong><br>RUT: ${user.rut}?<br><br><span style="color: #e74c3c;">⚠️ Esta acción no se puede deshacer</span>`;
        document.getElementById('confirmModal').style.display = 'flex';
    }
}

function abrirModalEliminarSeleccionado() {
    if (usuarioAEliminar) {
        abrirModalEliminar(usuarioAEliminar.id);
    } else {
        alert("❌ Selecciona un usuario para eliminar");
    }
}

function cerrarModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Confirmar eliminación
document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (!usuarioAEliminar) return;
    
    updateStatus("Eliminando...", "fa-spinner fa-pulse");
    
    try {
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                accion: 'delete', 
                id: usuarioAEliminar.id, 
                rut: usuarioAEliminar.rut 
            })
        });
        
        alert(`✅ Usuario ${usuarioAEliminar.name} eliminado`);
        cerrarModal();
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Error, recargando...");
        location.reload();
    }
};

iniciarSistema();
