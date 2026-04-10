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
        
        console.log("✅ Sistema listo");
        console.log("📋 Usuarios REGISTRADOS en base de datos:", usuariosRegistrados.length);
        usuariosRegistrados.forEach(u => console.log("   →", u.name));

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            statusDiv.innerText = "Sistema Activo";
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // === NUEVA LÓGICA MÁS SIMPLE Y CLARA ===
                let personaAutorizada = false;
                let nombrePersona = "";
                
                // Si hay rostros detectados
                if (resized.length > 0) {
                    // Tomar el primer rostro (el más grande/cercano normalmente)
                    const rostro = resized[0];
                    const descriptor = rostro.descriptor;
                    
                    // Buscar si este rostro está en la base de datos
                    const resultado = buscarCoincidencia(descriptor);
                    
                    // === DECISIÓN CLARA ===
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        // ¡ESTO ES UN ROSTRO REGISTRADO!
                        personaAutorizada = true;
                        nombrePersona = resultado.label;
                        
                        // Dibujar cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                                     rostro.detection.box.width, rostro.detection.box.height);
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#2ecc71";
                        ctx.fillText("✓ AUTORIZADO", rostro.detection.box.x, rostro.detection.box.y - 5);
                        
                        console.log("✅ AUTORIZADO:", resultado.label);
                    } 
                    else {
                        // ¡ESTO ES UN ROSTRO DESCONOCIDO!
                        personaAutorizada = false;
                        
                        // Dibujar cuadro ROJO
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                                     rostro.detection.box.width, rostro.detection.box.height);
                        ctx.font = "bold 18px Arial";
                        ctx.fillStyle = "#e74c3c";
                        ctx.fillText("✗ ACCESO DENEGADO", rostro.detection.box.x, rostro.detection.box.y - 5);
                        
                        console.log("🔴 ACCESO DENEGADO - Rostro NO registrado");
                    }
                }
                
                // === MOSTRAR EL PANEL CORRECTO ===
                if (personaAutorizada) {
                    // SOLO mostrar bienvenida si es autorizado
                    mostrarPanelBienvenida(nombrePersona);
                } 
                else if (resized.length > 0) {
                    // Hay rostro pero NO es autorizado
                    mostrarPanelDenegado();
                }
                else {
                    // No hay rostros
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
    // VALIDACIÓN ESTRICTA - NUNCA mostrar "Unknown"
    if (!nombre || nombre === "Desconocido" || nombre === "unknown" || nombre.toLowerCase().includes("unknown")) {
        console.error("🚨 INTENTO DE MOSTRAR BIENVENIDA CON NOMBRE INVÁLIDO:", nombre);
        return; // SALIR - No mostrar nada
    }
    
    if (timeoutOcultarPanel) clearTimeout(timeoutOcultarPanel);
    
    // Ocultar panel rojo
    deniedPanel.style.display = 'none';
    
    // Mostrar panel verde con el nombre
    welcomeMessage.innerText = "Bienvenido, " + nombre;
    welcomePanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    console.log("🎉 MOSTRANDO PANEL VERDE para:", nombre);
    
    timeoutOcultarPanel = setTimeout(() => {
        welcomePanel.style.display = 'none';
        statusDiv.style.display = 'block';
    }, 4000);
}

function mostrarPanelDenegado() {
    if (timeoutOcultarPanel) clearTimeout(timeoutOcultarPanel);
    
    // IMPORTANTE: Asegurar que el panel verde NO esté visible
    welcomePanel.style.display = 'none';
    
    // Mostrar panel rojo
    deniedPanel.style.display = 'block';
    statusDiv.style.display = 'none';
    
    deniedPanel.classList.add('shake-animation');
    setTimeout(() => {
        deniedPanel.classList.remove('shake-animation');
    }, 500);
    
    console.log("🔴 MOSTRANDO PANEL ROJO - ACCESO DENEGADO");
    
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
        
        console.log("📥 Datos recibidos de Google Sheets:", data);
        
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        console.log("✅ Usuarios cargados correctamente:", usuariosRegistrados.length);
        if (usuariosRegistrados.length === 0) {
            console.warn("⚠️ No hay usuarios registrados en la base de datos");
        } else {
            usuariosRegistrados.forEach(u => console.log("   👤", u.name));
        }
    } catch (e) {
        console.error("❌ Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    // Si no hay usuarios, todos son desconocidos
    if (usuariosRegistrados.length === 0) {
        console.log("⚠️ No hay usuarios registrados para comparar");
        return { label: "Desconocido" };
    }

    // Crear FaceMatcher con los usuarios registrados
    const labeledDescriptors = usuariosRegistrados.map(u => 
        new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])
    );
    
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    // Log detallado de la comparación
    console.log(`🔍 Comparación: Mejor coincidencia = "${bestMatch.label}", Distancia = ${bestMatch.distance}`);
    
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
        console.log(`✅ Coincidencia encontrada con: ${bestMatch.label}`);
    } else {
        console.log(`❌ No se encontró coincidencia - Rostro desconocido`);
    }
    
    return { label: bestMatch.label };
}

async function enviarANube() {
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
            alert(`✅ Registro exitoso: ${name}\n🔄 Recargando página...`);
            location.reload(); 
        });
    } else {
        alert("❌ No se detectó ningún rostro");
    }
}

// Iniciar el sistema
iniciarSistema();
