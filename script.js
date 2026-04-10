const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');
const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');

let usuariosRegistrados = [];
let ultimoReconocido = "";
let tiempoUltimoRegistro = 0;

// Función de sonido mejorada para que no bloquee el video
function playChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        
        const osc1 = ctx.createOscillator();
        osc1.frequency.value = 523.25;
        osc1.connect(gain);
        osc1.start(now);
        osc1.stop(now + 0.4);
        
        const osc2 = ctx.createOscillator();
        osc2.frequency.value = 783.99;
        osc2.connect(gain);
        osc2.start(now + 0.22);
        osc2.stop(now + 0.65);
    } catch (e) {
        console.log("Audio bloqueado por el navegador hasta que hagas click");
    }
}

async function iniciarSistema() {
    try {
        status.innerText = "Cargando IA y Base de Datos...";
        const path = '.'; 
        
        // Cargamos modelos uno por uno para asegurar que no fallen
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        await cargarUsuariosDesdeExcel();

        status.innerText = "Iniciando cámara...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        
        video.onplay = () => {
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            status.innerText = "SISTEMA ONLINE";

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let alguienDetectado = false;

                resized.forEach(detection => {
                    alguienDetectado = true;
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
                        // RECONOCIDO (VERDE)
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 6;
                        welcomeMessage.innerText = "Bienvenido, " + bestMatch.label;
                        welcomePanel.style.display = 'block';

                        // Evitar registros duplicados seguidos (espera 10 seg)
                        if (ultimoReconocido !== bestMatch.label || (Date.now() - tiempoUltimoRegistro > 10000)) {
                            registrarAccesoExcel(bestMatch.label);
                            playChime();
                            ultimoReconocido = bestMatch.label;
                            tiempoUltimoRegistro = Date.now();
                        }
                    } else {
                        // DESCONOCIDO (AZUL)
                        ctx.strokeStyle = "#00d4ff";
                        ctx.lineWidth = 3;
                        welcomePanel.style.display = 'none';
                    }
                    ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
                });

                if (!alguienDetectado) {
                    welcomePanel.style.display = 'none';
                    ultimoReconocido = "";
                }
            }, 200);
        };
    } catch (err) {
        status.innerText = "ERROR CRÍTICO: " + err.message;
    }
}

async function registrarAccesoExcel(nombre) {
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
            id: "ACCESO_" + Date.now(),
            name: nombre,
            role: "ENTRADA",
            faceDescriptor: "AUTO"
        })
    });
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        console.log("Usuarios cargados: " + usuariosRegistrados.length);
    } catch (e) { console.error("Error Excel:", e); }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) return { label: "Desconocido" };
    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.6
    );
    return faceMatcher.findBestMatch(descriptorActual);
}

iniciarSistema();
