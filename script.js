// TU URL DE GOOGLE APPS SCRIPT (REEMPLAZA CON TU URL)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

// Elementos de paneles
const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');
const actionText = document.getElementById('action-text');
const timestampText = document.getElementById('timestamp-text');
const deniedPanel = document.getElementById('denied-panel');
const historyList = document.getElementById('history-list');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let ultimoRegistro = new Map();
let historialLocal = [];
let audioContext = null;
let sonidosInicializados = false;
let procesando = false;

// ========== INICIALIZAR SONIDOS ==========
function inicializarSonidos() {
    if (sonidosInicializados) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sonidosInicializados = true;
        console.log("✅ Sistema de sonidos inicializado");
    } catch(e) {
        console.log("Error inicializando audio:", e);
    }
}

// Sonido de ÉXITO
function reproducirExito() {
    if (!sonidosInicializados || !audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.4);
        oscillator.stop(audioContext.currentTime + 0.4);
    } catch(e) {
        console.log("Error:", e);
    }
}

// Sonido de FALLO
function reproducirFallo() {
    if (!sonidosInicializados || !audioContext) return;
    
    try {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 220;
        gainNode.gain.value = 0.4;
        
        oscillator.start();
        oscillator.frequency.exponentialRampToValue(150, audioContext.currentTime + 0.5);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.6);
        
        oscillator.stop(audioContext.currentTime + 0.6);
    } catch(e) {
        console.log("Error:", e);
    }
}

// ========== FUNCIONES DE GOOGLE SHEETS ==========

// Guardar registro de acceso en Google Sheets
async function guardarRegistroAcceso(nombre, tipo, mensaje) {
    try {
        const ahora = new Date();
        const horaStr = ahora.toLocaleTimeString('es-ES');
        const fechaStr = ahora.toLocaleDateString('es-ES');
        
        const payload = {
            action: 'registrarAcceso',
            nombre: nombre,
            tipo: tipo,
            mensaje: mensaje,
            hora: horaStr,
            fecha: fechaStr,
            timestamp: ahora.toISOString()
        };
        
        // Usar POST con modo cors para mejor compatibilidad
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log("✅ Registro guardado en Google Sheets");
        } else {
            console.log("⚠️ No se pudo guardar en Google Sheets");
        }
    } catch(e) {
        console.log("Error guardando registro:", e);
    }
}

// Cargar usuarios desde Google Sheets
async function cargarUsuariosDesdeExcel() {
    try {
        statusDiv.innerText = "📡 Cargando usuarios desde Google Sheets...";
        
        const response = await fetch(`${SCRIPT_URL}?action=getUsuarios`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.usuarios) {
            usuariosRegistrados = data.usuarios.map(user => ({
                name: user.name,
                role: user.role || "Usuario",
                descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
            }));
            console.log(`✅ ${usuariosRegistrados.length} usuarios cargados desde Google Sheets`);
            statusDiv.innerText = `✅ ${usuariosRegistrados.length} usuarios registrados`;
        } else {
            console.warn("⚠️ No hay usuarios en la base de datos");
            usuariosRegistrados = [];
            statusDiv.innerText = "⚠️ Sin usuarios registrados";
        }
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
        statusDiv.innerText = "⚠️ Error al cargar usuarios";
    }
}

// Registrar nuevo usuario en Google Sheets
async function enviarANube() {
    inicializarSonidos();
    
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    
    if (!name || !role) {
        alert("❌ Completa todos los datos");
        return;
    }
    
    statusDiv.innerText = "📸 Capturando rostro...";
    
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    if (!detection) {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar frente a la cámara.");
        statusDiv.innerText = "❌ No se detectó rostro";
        return;
    }
    
    statusDiv.innerText = "💾 Guardando en Google Sheets...";
    
    const payload = {
        action: 'registrarUsuario',
        id: Date.now().toString(),
        name: name,
        role: role,
        faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
    };
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                alert(`✅ ¡Usuario ${name} registrado exitosamente en Google Sheets!`);
                location.reload();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (e) {
        console.error("Error al registrar:", e);
        alert("❌ Error al conectar con Google Sheets. Verifica la URL.");
        statusDiv.innerText = "❌ Error de conexión";
    }
}

// ========== CONTROL DE ACCESO ==========

function agregarAlHistorial(nombre, tipo, mensaje) {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString('es-ES');
    
    const registro = {
        id: Date.now(),
        nombre: nombre,
        tipo: tipo,
        mensaje: mensaje,
        hora: horaStr,
        timestamp: ahora
    };
    
    historialLocal.unshift(registro);
    if (historialLocal.length > 50) historialLocal.pop();
    actualizarHistorialUI();
    
    // Guardar en Google Sheets
    guardarRegistroAcceso(nombre, tipo, mensaje);
}

function actualizarHistorialUI() {
    if (historialLocal.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; color: #666;">Esperando actividad...</div>';
        return;
    }
    
    historyList.innerHTML = historialLocal.map(reg => {
        const clase = reg.tipo === 'entry' ? 'history-in' : 'history-denied';
        const icono = reg.tipo === 'entry' ? '✅' : '⛔';
        return `
            <div class="history-item ${clase}">
                <strong>${icono} ${reg.hora}</strong> - ${reg.nombre}<br>
                <small>${reg.mensaje}</small>
            </div>
        `;
    }).join('');
}

async function procesarAccesoPermitido(nombre) {
    const ahora = Date.now();
    const ultimoAcceso = ultimoRegistro.get(nombre);
    
    if (ultimoAcceso && (ahora - ultimoAcceso) < 4000) {
        console.log(`Pausa de 4 segundos para ${nombre}`);
        return;
    }
    
    ultimoRegistro.set(nombre, ahora);
    
    welcomeMessage.innerHTML = `${nombre}`;
    actionText.innerHTML = '✅ ENTRADA REGISTRADA ✅';
    actionText.style.color = '#2ecc71';
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    deniedPanel.style.display = 'none';
    timestampText.innerHTML = `🕐 ${new Date().toLocaleTimeString()}`;
    
    agregarAlHistorial(nombre, 'entry', 'Entrada registrada correctamente');
    reproducirExito();
    
    setTimeout(() => {
        if (welcomePanel.style.display === 'block') {
            welcomePanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 3000);
}

function procesarAccesoDenegado() {
    const ahora = Date.now();
    const ultimoDenegado = ultimoRegistro.get('_denied_');
    
    if (ultimoDenegado && (ahora - ultimoDenegado) < 4000) {
        return;
    }
    ultimoRegistro.set('_denied_', ahora);
    
    deniedPanel.style.display = 'block';
    welcomePanel.style.display = 'none';
    statusDiv.style.display = 'none';
    
    agregarAlHistorial('❌ PERSONA NO REGISTRADA', 'denied', 'ACCESO DENEGADO - Rostro no registrado');
    reproducirFallo();
    
    setTimeout(() => {
        if (deniedPanel.style.display === 'block') {
            deniedPanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 3000);
}

// ========== INICIALIZACIÓN ==========
async function iniciarSistema() {
    try {
        statusDiv.innerText = "🔄 Cargando modelos faciales...";
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "✅ SISTEMA ACTIVO";
            statusDiv.style.color = "#3498db";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            
            setInterval(async () => {
                if (procesando) return;
                procesando = true;
                
                try {
                    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    const resized = faceapi.resizeResults(detections, displaySize);
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    let accesoPermitido = false;
                    let hayRostros = false;
                    
                    for (const detection of resized) {
                        hayRostros = true;
                        const bestMatch = buscarCoincidencia(detection.descriptor);
                        
                        if (bestMatch.label !== "Desconocido") {
                            accesoPermitido = true;
                            await procesarAccesoPermitido(bestMatch.label);
                            
                            ctx.strokeStyle = "#2ecc71";
                            ctx.lineWidth = 5;
                            ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                         detection.detection.box.width, detection.detection.box.height);
                            break;
                        } else {
                            ctx.strokeStyle = "#e74c3c";
                            ctx.lineWidth = 4;
                            ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                         detection.detection.box.width, detection.detection.box.height);
                        }
                    }
                    
                    if (hayRostros && !accesoPermitido) {
                        procesarAccesoDenegado();
                    }
                    
                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    procesando = false;
                }
            }, 500);
        };
    } catch (err) {
        statusDiv.innerText = "❌ Error: " + err.message;
        statusDiv.style.color = "red";
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0 || cargandoUsuarios) {
        return { label: "Desconocido" };
    }
    
    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.55
    );
    
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    return { label: bestMatch.label };
}

// Eventos
document.body.addEventListener('click', function activarSonidos() {
    inicializarSonidos();
}, { once: true });

iniciarSistema();
