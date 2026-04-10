// TU URL DEFINITIVA DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

async function iniciarSistema() {
    try {
        status.innerText = "Cargando cerebro facial...";
        const path = '.'; 
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
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
                    ctx.strokeStyle = "#00d4ff";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(det.box.x, det.box.y, det.box.width, det.box.height);
                });
            }, 100);
        };
    } catch (err) {
        status.innerText = "Error: " + err.message;
    }
}

async function enviarANube() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;

    if (!name || !role) {
        alert("Marcos, completa los campos antes de guardar.");
        return;
    }

    status.innerText = "Analizando rostro...";
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        status.innerText = "Enviando al Excel...";
        
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
            status.innerText = "✅ ¡REGISTRO EXITOSO!";
            document.getElementById('personName').value = "";
            document.getElementById('personRole').value = "";
        })
        .catch(err => {
            status.innerText = "❌ Error: " + err;
        });
    } else {
        alert("El cuadro azul debe estar sobre tu cara.");
    }
}

iniciarSistema();
