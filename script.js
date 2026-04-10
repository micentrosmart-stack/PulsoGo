const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

async function iniciarSistema() {
    try {
        status.innerText = "Cargando modelos faciales...";
        
        // El punto '.' le dice a la IA: "los modelos están aquí mismo afuera"
        const path = '.'; 
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        
        status.innerText = "Abriendo cámara...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            status.innerText = "Buscando rostro...";

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
                const resized = faceapi.resizeResults(detections, displaySize);
                
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                resized.forEach(det => {
                    // Esto dibujará el cuadro azul
                    ctx.strokeStyle = "#00d4ff";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(det.box.x, det.box.y, det.box.width, det.box.height);
                });
            }, 100);
        };

    } catch (err) {
        status.innerText = "ERROR: " + err.message;
        status.style.color = "red";
        console.error(err);
    }
}

iniciarSistema();
