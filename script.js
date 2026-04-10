const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

let usuariosRegistrados = [];

async function iniciarSistema() {
    try {
        status.innerText = "Cargando modelos e historial...";
        const path = '.'; 
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        // 1. Descargar datos del Excel para reconocer
        await cargarUsuariosDesdeExcel();

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                resized.forEach(detection => {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    // Dibujar cuadro
                    ctx.strokeStyle = bestMatch.label !== "Desconocido" ? "#2ecc71" : "#00d4ff";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
                    
                    // Dibujar nombre
                    ctx.fillStyle = "white";
                    ctx.font = "18px Arial";
                    ctx.fillText(bestMatch.label, detection.detection.box.x, detection.detection.box.y - 10);
                    
                    if(bestMatch.label !== "Desconocido") {
                        status.innerText = "Bienvenido, " + bestMatch.label;
                    }
                });
            }, 100);
        };
    } catch (err) {
        status.innerText = "Error: " + err.message;
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL); // El doGet del script de Google
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
    if (usuariosRegistrados.length === 0) return { label: "Desconocido" };

    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.6 // Nivel de precisión (menor es más estricto)
    );

    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    return { label: bestMatch.label };
}

// Mantenemos la función de registro por si quieres agregar a más personas
async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    if (!name || !role) return alert("Completa los datos");

    status.innerText = "Registrando...";
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
            status.innerText = "✅ Registrado. Reiniciando para reconocer...";
            setTimeout(() => location.reload(), 2000); // Recarga para que te reconozca de inmediato
        });
    }
}

iniciarSistema();
