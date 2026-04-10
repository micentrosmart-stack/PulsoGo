// TU URL DE GOOGLE APPS SCRIPT (ACTUALIZADA)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJkDq81aG8TMYqpaLcZ48mfoXid1EHeXnm1-2KKMOFK8JFUo_XBANuGP-z-ND94N25_A/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

async function iniciarSistema() {
    try {
        status.innerText = "Cargando cerebro facial...";
        
        const path = '.'; // Los modelos están en la raíz
        
        // Cargamos los 3 modelos necesarios para detectar y reconocer
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        status.innerText = "Accediendo a cámara...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            status.innerText = "Sistema Activo. Cuadro Azul OK.";

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
                const resized = faceapi.resizeResults(detections, displaySize);
                
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                resized.forEach(det => {
                    ctx.strokeStyle = "#00d4ff"; // Azul neón
                    ctx.lineWidth = 4;
                    ctx.strokeRect(det.box.x, det.box.y, det.box.width, det.box.height);
                });
            }, 100);
        };
    } catch (err) {
        status.innerText = "Error de inicio: " + err.message;
        status.style.color = "red";
    }
}

// FUNCIÓN PARA MANDAR AL EXCEL
async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;

    if (!name || !role) {
        alert("Marcos, por favor escribe el nombre y el cargo antes de guardar.");
        return;
    }

    status.innerText = "Analizando rostro para registro...";
    
    // Capturamos el descriptor facial (los números de tu cara)
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        status.innerText = "Enviando datos al Google Sheets...";
        
        const payload = {
            id: Date.now().toString(),
            name: name,
            role: role,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };

        // El envío mágico a tu URL
        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Para evitar bloqueos de Google
            body: JSON.stringify(payload)
        })
        .then(() => {
            status.innerText = "✅ ¡REGISTRO EXITOSO EN EXCEL!";
            document.getElementById('personName').value = "";
            document.getElementById('personRole').value = "";
            console.log("Datos enviados correctamente");
        })
        .catch(err => {
            status.innerText = "❌ Error al enviar: " + err;
            console.error(err);
        });
    } else {
        alert("Ponte frente a la cámara para que el cuadro azul te detecte.");
        status.innerText = "Error: Rostro no detectado.";
    }
}

// Iniciar automáticamente
iniciarSistema();
