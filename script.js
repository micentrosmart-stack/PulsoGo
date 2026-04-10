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
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ ¡REGISTRO EXITOSO!\n\n👤 ${name}\n🆔 ${rut}\n💼 ${role}\n🏢 ${empresa}\n\n🔄 La página se recargará para actualizar la base de datos.`);
            location.reload(); 
        })
        .catch(err => {
            console.error("Error en registro:", err);
            alert("❌ Error al registrar: " + err.message);
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando directamente a la cámara.");
        updateStatus("No se detectó rostro", "fa-face-frown");
    }
}

// Iniciar el sistema
iniciarSistema();
