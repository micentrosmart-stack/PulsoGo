async function enviarANube() {
    const rut = document.getElementById('personRut').value;
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const empresa = document.getElementById('personEmpresa').value;
    const instalacion = document.getElementById('personInstalacion').value;  // ← ESTA LÍNEA
    
    if (!rut || !name || !role || !empresa || !instalacion) {
        alert("Completa todos los campos");
        return;
    }
    
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
            instalacion: instalacion,  // ← ESTA LÍNEA
            faceDescriptor: JSON.stringify(Array.from(detection.descriptor))
        };
        
        fetch(SCRIPT_URL_USUARIOS, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
        
        alert("Registrado");
        location.reload();
    }
}
