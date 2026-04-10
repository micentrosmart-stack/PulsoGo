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
let ultimoEstado = null; // Para evitar parpadeos
let timeoutOcultarPanel = null; // Timeout para ocultar paneles

async function iniciarSistema() {
    try {
        statusDiv.innerText = "Cargando cerebro facial...";
        
        // Cargar modelos
        const path = '.'; // Tus modelos están en la raíz
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        // Cargar base de datos del Excel
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
                let nombreAutorizado = "";

                // Procesar cada rostro detectado
                for (const detection of resized) {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    // Si el rostro está registrado (autorizado)
                    if (bestMatch.label !== "Desconocido") {
                        personaAutorizada = true;
                        nombreAutorizado = bestMatch.label;
                        
                        // Dibujar cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        
                        // Dibujar texto "AUTORIZADO" en verde
                        ctx.font = "16px Arial";
                        ctx.fillStyle = "#2ecc71";
                        ctx.fillText("✓ AUTORIZADO", detection.detection.box.x, detection.detection.box.y - 5);
                    } else {
                        // Si el rostro NO está registrado (desconocido)
                        // Dibujar cuadro ROJO
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        
                        // Dibujar texto "NO AUTORIZADO" en rojo
                        ctx.font = "16px Arial";
                        ctx.fillStyle = "#e74c3c";
                        ctx.fillText("✗ NO AUTORIZADO", detection.detection.box.x, detection.detection.box.y - 5);
                    }
                }

                // Manejar la UI según el estado
                if (personaAutorizada) {
                    // Mostrar panel de bienvenida (verde)
                    if (ultimoEstado !== "autorizado") {
                        mostrarPanelBienvenida(nombreAutorizado);
                        ultimoEstado = "autorizado";
                    }
                } else if (resized.length > 0) {
                    // Hay rostros pero todos son desconocidos
                    if (ultimoEstado !== "denegado") {
                        mostrarPanelDenegado();
                        ultimoEstado = "denegado";
                    }
                } else {
                    // No hay rostros detectados
                    if (ultimoEstado !== "ninguno") {
                        ocultarPaneles();
                        ultimoEstado = "ninguno";
                    }
                }

            }, 150); // Reducido a 150ms para mejor respuesta
        };
    } catch (err) {
        statusDiv.innerText = "Error: " + err.message;
        statusDiv.style.color = "red";
    }
}

// Función para mostrar el panel de bienvenida (autorizado)
function mostrarPanelBienvenida(nombre) {
    // Limpiar timeout anterior si existe
    if (timeoutOcultarPanel) {
        clearTimeout(timeoutOcultarPanel);
    }
    
    // Ocultar panel de denegado
    deniedPanel.style.display = 'none';
    
    // Mostrar panel de bienvenida
    welcomeMessage.innerText = "Bienvenido, " + nombre;
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    // Opcional: Efecto de sonido (descomentar si tienes audio)
    // reproducirSonido('autorizado.mp3');
    
    // Auto-ocultar después de 5 segundos
    timeoutOcultarPanel = setTimeout(() => {
        if (ultimoEstado === "autorizado") {
            ocultarPaneles();
            ultimoEstado = "ninguno";
        }
    }, 5000);
}

// Función para mostrar el panel de acceso denegado
function mostrarPanelDenegado() {
    // Limpiar timeout anterior si existe
    if (timeoutOcultarPanel) {
        clearTimeout(timeoutOcultarPanel);
    }
    
    // Ocultar panel de bienvenida
    welcomePanel.style.display = 'none';
    
    // Mostrar panel de denegado
    deniedPanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    // Añadir animación de shake
    deniedPanel.classList.add('shake-animation');
    setTimeout(() => {
        deniedPanel.classList.remove('shake-animation');
    }, 300);
    
    // Opcional: Efecto de sonido (descomentar si tienes audio)
    // reproducirSonido('denegado.mp3');
    
    // Auto-ocultar después de 3 segundos
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
        console.log("Usuarios cargados:", usuariosRegistrados.length);
        console.log("Usuarios:", usuariosRegistrados.map(u => u.name));
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
        0.55 // Nivel de precisión (menor es más estricto)
    );

    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
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
            alert(`✅ ¡Registro Exitoso!\n\nNombre: ${name}\nRol: ${role}\n\nLa página se recargará para actualizar la base de datos.`);
            location.reload(); 
        })
        .catch(err => {
            alert("❌ Error al registrar: " + err.message);
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando a la cámara.");
    }
}

// Función opcional para reproducir sonidos (requiere archivos de audio)
function reproducirSonido(tipo) {
    const audio = new Audio();
    if (tipo === 'autorizado') {
        audio.src = 'bienvenido.mp3'; // Necesitas agregar este archivo
    } else if (tipo === 'denegado') {
        audio.src = 'denegado.mp3'; // Necesitas agregar este archivo
    }
    audio.play().catch(e => console.log("Error reproduciendo sonido:", e));
}

// Iniciar el sistema
iniciarSistema();
