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
let ultimoRegistro = new Map(); // Control de 4 segundos
let historialLocal = [];

// ========== SONIDOS ==========
let audioContext = null;
let sonidosInicializados = false;

function inicializarSonidos() {
    if (sonidosInicializados) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sonidosInicializados = true;
        console.log("✅ Sonidos listos");
    } catch(e) {
        console.log("Error audio:", e);
    }
}

function reproducirExito() {
    if (!sonidosInicializados || !audioContext) return;
    try {
        if (audioContext.state === 'suspended') audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.3;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.4);
        oscillator.stop(audioContext.currentTime + 0.4);
    } catch(e) {}
}

function reproducirFallo() {
    if (!sonidosInicializados || !audioContext) return;
    try {
        if (audioContext.state === 'suspended') audioContext.resume();
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
    } catch(e) {}
}

// ========== GOOGLE SHEETS - IGUAL QUE TU EJEMPLO ORIGINAL ==========
async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            role: user.role || "Usuario",
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("✅ Usuarios cargados:", usuariosRegistrados.length);
        statusDiv.innerText = `✅ ${usuariosRegistrados.length} usuarios registrados`;
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
        statusDiv.innerText = "⚠️ Error al cargar usuarios";
    }
}

// Función de registro - IGUAL QUE TU EJEMPLO ORIGINAL
async function enviarANube() {
    inicializarSonidos();
    
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    if (!name || !role) return alert("❌ Completa los datos");

    statusDiv.innerText = "📸 Capturando rostro...";
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        const payload = {
            id: Date.now().toString(),
            name: name,
            role: role,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };

        // Mismo modo 'no-cors' que funcionaba en tu ejemplo
        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        }).then(() => {
            alert("✅ ¡Registro Exitoso! La página se recargará.");
            location.reload();
        }).catch(err => {
            console.error("Error:", err);
            alert("❌ Error al registrar. Revisa la consola.");
        });
    } else {
        alert("❌ No se detectó ningún rostro.");
        statusDiv.innerText = "❌ No se detectó rostro";
    }
}

// ========== HISTORIAL LOCAL (sin Google Sheets para evitar conflictos) ==========
function agregarAlHistorial(nombre, tipo, mensaje) {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString('es-ES');
    
    const registro = {
        id: Date.now(),
        nombre: nombre,
        tipo: tipo,
        mensaje: mensaje,
        hora: horaStr
    };
    
    historialLocal.unshift(registro);
    if (historialLocal.length > 50) historialLocal.pop();
    actualizarHistorialUI();
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

// ========== CONTROL DE ACCESO ==========
async function procesarAccesoPermitido(nombre) {
    const ahora = Date.now();
    const ultimoAcceso = ultimoRegistro.get(nombre);
    
    // PAUSA DE 4 SEGUNDOS
    if (ultimoAcceso && (ahora - ultimoAcceso) < 4000) {
        console.log(`Pausa 4s para ${nombre}`);
        return;
    }
    
    ultimoRegistro.set(nombre, ahora);
    
    // Mostrar panel VERDE
    welcomeMessage.innerHTML = nombre;
    actionText.innerHTML = '✅ ENTRADA REGISTRADA ✅';
    actionText.style.color = '#2ecc71';
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    deniedPanel.style.display = 'none';
    timestampText.innerHTML = `🕐 ${new Date().toLocaleTimeString()}`;
    
    agregarAlHistorial(nombre, 'entry', 'Entrada registrada');
    reproducirExito();
    
    setTimeout(() => {
        welcomePanel.style.display = 'none';
        statusDiv.style.display = 'block';
    }, 3000);
}

function procesarAccesoDenegado() {
    const ahora = Date.now();
    const ultimoDenegado = ultimoRegistro.get('_denied_');
    
    if (ultimoDenegado && (ahora - ultimoDenegado) < 4000) {
        return;
    }
    ultimoRegistro.set('_denied_', ahora);
    
    // Mostrar panel ROJO
    deniedPanel.style.display = 'block';
    welcomePanel.style.display = 'none';
    statusDiv.style.display = 'none';
    
    agregarAlHistorial('❌ DESCONOCIDO', 'denied', 'ACCESO DENEGADO');
    reproducirFallo();
    
    setTimeout(() => {
        deniedPanel.style.display = 'none';
        statusDiv.style.display = 'block';
    }, 3000);
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

// ========== INICIAR SISTEMA ==========
async function iniciarSistema() {
    try {
        statusDiv.innerText = "🔄 Cargando modelos faciales...";
        
        // Cargar modelos
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        // Cargar base de datos del Excel
        statusDiv.innerText = "📡 Sincronizando con Google Sheets...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;

        // Abrir cámara
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "✅ SISTEMA ACTIVO - Esperando rostro";
            statusDiv.style.color = "#3498db";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
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
                        // ✅ PERSONA REGISTRADA
                        accesoPermitido = true;
                        await procesarAccesoPermitido(bestMatch.label);
                        
                        // Cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        break; // Solo procesar el primer rostro
                    } else {
                        // ❌ PERSONA NO REGISTRADA - Cuadro ROJO
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                    }
                }

                // Si hay rostros pero ninguno fue reconocido → ACCESO DENEGADO
                if (hayRostros && !accesoPermitido) {
                    procesarAccesoDenegado();
                }

            }, 500); // Revisar cada 500ms
        };
    } catch (err) {
        statusDiv.innerText = "❌ Error: " + err.message;
        statusDiv.style.color = "red";
        console.error(err);
    }
}

// Activar sonidos con un clic
document.body.addEventListener('click', function activarSonidos() {
    inicializarSonidos();
}, { once: true });

// Iniciar el sistema
iniciarSistema();
