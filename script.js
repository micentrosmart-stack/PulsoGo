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
let ultimoAcceso = new Map(); // Para evitar registros duplicados (cooldown de 5 segundos)
let historialLocal = [];

// ========== SISTEMA DE SONIDOS ==========
const sonidoExitoso = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZCBiYXNlNjQgLSBCZWVwIGV4aXRvc28=');
const sonidoFallido = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZCBiYXNlNjQgLSBCZWVwIGZhbGxpZG8=');

// Función para generar sonido de éxito (beep agradable)
function reproducirExito() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 880; // Nota La5
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
        console.log("Audio no soportado");
    }
}

// Función para generar sonido de fallo (buzzer grave)
function reproducirFallo() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 220; // Nota A3 (grave)
        gainNode.gain.value = 0.4;
        
        // Sonido tipo "buzzer" con vibrato rápido
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.8);
        
        // Cambiar frecuencia para efecto de "error"
        setTimeout(() => {
            oscillator.frequency.value = 180;
        }, 200);
        
        oscillator.stop(audioCtx.currentTime + 0.8);
    } catch(e) {
        console.log("Audio no soportado");
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
        tipo: tipo, // 'entry', 'exit', 'denied'
        mensaje: mensaje,
        hora: horaStr,
        fecha: fechaStr,
        timestamp: ahora
    };
    
    historialLocal.unshift(registro); // Agregar al inicio
    if (historialLocal.length > 50) historialLocal.pop(); // Mantener últimos 50
    
    actualizarHistorialUI();
    
    // Enviar a Google Sheets (opcional)
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
        } else if (reg.tipo === 'exit') {
            clase = 'history-out';
            icono = '🚪';
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

// ========== CONTROL DE ENTRADA/SALIDA ==========
let estadoUsuarios = new Map(); // Guarda el último estado (entrada/salida) de cada usuario

async function procesarAcceso(nombre, descriptor) {
    const ahora = Date.now();
    const ultimo = ultimoAcceso.get(nombre);
    
    // Cooldown de 3 segundos para evitar múltiples registros
    if (ultimo && (ahora - ultimo) < 3000) {
        return;
    }
    ultimoAcceso.set(nombre, ahora);
    
    // Obtener estado actual del usuario
    let estadoActual = estadoUsuarios.get(nombre) || 'fuera';
    
    let tipoAcceso = '';
    let mensaje = '';
    
    if (estadoActual === 'fuera') {
        // REGISTRO DE ENTRADA
        tipoAcceso = 'entry';
        mensaje = 'Entrada registrada';
        estadoUsuarios.set(nombre, 'dentro');
        actionText.style.color = '#2ecc71';
        actionText.innerHTML = '✅ ENTRADA REGISTRADA ✅';
        timestampText.innerHTML = `🕐 ${new Date().toLocaleTimeString()}`;
    } else {
        // REGISTRO DE SALIDA
        tipoAcceso = 'exit';
        mensaje = 'Salida registrada';
        estadoUsuarios.set(nombre, 'fuera');
        actionText.style.color = '#e74c3c';
        actionText.innerHTML = '🚪 SALIDA REGISTRADA 🚪';
        timestampText.innerHTML = `🕐 ${new Date().toLocaleTimeString()}`;
    }
    
    // Mostrar panel y agregar al historial
    welcomeMessage.innerHTML = `Bienvenido, ${nombre}`;
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    deniedPanel.style.display = 'none';
    
    agregarAlHistorial(nombre, tipoAcceso, mensaje);
    reproducirExito(); // Sonido de éxito
    
    // Ocultar panel después de 3 segundos
    setTimeout(() => {
        if (welcomePanel.style.display === 'block') {
            welcomePanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 3000);
}

function procesarAccesoDenegado() {
    const ahora = Date.now();
    const ultimoDenegado = ultimoAcceso.get('_denied_');
    
    // Cooldown para denegados (2 segundos)
    if (ultimoDenegado && (ahora - ultimoDenegado) < 2000) {
        return;
    }
    ultimoAcceso.set('_denied_', ahora);
    
    deniedPanel.style.display = 'block';
    welcomePanel.style.display = 'none';
    statusDiv.style.display = 'none';
    
    agregarAlHistorial('Desconocido', 'denied', 'Intento de acceso con rostro no registrado');
    reproducirFallo(); // Sonido de fallo
    
    setTimeout(() => {
        if (deniedPanel.style.display === 'block') {
            deniedPanel.style.display = 'none';
            statusDiv.style.display = 'block';
        }
    }, 2000);
}

// ========== INICIALIZACIÓN DEL SISTEMA ==========
async function iniciarSistema() {
    try {
        statusDiv.innerText = "Cargando cerebro facial...";
        
        // Cargar modelos
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        statusDiv.innerText = "Sincronizando con base de datos...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        // Cargar historial previo desde el servidor (opcional)
        await cargarHistorialDesdeNube();
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "Sistema de Control de Acceso Activo";
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
                
                let rostroReconocido = false;
                
                for (const detection of resized) {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    if (bestMatch.label !== "Desconocido") {
                        rostroReconocido = true;
                        await procesarAcceso(bestMatch.label, detection.descriptor);
                        
                        // Dibujar cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        break; // Procesar solo el primer rostro detectado
                    } else {
                        // Dibujar cuadro ROJO para desconocidos
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                    }
                }
                
                if (!rostroReconocido && resized.length > 0) {
                    procesarAccesoDenegado();
                } else if (resized.length === 0) {
                    // No hay rostros, asegurar que los paneles estén ocultos
                    if (welcomePanel.style.display === 'block' || deniedPanel.style.display === 'block') {
                        // No hacer nada, dejar que los timers los oculten
                    }
                }
                
            }, 150);
        };
    } catch (err) {
        statusDiv.innerText = "Error: " + err.message;
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
        console.log("Usuarios cargados:", usuariosRegistrados.length);
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
    if (usuariosRegistrados.length === 0 || cargandoUsuarios) return { label: "Desconocido" };
    
    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.55
    );
    
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    return { label: bestMatch.label };
}

// Función de registro
async function enviarANube() {
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

// Iniciar el sistema
iniciarSistema();
