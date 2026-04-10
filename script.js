// ===== LAS DOS URLS DE GOOGLE APPS SCRIPT =====
const SCRIPT_URL_USUARIOS = "https://script.google.com/macros/s/AKfycbwRDhofBv-AyXF9AgzekgPeII37Fw-6JmKSfYR6U-3-5eInkL-sdXS7wthzBbbASUFYeA/exec";
const SCRIPT_URL_REGISTRO = "https://script.google.com/macros/s/AKfycbw6WM72PGsbbRacwHNv7VLiOe4r8DcXZ0Vjrvbcgh9etbzbtvCXCMdaYTI9eX4KS62LdQ/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

const welcomeCard = document.getElementById('welcome-card');
const deniedCard = document.getElementById('denied-card');
const welcomeName = document.getElementById('welcome-name');
const welcomeCompany = document.getElementById('welcome-company');
const userRut = document.getElementById('user-rut');
const userRole = document.getElementById('user-role');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let deteccionEnProceso = false;
let ultimoUsuarioMostrado = null;
let ultimoRegistroAcceso = {};
let modoRegistro = false;

// Registrar acceso
async function registrarAccesoEnArchivoSeparado(usuario) {
    try {
        const ahora = Date.now();
        if (ultimoRegistroAcceso[usuario.id] && ahora - ultimoRegistroAcceso[usuario.id] < 10000) {
            console.log("⏭️ Acceso ya registrado recientemente para:", usuario.name);
            return;
        }
        
        ultimoRegistroAcceso[usuario.id] = ahora;
        
        const payload = {
            id: usuario.id,
            rut: usuario.rut,
            name: usuario.name,
            role: usuario.role,
            empresa: usuario.empresa,
            instalacion: usuario.instalacion,
            fecha: new Date().toISOString()
        };
        
        console.log("📝 Registrando acceso:", usuario.name, "-", usuario.instalacion);
        
        await fetch(SCRIPT_URL_REGISTRO, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
        
        console.log("✅ Acceso registrado");
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

async function iniciarSistema() {
    try {
        updateStatus("Cargando modelos faciales...", "fa-spinner fa-pulse");
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        updateStatus("Cargando base de datos...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        console.log("✅ Sistema listo -", usuariosRegistrados.length, "usuarios");

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            updateStatus("Sistema activo - Esperando usuario", "fa-eye");
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                // Si está en modo registro, no hacer detección
                if (modoRegistro) {
                    return;
                }
                
                if (deteccionEnProceso) return;
                
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
                        console.log("✅ AUTORIZADO:", resultado.label);
                    } else {
                        console.log("🔴 ACCESO DENEGADO");
                    }
                    
                    dibujarCuadroDeteccion(ctx, rostro, personaAutorizada);
                }
                
                // ===== SOLO MOSTRAR TARJETA SI ES UN USUARIO DIFERENTE =====
                if (personaAutorizada && datosPersona) {
                    if (!ultimoUsuarioMostrado || ultimoUsuarioMostrado.id !== datosPersona.id) {
                        mostrarTarjetaBienvenida(datosPersona);
                        ultimoUsuarioMostrado = datosPersona;
                    }
                } else if (rostroEncontrado && !personaAutorizada) {
                    if (!ultimoUsuarioMostrado || ultimoUsuarioMostrado.id !== 'denegado') {
                        mostrarTarjetaDenegada();
                        ultimoUsuarioMostrado = { id: 'denegado' };
                    }
                }
                
                // Liberar el bloqueo después de 3 segundos
                setTimeout(() => {
                    deteccionEnProceso = false;
                }, 3000);
                
                updateStatus("Sistema activo", "fa-eye");
                
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
        ctx.shadowColor = "#2ecc71";
        ctx.shadowBlur = 10;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                     rostro.detection.box.width, rostro.detection.box.height);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#2ecc71";
        ctx.font = "bold 16px 'Inter'";
        ctx.fillText("✓ AUTORIZADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    } else {
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 10;
        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                     rostro.detection.box.width, rostro.detection.box.height);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 16px 'Inter'";
        ctx.fillText("✗ ACCESO DENEGADO", rostro.detection.box.x, rostro.detection.box.y - 8);
    }
}

function mostrarTarjetaBienvenida(usuario) {
    registrarAccesoEnArchivoSeparado(usuario);
    
    deniedCard.style.display = 'none';
    welcomeName.textContent = usuario.name || "Usuario";
    
    const companySpan = welcomeCompany.querySelector('span');
    if (companySpan) {
        companySpan.textContent = usuario.empresa || "No especificada";
    }
    
    userRut.textContent = usuario.rut || "No registrado";
    userRole.textContent = usuario.role || "No especificado";
    
    const userInstalacionEl = document.getElementById('user-instalacion');
    if (userInstalacionEl) {
        userInstalacionEl.textContent = usuario.instalacion || "No especificada";
    }
    
    welcomeCard.style.display = 'block';
    
    console.log("🎉 BIENVENIDO:", usuario.name, "|", usuario.instalacion);
    
    // ===== NO OCULTAR NUNCA - LA TARJETA SE QUEDA VISIBLE =====
}

function mostrarTarjetaDenegada() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'block';
    // ===== NO OCULTAR NUNCA - LA TARJETA SE QUEDA VISIBLE =====
}

// ===== FUNCIÓN PARA CERRAR MANUALMENTE =====
function cerrarTarjetas() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'none';
    ultimoUsuarioMostrado = null;
    console.log("🚫 Tarjetas cerradas manualmente");
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
        
        console.log("📥 Datos recibidos:", data.length, "usuarios");
        
        usuariosRegistrados = data.map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            instalacion: user.instalacion,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        usuariosRegistrados.forEach(u => console.log(`   👤 ${u.name} | 🏭 ${u.instalacion || "N/A"}`));
    } catch (e) {
        console.error("❌ Error:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) return { label: "Desconocido", datos: null };

    const labeledDescriptors = usuariosRegistrados.map(u => 
        new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])
    );
    
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
        const usuarioEncontrado = usuariosRegistrados.find(u => u.name === bestMatch.label);
        return { label: bestMatch.label, datos: usuarioEncontrado };
    }
    return { label: "Desconocido", datos: null };
}

function activarModoRegistro() {
    modoRegistro = true;
    cerrarTarjetas(); // Cerrar tarjetas al entrar en modo registro
    updateStatus("📝 MODO REGISTRO ACTIVO - Puedes ingresar datos", "fa-user-plus");
    console.log("📝 Modo registro activado - Detección pausada");
}

function desactivarModoRegistro() {
    modoRegistro = false;
    updateStatus("Sistema activo", "fa-eye");
    console.log("✅ Modo registro desactivado - Detección reanudada");
}

async function enviarANube() {
    // Activar modo registro para pausar la detección
    activarModoRegistro();
    
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    const instalacion = document.getElementById('personInstalacion')?.value || 'No especificada';
    
    console.log("📝 Datos del formulario:");
    console.log("  RUT:", rut);
    console.log("  Nombre:", name);
    console.log("  Cargo:", role);
    console.log("  Empresa:", empresa);
    console.log("  Instalación:", instalacion);
    
    if (!rut || !name || !role || !empresa) {
        alert("❌ Por favor, completa TODOS los campos:\n- RUT\n- Nombre Completo\n- Cargo\n- Empresa");
        desactivarModoRegistro();
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
            instalacion: instalacion,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        console.log("📤 Enviando payload:", payload);
        
        fetch(SCRIPT_URL_USUARIOS, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ REGISTRO EXITOSO!\n\n👤 ${name}\n🏭 ${instalacion}\n🔄 Recargando...`);
            location.reload();
        })
        .catch(err => {
            console.error("❌ Error:", err);
            alert("❌ Error al registrar: " + err.message);
            desactivarModoRegistro();
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando directamente a la cámara.");
        updateStatus("No se detectó rostro", "fa-face-frown");
        desactivarModoRegistro();
    }
}

// Exponer funciones globalmente
window.cerrarTarjetas = cerrarTarjetas;
window.enviarANube = enviarANube;

iniciarSistema();
