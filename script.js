// TU URL DE GOOGLE APPS SCRIPT
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
let ultimoRegistro = new Map(); // Control de pausa de 4 segundos por persona
let historialLocal = [];
let audioContext = null;
let sonidosInicializados = false;
let procesando = false; // Evita procesamiento múltiple simultáneo

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

// Sonido de ÉXITO (acceso permitido)
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
        console.log("Error reproduciendo éxito:", e);
    }
}

// Sonido de FALLO (acceso denegado)
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
        console.log("Error reproduciendo fallo:", e);
    }
}

// ========== FUNCIONES DE HISTORIAL ==========
function agregarAlHistorial(nombre, tipo, mensaje) {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString('es-ES');
    const fechaStr = ahora.toLocaleDateString('es-ES');
    
    const registro = {
        id: Date.now(),
        nombre: nombre,
        tipo: tipo,
        mensaje: mensaje,
        hora: horaStr,
        fecha: fechaStr,
        timestamp: ahora
    };
    
    historialLocal.unshift(registro);
    if (historialLocal.length > 50) historialLocal.pop();
    actualizarHistorialUI();
    enviarRegistroANube(registro);
}

function actualizarHistorialUI() {
    if (historialLocal.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; color: #666;">Esperando actividad...</div>';
        return;
    }
    
    historyList.innerHTML = historialLocal.map(reg => {
        let clase = '';
        let icono = '';
        if (reg.tipo === 'entry') {
            clase = 'history-in';
            icono = '✅';
        } else {
            clase = 'history-denied';
            icono = '⛔';
        }
        return `
            <div class="history-item ${clase}">
                <strong>${icono} ${reg.hora}</strong> - ${reg.nombre}<br>
                <small>${reg.mensaje}</small>
            </div>
        `;
    }).join('');
}

async function enviarRegistroANube(registro) {
    try {
        const payload = {
            action: 'registrarAcceso',
            nombre: registro.nombre,
            tipo: registro.tipo,
            mensaje: registro.mensaje,
            hora: registro.hora,
            fecha: registro.fecha,
            timestamp: registro.timestamp.toISOString()
        };
        
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
    } catch(e) {
        console.log("Error guardando historial:", e);
    }
}

// ========== CONTROL DE ACCESO - SOLO ENTRADA ==========

// ✅ FUNCIÓN PARA ACCESO PERMITIDO (SOLO REGISTRADOS - SOLO ENTRADA)
async function procesarAccesoPermitido(nombre) {
    // Verificar pausa de 4 segundos para esta persona específica
    const ahora = Date.now();
    const ultimoAcceso = ultimoRegistro.get(nombre);
    
    if (ultimoAcceso && (ahora - ultimoAcceso) < 4000) {
        console.log(`Pausa de 4 segundos para ${nombre}. Próximo acceso en ${4000 - (ahora - ultimoAcceso)}ms`);
        return; // No registrar si pasaron menos de 4 segundos
    }
    
    // Marcar como registrado
    ultimoRegistro.set(nombre, ahora);
    
    // Mostrar panel VERDE solo para AUTORIZADOS
    welcomeMessage.innerHTML = `${nombre}`;
    actionText.innerHTML = '✅ ENTRADA REGISTRADA ✅';
    actionText.style.color = '#2ecc71';
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    deniedPanel.style.display = 'none';
    timestampText.innerHTML = `🕐 ${new Date().toLocaleTimeString()}`;
    
    // Agregar al historial
    agregarAlHistorial(nombre, 'entry', 'Entrada registrada correctamente');
    reproducirExito(); // 🔊 Sonido de éxito
    
    // Ocultar panel después de 3 segundos
    setTimeout(() => {
        if (welcomePanel.style.display === 'block') {
            welcomePanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 3000);
}

// ❌ FUNCIÓN PARA ACCESO DENEGADO (NO REGISTRADOS)
function procesarAccesoDenegado() {
    // Verificar pausa global para denegados (evitar spam)
    const ahora = Date.now();
    const ultimoDenegado = ultimoRegistro.get('_denied_');
    
    if (ultimoDenegado && (ahora - ultimoDenegado) < 4000) {
        return; // No mostrar denegado si pasaron menos de 4 segundos
    }
    ultimoRegistro.set('_denied_', ahora);
    
    // Mostrar panel ROJO para NO AUTORIZADOS
    deniedPanel.style.display = 'block';
    welcomePanel.style.display = 'none';
    statusDiv.style.display = 'none';
    
    agregarAlHistorial('❌ PERSONA NO REGISTRADA', 'denied', 'ACCESO DENEGADO - Rostro no registrado en la base de datos');
    reproducirFallo(); // 🔊 Sonido de fallo
    
    // Ocultar panel después de 3 segundos
    setTimeout(() => {
        if (deniedPanel.style.display === 'block') {
            deniedPanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 3000);
}

// ========== INICIALIZACIÓN DEL SISTEMA ==========
async function iniciarSistema() {
    try {
        statusDiv.innerText = "🔄 Cargando cerebro facial...";
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        statusDiv.innerText = "📡 Sincronizando con base de datos...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        await cargarHistorialDesdeNube();
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "✅ SISTEMA ACTIVO - Esperando rostro";
            statusDiv.style.color = "#3498db";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            
            setInterval(async () => {
                // Evitar procesamiento múltiple simultáneo
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
                            // ✅ PERSONA REGISTRADA - Acceso permitido (solo entrada)
                            accesoPermitido = true;
                            await procesarAccesoPermitido(bestMatch.label);
                            
                            // Dibujar cuadro VERDE
                            ctx.strokeStyle = "#2ecc71";
                            ctx.lineWidth = 5;
                            ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                         detection.detection.box.width, detection.detection.box.height);
                            break; // Solo procesar el primer rostro reconocido
                        } else {
                            // ❌ PERSONA NO REGISTRADA - Dibujar cuadro ROJO
                            ctx.strokeStyle = "#e74c3c";
                            ctx.lineWidth = 4;
                            ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                         detection.detection.box.width, detection.detection.box.height);
                        }
                    }
                    
                    // Si hay rostros pero NINGUNO fue registrado → ACCESO DENEGADO
                    if (hayRostros && !accesoPermitido) {
                        procesarAccesoDenegado();
                    }
                    
                } catch (error) {
                    console.error("Error en detección:", error);
                } finally {
                    procesando = false;
                }
                
            }, 500); // Revisar cada 500ms para mejor rendimiento
        };
    } catch (err) {
        statusDiv.innerText = "❌ Error: " + err.message;
        statusDiv.style.color = "red";
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            role: user.role || "Usuario",
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("✅ Usuarios registrados cargados:", usuariosRegistrados.length);
        if (usuariosRegistrados.length === 0) {
            console.warn("⚠️ No hay usuarios registrados en la base de datos");
        }
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

async function cargarHistorialDesdeNube() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getHistorial`);
        const data = await response.json();
        if (data.historial) {
            historialLocal = data.historial;
            actualizarHistorialUI();
        }
    } catch(e) {
        console.log("No se pudo cargar historial previo");
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

// ========== REGISTRO DE NUEVOS USUARIOS ==========
async function enviarANube() {
    // Inicializar sonidos al primer clic
    inicializarSonidos();
    
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    if (!name || !role) return alert("❌ Completa todos los datos");
    
    statusDiv.innerText = "📸 Capturando rostro...";
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    if (detection) {
        const payload = {
            action: 'registrarUsuario',
            id: Date.now().toString(),
            name: name,
            role: role,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        }).then(() => {
            alert(`✅ ¡Usuario ${name} registrado exitosamente!`);
            location.reload();
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar frente a la cámara.");
    }
}

// Inicializar sonidos cuando el usuario haga clic
document.body.addEventListener('click', function activarSonidos() {
    inicializarSonidos();
}, { once: true });

// Iniciar el sistema
iniciarSistema();
