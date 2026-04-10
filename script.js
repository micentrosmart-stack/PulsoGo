// TU URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

// Elementos del panel de bienvenida
const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');

let usuariosRegistrados = [];
let cargandoUsuarios = true;

async function iniciarSistema() {
    try {
        status.innerText = "Cargando cerebro facial...";
        
        // Cargar modelos
        const path = '.'; // Tus modelos están en la raíz
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        // Cargar base de datos del Excel
        status.innerText = "Sincronizando con base de datos...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;

        // Abrir cámara
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            status.innerText = "Sistema de Control de Acceso Activo";
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
                
                let rostroReconocido = false;

                resized.forEach(detection => {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    // Si el rostro está registrado
                    if (bestMatch.label !== "Desconocido") {
                        rostroReconocido = true;
                        
                        // Actualizar panel de bienvenida
                        welcomeMessage.innerText = "Bienvenido, " + bestMatch.label;
                        welcomePanel.style.display = 'block'; // Mostrar el panel verde
                        status.style.display = 'none'; // Ocultar mensaje azul

                        // Dibujar cuadro VERDE
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 5;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
                    } else {
                        // Si el rostro es desconocido
                        // Dibujar cuadro AZUL
                        ctx.strokeStyle = "#00d4ff";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
                    }
                });

                // Si no hay rostros reconocidos en pantalla, ocultar el panel verde
                if (!rostroReconocido) {
                    welcomePanel.style.display = 'none';
                    status.style.display = 'block';
                }

            }, 200); // Pequeño retraso para que no parpadee tanto
        };
    } catch (err) {
        status.innerText = "Error: " + err.message;
        status.style.color = "red";
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("Usuarios cargados:", usuariosRegistrados.length);
    } catch (e) {
        console.error("Error cargando usuarios:", e);
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0 || cargandoUsuarios) return { label: "Desconocido" };

    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.55 // Nivel de precisión (menor es más estricto)
    );

    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    return { label: bestMatch.label };
}

// Función de registro (por si acaso)
async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    if (!name || !role) return alert("Completa los datos");

    status.innerText = "Capturando rostro...";
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (detection) {
        const payload = {
            id: Date.now().toString(),
            name: name,
            role: role,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };

        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
        .then(() => {
            alert("✅ ¡Registro Exitoso! La página se recargará.");
            location.reload(); 
        });
    } else {
        alert("El cuadro debe estar sobre tu cara.");
    }
}

iniciarSistema();
