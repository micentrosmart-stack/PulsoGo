// TU NUEVA URL DE GOOGLE APPS SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRDhofBv-AyXF9AgzekgPeII37Fw-6JmKSfYR6U-3-5eInkL-sdXS7wthzBbbASUFYeA/exec";

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
        usuariosRegistrados.forEach(u => console.log("   →", u.name, "-", u.empresa));

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
                
                let personaAutorizada = false;
                let nombrePersona = "";
                let datosPersona = null;
                
                if (resized.length > 0) {
                    const rostro = resized[0];
                    const descriptor = rostro.descriptor;
                    const resultado = buscarCoincidencia(descriptor);
                    
                    if (resultado.label !== "Desconocido" && resultado.label !== "unknown") {
                        personaAutorizada = true;
                        nombrePersona = resultado.label;
                        datosPersona = resultado.datos;
                        
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
                        personaAutorizada = false;
                        
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
                
                if (personaAutorizada) {
                    mostrarPanelBienvenida(nombrePersona, datosPersona);
                } 
                else if (resized.length > 0) {
                    mostrarPanelDenegado();
                }
                else {
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

function mostrarPanelBienvenida(nombre, datos) {
    if (!nombre || nombre === "Desconocido" || nombre === "unknown" || nombre.toLowerCase().includes("unknown")) {
        console.error("🚨 INTENTO DE MOSTRAR BIENVENIDA CON NOMBRE INVÁLIDO:", nombre);
        return;
    }
    
    if (timeoutOcultarPanel) clearTimeout(timeoutOcultarPanel);
    
    deniedPanel.style.display = 'none';
    
    // Mostrar información más completa si está disponible
    if (datos && datos.empresa) {
        welcomeMessage.innerHTML = `Bienvenido, ${nombre}<br><span style="font-size: 16px;">🏢 ${datos.empresa}</span>`;
    } else {
        welcomeMessage.innerText = "Bienvenido, " + nombre;
    }
    
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
    
    welcomePanel.style.display = 'none';
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
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        console.log("✅ Usuarios cargados correctamente:", usuariosRegistrados.length);
        if (usuariosRegistrados.length === 0) {
            console.warn("⚠️ No hay usuarios registrados en la base de datos");
        } else {
            usuariosRegistrados.forEach(u => console.log(`   👤 ${u.name} | RUT: ${u.rut} | Empresa: ${u.empresa}`));
        }
    } catch (e) {
        console.error("❌ Error cargando usuarios:", e);
        usuariosRegistrados = [];
    }
}

function buscarCoincidencia(descriptorActual) {
    if (usuariosRegistrados.length === 0) {
        console.log("⚠️ No hay usuarios registrados para comparar");
        return { label: "Desconocido", datos: null };
    }

    const labeledDescriptors = usuariosRegistrados.map(u => 
        new faceapi.LabeledFaceDescriptors(u.name, [u.descriptor])
    );
    
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    const bestMatch = faceMatcher.findBestMatch(descriptorActual);
    
    console.log(`🔍 Comparación: Mejor coincidencia = "${bestMatch.label}", Distancia = ${bestMatch.distance}`);
    
    if (bestMatch.label !== "unknown" && bestMatch.label !== "Desconocido") {
        const usuarioEncontrado = usuariosRegistrados.find(u => u.name === bestMatch.label);
        console.log(`✅ Coincidencia encontrada con: ${bestMatch.label}`);
        console.log(`   📋 Datos: RUT=${usuarioEncontrado?.rut}, Empresa=${usuarioEncontrado?.empresa}`);
        return { 
            label: bestMatch.label, 
            datos: usuarioEncontrado 
        };
    } else {
        console.log(`❌ No se encontró coincidencia - Rostro desconocido`);
        return { label: "Desconocido", datos: null };
    }
}

async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    
    if (!rut || !name || !role || !empresa) {
        alert("❌ Por favor, completa TODOS los campos:\n- RUT\n- Nombre Completo\n- Cargo\n- Empresa");
        return;
    }
    
    const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;
    if (!rutRegex.test(rut)) {
        alert("⚠️ Formato de RUT inválido.\nEjemplo correcto: 12.345.678-9");
        return;
    }

    statusDiv.innerText = "📸 Capturando rostro... Por favor, mira a la cámara";
    
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        const payload = {
            id: Date.now().toString(),
            rut: rut,
            name: name,
            role: role,
            empresa: empresa,
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        console.log("📤 Enviando datos:", payload);

        fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        })
        .then(() => {
            alert(`✅ ¡REGISTRO EXITOSO!\n\n📧 RUT: ${rut}\n👤 Nombre: ${name}\n💼 Cargo: ${role}\n🏢 Empresa: ${empresa}\n\n🔄 La página se recargará para actualizar la base de datos.`);
            location.reload(); 
        })
        .catch(err => {
            console.error("Error en registro:", err);
            alert("❌ Error al registrar: " + err.message);
        });
    } else {
        alert("❌ No se detectó ningún rostro. Asegúrate de estar mirando directamente a la cámara.");
    }
}

iniciarSistema();
