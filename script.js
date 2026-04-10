// TU URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

// Elementos del panel de bienvenida (autorizado)
const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');

// Elementos del panel de acceso denegado
const deniedPanel = document.getElementById('denied-panel');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let ultimoEstado = null;
let timeoutOcultarPanel = null;
let ultimoRostroDesconocido = false; // Para rastrear rostros desconocidos

async function iniciarSistema() {
    try {
        statusDiv.innerText = "Cargando cerebro facial...";
        
        // Cargar modelos
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        // Cargar base de datos
        statusDiv.innerText = "Sincronizando con base de datos...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;

        // Abrir cámara
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "Sistema de Control de Acceso Activo";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            // Bucle de detección en tiempo real
            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let personaAutorizada = false;
                let personaDesconocida = false;
                let nombreAutorizado = "";

                // Procesar cada rostro detectado
                for (const detection of resized) {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    // Verificar si el rostro está registrado o no
                    if (bestMatch.label !== "Desconocido") {
                        // USUARIO REGISTRADO - AUTORIZADO
                        personaAutorizada = true;
                        nombreAutorizado = bestMatch.label;
                        
                        // Dibujar cuadro VERDE para autorizado
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        
                        // Texto de autorizado
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#2ecc71";
                        ctx.fillText("✓ AUTORIZADO", detection.detection.box.x, detection.detection.box.y - 5);
                    } 
                    else {
                        // USUARIO NO REGISTRADO (UNKNOWN) - ACCESO DENEGADO
                        personaDesconocida = true;
                        
                        // Dibujar cuadro ROJO para acceso denegado
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 6; // Borde más grueso para denegado
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        
                        // Texto de ACCESO DENEGADO en rojo
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#e74c3c";
                        ctx.fillText("✗ ACCESO DENEGADO", detection.detection.box.x, detection.detection.box.y - 5);
                        
                        // Opcional: Dibujar una X roja sobre el rostro (efecto visual más fuerte)
                        ctx.beginPath();
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 4;
                        const centerX = detection.detection.box.x + detection.detection.box.width / 2;
                        const centerY = detection.detection.box.y + detection.detection.box.height / 2;
                        const size = detection.detection.box.width / 3;
                        ctx.moveTo(centerX - size, centerY - size);
                        ctx.lineTo(centerX + size, centerY + size);
                        ctx.moveTo(centerX + size, centerY - size);
                        ctx.lineTo(centerX - size, centerY + size);
                        ctx.stroke();
                    }
                }

                // Manejar la UI según los resultados de detección
                if (personaAutorizada) {
                    // Mostrar panel de BIENVENIDA (verde)
                    if (ultimoEstado !== "autorizado") {
                        mostrarPanelBienvenida(nombreAutorizado);
                        ultimoEstado = "autorizado";
                        ultimoRostroDesconocido = false;
                    }
                } 
                else if (personaDesconocida) {
                    // MOSTRAR ACCESO DENEGADO EN ROJO - PARA UNKNOWN
                    if (ultimoEstado !== "denegado") {
                        mostrarPanelDenegado();
                        ultimoEstado = "denegado";
                        ultimoRostroDesconocido = true;
                        
                        // Opcional: Registrar intento de acceso denegado en consola
                        console.log("🔴 ACCESO DENEGADO - Rostro no registrado detectado a las " + new Date().toLocaleTimeString());
                    }
                } 
                else {
                    // No hay rostros detectados
                    if (ultimoEstado !== "ninguno") {
                        ocultarPaneles();
                        ultimoEstado = "ninguno";
                        ultimoRostroDesconocido = false;
                    }
                }

            }, 150);
        };
    } catch (err) {
        statusDiv.innerText = "Error: " + err.message;
        statusDiv.style.color = "red";
    }
}

// Función para mostrar el panel de bienvenida (VERDE - Autorizado)
function mostrarPanelBienvenida(nombre) {
    if (timeoutOcultarPanel) {
        clearTimeout(timeoutOcultarPanel);
    }
    
    deniedPanel.style.display = 'none';
    
    welcomeMessage.innerText = "Bienvenido, " + nombre;
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    // Auto-ocultar después de 4 segundos
    timeoutOcultarPanel = setTimeout(() => {
        if (ultimoEstado === "autorizado") {
            ocultarPaneles();
            ultimoEstado = "ninguno";
        }
    }, 4000);
}

// Función para mostrar panel de ACCESO DENEGADO (ROJO - Para UNKNOWN)
function mostrarPanelDenegado() {
    if (timeoutOcultarPanel) {
        clearTimeout(timeoutOcultarPanel);
    }
    
    // Ocultar panel de bienvenida
    welcomePanel.style.display = 'none';
    
    // Mostrar panel ROJO de acceso denegado
    deniedPanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    // Añadir animación de shake para más énfasis
    deniedPanel.classList.add('shake-animation');
    setTimeout(() => {
        deniedPanel.classList.remove('shake-animation');
    }, 500);
    
    // Efecto de flash rojo en el fondo (opcional)
    document.body.style.transition = 'background-color 0.1s';
    document.body.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
    setTimeout(() => {
        document.body.style.backgroundColor = '';
    }, 300);
    
    // El panel de ACCESO DENEGADO permanece visible por 3 segundos
    timeoutOcultarPanel = setTimeout(() => {
        if (ultimoEstado === "denegado") {
            ocultarPaneles();
            ultimoEstado = "ninguno";
        }
    }, 3000);
}

// Función para ocultar todos los paneles
function ocultarPaneles() {
    welcomePanel.style.display = 'none';
    deniedPanel.style.display = 'none';
    statusDiv.style.display = 'block';
}

// Función para cargar usuarios desde Google Sheets
async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("✅ Usuarios registrados:", usuariosRegistrados.length);
        console.log("📋 Lista de usuarios autorizados:", usuariosRegistrados.map(u => u.name));
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

// Función para buscar coincidencia facial
function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0 || cargandoUsuarios) {
        return { label: "Desconocido" };
    }

    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.55 // Umbral de similitud
    );

    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    // Debug: Mostrar qué se está detectando
    if (bestMatch.label !== "Desconocido") {
        console.log("✅ Autorizado:", bestMatch.label, "Distancia:", bestMatch.distance);
    } else {
        console.log("🔴 ACCESO DENEGADO - Rostro desconocido detectado");
    }
    
    return { label: bestMatch.label };
}

// Función para registrar nuevo usuario
async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    
    if (!name || !role) {
        alert("❌ Por favor, completa todos los datos");
        return;
    }

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

        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ ¡Registro Exitoso!\n\n👤 Nombre: ${name}\n💼 Rol: ${role}\n\nLa página se recargará para actualizar la base de datos.`);
            location.reload(); 
        })
        .catch(err => {
            alert("❌ Error al registrar: " + err.message);
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando a la cámara.");
    }
}

// Iniciar el sistema
iniciarSistema();
