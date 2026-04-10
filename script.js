// TU URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRDhofBv-AyXF9AgzekgPeII37Fw-6JmKSfYR6U-3-5eInkL-sdXS7wthzBbbASUFYeA/exec";

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusDiv = document.getElementById('status');

// Elementos de la tarjeta moderna
const welcomeCard = document.getElementById('welcome-card');
const deniedCard = document.getElementById('denied-card');
const welcomeName = document.getElementById('welcome-name');
const welcomeCompany = document.getElementById('welcome-company');
const userRut = document.getElementById('user-rut');
const userRole = document.getElementById('user-role');

let usuariosRegistrados = [];
let cargandoUsuarios = true;
let timeoutOcultarCard = null;

async function iniciarSistema() {
    try {
        updateStatus("Cargando modelos faciales...", "fa-spinner fa-pulse");
        
        const path = '.';
        await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        await faceapi.nets.faceLandmark68Net.loadFromUri(path);
        await faceapi.nets.faceRecognitionNet.loadFromUri(path);
        
        updateStatus("Cargando base de datos...", "fa-spinner fa-pulse");
        await cargarUsuariosDesdeExcel();
        cargandoUsuarios = false;
        
        console.log("✅ Sistema listo");
        console.log("📋 Usuarios registrados:", usuariosRegistrados.length);

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        
        video.onplay = () => {
            updateStatus("Sistema activo - Mostrando rostro", "fa-eye");
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            setInterval(async () => {
                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                const resized = faceapi.resizeResults(detections, displaySize);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let personaAutorizada = false;
                let datosPersona = null;
                
                if (resized.length > 0) {
                    const rostro = resized[0];
                    const descriptor = rostro.descriptor;
                    const resultado = buscarCoincidencia(descriptor);
                    
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        personaAutorizada = true;
                        datosPersona = resultado.datos;
                        
                        ctx.strokeStyle = "#2ecc71";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                                     rostro.detection.box.width, rostro.detection.box.height);
                        
                        console.log("✅ AUTORIZADO:", resultado.label);
                    } 
                    else {
                        ctx.strokeStyle = "#e74c3c";
                        ctx.lineWidth = 4;
                        ctx.strokeRect(rostro.detection.box.x, rostro.detection.box.y, 
                                     rostro.detection.box.width, rostro.detection.box.height);
                        
                        console.log("🔴 ACCESO DENEGADO");
                    }
                }
                
                if (personaAutorizada && datosPersona) {
                    mostrarTarjetaBienvenida(datosPersona);
                } 
                else if (resized.length > 0) {
                    mostrarTarjetaDenegada();
                }
                else {
                    ocultarTarjetas();
                }

            }, 150);
        };
    } catch (err) {
        updateStatus("Error: " + err.message, "fa-exclamation-triangle");
        console.error("Error:", err);
    }
}

// Función para mostrar la tarjeta moderna de bienvenida
function mostrarTarjetaBienvenida(usuario) {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    
    // Ocultar tarjeta denegada
    deniedCard.style.display = 'none';
    
    // Actualizar datos en la tarjeta
    welcomeName.textContent = usuario.name || "Usuario";
    
    // Mostrar empresa
    const companySpan = welcomeCompany.querySelector('span');
    companySpan.textContent = usuario.empresa || "No especificada";
    
    // Mostrar RUT
    userRut.textContent = usuario.rut || "No registrado";
    
    // Mostrar Cargo
    userRole.textContent = usuario.role || "No especificado";
    
    // Mostrar tarjeta con animación
    welcomeCard.style.display = 'block';
    
    // Ocultar status
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '0.5';
    
    console.log("🎉 TARJETA DE BIENVENIDA - Usuario:", usuario.name, "Empresa:", usuario.empresa);
    
    // Auto-ocultar después de 5 segundos
    timeoutOcultarCard = setTimeout(() => {
        ocultarTarjetas();
    }, 5000);
}

// Función para mostrar tarjeta de acceso denegado
function mostrarTarjetaDenegada() {
    if (timeoutOcultarCard) clearTimeout(timeoutOcultarCard);
    
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'block';
    
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '0.5';
    
    console.log("🔴 TARJETA DENEGADA - Acceso no autorizado");
    
    timeoutOcultarCard = setTimeout(() => {
        ocultarTarjetas();
    }, 3000);
}

// Función para ocultar tarjetas
function ocultarTarjetas() {
    welcomeCard.style.display = 'none';
    deniedCard.style.display = 'none';
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.opacity = '1';
}

// Función para actualizar el status
function updateStatus(texto, icono) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerHTML = `<i class="fas ${icono}"></i><span>${texto}</span>`;
    }
}

async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        
        console.log("📥 Datos recibidos:", data);
        
        usuariosRegistrados = data.map(user => ({
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        console.log("✅ Usuarios cargados:", usuariosRegistrados.length);
        usuariosRegistrados.forEach(u => console.log(`   👤 ${u.name} | ${u.empresa}`));
    } catch (e) {
        console.error("❌ Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) {
        return { label: "Desconocido", datos: null };
    }

    const labeledDescriptors = usuariosRegistrados.map(u => 
        new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])
    );
    
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
        const usuarioEncontrado = usuariosRegistrados.find(u => u.name === bestMatch.label);
        console.log(`✅ Coincidencia: ${bestMatch.label}`);
        return { 
            label: bestMatch.label, 
            datos: usuarioEncontrado 
        };
    } else {
        return { label: "Desconocido", datos: null };
    }
}

async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    
    if (!rut || !name || !role || !empresa) {
        alert("❌ Completa TODOS los campos");
        return;
    }

    updateStatus("Capturando rostro...", "fa-camera");
    
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        const payload = {
            id: Date.now().toString(),
            rut: rut,
            name: name.toUpperCase(),
            role: role,
            empresa: empresa.toUpperCase(),
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ REGISTRO EXITOSO!\n\n👤 ${name}\n🏢 ${empresa}\n🔄 Recargando...`);
            location.reload(); 
        });
    } else {
        alert("❌ No se detectó ningún rostro");
        updateStatus("No se detectó rostro", "fa-face-frown");
    }
}

iniciarSistema();
