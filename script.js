// ===== ELIMINAR USUARIOS =====
function eliminarUsuario(id, nombre) {
    console.log("========== ELIMINAR USUARIO ==========");
    console.log("ID a eliminar:", id);
    console.log("Nombre:", nombre);
    
    window.usuarioIdAEliminar = id;
    window.usuarioNombreAEliminar = nombre;
    
    document.getElementById('confirmMessage').innerHTML = `¿Eliminar a <strong>${nombre}</strong>?<br><br><span style="color: #e74c3c;">⚠️ Esto eliminará TODA la fila del usuario</span>`;
    document.getElementById('confirmModal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('confirmModal').style.display = 'none';
    window.usuarioIdAEliminar = null;
}

async function confirmarEliminacion() {
    const id = window.usuarioIdAEliminar;
    const nombre = window.usuarioNombreAEliminar;
    
    if (!id) {
        alert("❌ No hay usuario seleccionado");
        return;
    }
    
    console.log("📤 Enviando eliminación para ID:", id);
    updateStatus("Eliminando usuario...", "fa-spinner fa-pulse");
    
    try {
        const payload = { 
            accion: 'delete', 
            id: id
        };
        
        console.log("Payload enviado:", JSON.stringify(payload));
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log("Respuesta del servidor:", result);
        
        if (result.success) {
            alert(`✅ ${result.message}\nFila eliminada: ${result.fila}`);
        } else {
            alert(`❌ ${result.message}`);
        }
        
        cerrarModal();
        setTimeout(() => location.reload(), 1000);
        
    } catch (err) {
        console.error("Error con CORS, intentando no-cors:", err);
        
        // Fallback con no-cors
        try {
            await fetch(SCRIPT_URL_USUARIOS, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ accion: 'delete', id: id })
            });
            console.log("Solicitud no-cors enviada");
            alert(`✅ Solicitud enviada. Usuario ${nombre} debería estar eliminado.`);
            cerrarModal();
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            console.error("Error fatal:", e);
            alert("❌ Error al eliminar. Revisa la consola.");
        }
    }
}

// Ver los IDs de usuarios cargados
async function cargarUsuariosDesdeExcel() {
    try {
        const response = await fetch(SCRIPT_URL_USUARIOS);
        const data = await response.json();
        
        console.log("📥 Usuarios cargados:", data.length);
        
        // Mostrar cada usuario con su ID
        data.forEach((user, index) => {
            console.log(`  ${index + 1}. ID: ${user.id} | Nombre: ${user.name} | RUT: ${user.rut}`);
        });
        
        usuariosRegistrados = data.filter(user => user.name && user.name !== "").map(user => ({
            id: user.id,
            name: user.name,
            rut: user.rut,
            role: user.role,
            empresa: user.empresa,
            descriptor: new Float32Array(JSON.parse(user.faceDescriptor))
        }));
        
        usuariosFiltrados = [...usuariosRegistrados];
        mostrarListaUsuarios();
        
    } catch (e) {
        console.error("❌ Error:", e);
        usuariosRegistrados = [];
        usuariosFiltrados = [];
    }
}
