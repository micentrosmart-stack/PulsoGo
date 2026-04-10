const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');

async function iniciarSistema() {
    try {
        status.innerText = "Cargando modelos faciales...";
        
        // Ruta a la carpeta que creamos (sin espacios)
        const path = 'models'; 
        
        // Cargamos solo lo necesario para el cuadro azul por ahora
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        
        status.innerText = "Abriendo cámara...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        status.innerText = "Buscando rostro...";
        
        // Cuando el video empiece a reproducirse, ajustamos el cuadro azul
        video.onplay = () => {
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
                const resized = faceapi.resizeResults(detections, displaySize);
                
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                resized.forEach(det => {
                    // Dibujamos el cuadro azul
                    ctx.strokeStyle = "#3498db";
                    ctx.lineWidth = 4;
                    ctx.strokeRect(det.box.x, det.box.y, det.box.width, det.box.height);
                });
            }, 100);
        };

    } catch (err) {
        status.innerText = "ERROR: " + err;
        status.style.color = "red";
        console.error(err);
    }
}

// Arrancar
iniciarSistema();
