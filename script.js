const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxa6O9kgejvCaD_A7gsgMtsWoVML5LfSqXoyG6lKKrGze1QTfnNQMk_-reGgPjOh5txRA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const status = document.getElementById('status');
const welcomePanel = document.getElementById('welcome-panel');
const welcomeMessage = document.getElementById('welcome-message');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let ultimoReconocido = "";
let tiempoUltimoRegistro = 0;

// Tu función de sonido Chime
function playChime() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 523.25;
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.4);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 783.99;
    osc2.connect(gain);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.65);
}

async function iniciarSistema() {
    try {
        status.innerText = "Sincronizando Control de Acceso...";
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;

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
                
                let rostroEnPantalla = false;

                resized.forEach(detection => {
                    const bestMatch = buscarCoincidencia(detection.descriptor);
                    
                    if (bestMatch.label !== "Desconocido") {
                        rostroEnPantalla = true;
                        
                        // Acción cuando se reconoce a alguien
                        if (ultimoReconocido !== bestMatch.label || (Date.now() - tiempoUltimoRegistro > 8000)) {
                            registrarAccesoExcel(bestMatch.label);
                            playChime(); // Sonido solicitado
                            ultimoReconocido = bestMatch.label;
                            tiempoUltimoRegistro = Date.now();
                        }

                        welcomeMessage.innerText = "Bienvenido, " + bestMatch.label;
                        welcomePanel.style.display = 'block';
                        ctx.strokeStyle = "#2ecc71"; // Verde
                        ctx.lineWidth = 6;
                    } else {
                        ctx.strokeStyle = "#00d4ff"; // Azul
                        ctx.lineWidth = 3;
                    }
                    ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
                });

                if (!rostroEnPantalla) {
                    welcomePanel.style.display = 'none';
                    ultimoReconocido = "";
                }
            }, 250);
        };
    } catch (err) {
        status.innerText = "Error: " + err.message;
    }
}

async function registrarAccesoExcel(nombre) {
    console.log("Registrando acceso para: " + nombre);
    const payload = {
        id: "LOG_" + Date.now(),
        name: nombre,
        role: "ACCESO_DETECTADO",
        faceDescriptor: "REGISTRO_AUTOMATICO"
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
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
    } catch (e) { console.error(e); }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) return { label: "Desconocido" };
    const faceMatcher = new faceapi.FaceMatcher(
        usuariosRegistrados.map(u => new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])),
        0.6
    );
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    return { label: bestMatch.label };
}

iniciarSistema();
