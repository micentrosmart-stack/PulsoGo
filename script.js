// TU URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');
const deniedPanel = document.getElementById('denied-panel');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let timeoutOcultarPanel = null;

async function iniciarSistema() {
    try {
        statusDiv.innerText = "Cargando modelos faciales...";
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        statusDiv.innerText = "Cargando base de datos...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        console.log("✅ Sistema listo. Usuarios autorizados:", usuariosRegistrados.map(u => u.name));

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "Sistema Activo - Mostrando rostro a la cámara";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Variables de estado
                let hayRostroAutorizado = false;
                let nombreAutorizado = "";
                let hayRostroNoAutorizado = false;

                for (const detection of resized) {
                    // Buscar coincidencia con usuarios registrados
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    // === LÓGICA CORREGIDA ===
                    // Verificar si el label NO es "Desconocido" (significa que está registrado)
                    if (bestMatch.label !== "Desconocido") {
                        // ¡ESTO ES UN USUARIO AUTORIZADO!
                        hayRostroAutorizado = true;
                        nombreAutorizado = bestMatch.label;
                        
                        // Dibujar cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#2ecc71";
                        ctx.fillText("✓ AUTORIZADO", detection.detection.box.x, detection.detection.box.y - 5);
                        
                        console.log("✅ AUTORIZADO:", bestMatch.label);
                    } 
                    else {
                        // ¡ESTO ES UN ROSTRO NO REGISTRADO (UNKNOWN)!
                        hayRostroNoAutorizado = true;
                        
                        // Dibujar cuadro ROJO
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, 
                                     detection.detection.box.width, detection.detection.box.height);
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#e74c3c";
                        ctx.fillText("✗ ACCESO DENEGADO", detection.detection.box.x, detection.detection.box.y - 5);
                        
                        console.log("🔴 ACCESO DENEGADO - Rostro NO registrado");
                    }
                }

                // === MOSTRAR PANEL CORRECTO ===
                if (hayRostroAutorizado) {
                    // Solo mostrar bienvenida si hay un rostro autorizado
                    mostrarPanelBienvenida(nombreAutorizado);
                } 
                else if (hayRostroNoAutorizado) {
                    // Mostrar acceso denegado SOLO para rostros no registrados
                    mostrarPanelDenegado();
                } 
                else {
                    // No hay rostros - ocultar todo
                    ocultarPaneles();
                }

            }, 150);
        };
    } catch (err) {
        statusDiv.innerText = "Error: " + err.message;
        statusDiv.style.color = "red";
        console.error("Error:", err);
    }
}

function mostrarPanelBienvenida(nombre) {
    if (timeoutOcultarPanel) clearTimeout(timeoutOcultarPanel);
    
    // Asegurar que NO se muestre "Unknown"
    if (!nombre || nombre === "Desconocido") {
        console.error("ERROR: Intentando mostrar bienvenida con nombre:", nombre);
        return;
    }
    
    // Ocultar panel de denegado
    deniedPanel.style.display = 'none';
    
    // Mostrar panel de bienvenida con el nombre correcto
    welcomeMessage.innerText = "Bienvenido, " + nombre;
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    console.log("🎉 MOSTRANDO BIENVENIDA PARA:", nombre);
    
    timeoutOcultarPanel = setTimeout(() => {
        welcomePanel.style.display = 'none';
        statusDiv.style.display = 'block';
    }, 4000);
}

function mostrarPanelDenegado() {
    if (timeoutOcultarPanel) clearTimeout(timeoutOcultarPanel);
    
    // Asegurar que el panel de bienvenida esté oculto
    welcomePanel.style.display = 'none';
    
    // Mostrar panel de acceso denegado
    deniedPanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    // Animación de shake
    deniedPanel.classList.add('shake-animation');
    setTimeout(() => {
        deniedPanel.classList.remove('shake-animation');
    }, 500);
    
    console.log("🔴 MOSTRANDO ACCESO DENEGADO");
    
    timeoutOcultarPanel = setTimeout(() => {
        deniedPanel.style.display = 'none';
        statusDiv.style.display = 'block';
    }, 3000);
}

function ocultarPaneles() {
    welcomePanel.style.display = 'none';
    deniedPanel.style.display = 'none';
    statusDiv.style.display = 'block';
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("📋 Usuarios registrados:", usuariosRegistrados.length);
        usuariosRegistrados.forEach(u => console.log("  -", u.name));
    } catch (e) {
        console.error("Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    // Si no hay usuarios registrados, todos son desconocidos
    if (usuariosRegistrados.length === 0 || cargandoUsuarios) {
        return { label: "Desconocido", distance: 1 };
    }

    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.55
    );

    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    // Debug: Mostrar qué encontró
    if (bestMatch.label !== "Desconocido") {
        console.log(`👤 Coincidencia: ${bestMatch.label} (distancia: ${bestMatch.distance})`);
    } else {
        console.log(`❌ Sin coincidencia - distancia: ${bestMatch.distance}`);
    }
    
    return { label: bestMatch.label, distance: bestMatch.distance };
}

async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    
    if (!name || !role) {
        alert("❌ Completa nombre y cargo");
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
            alert(`✅ Registro exitoso para: ${name}\nLa página se recargará.`);
            location.reload(); 
        });
    } else {
        alert("❌ No se detectó ningún rostro");
    }
}

iniciarSistema();
