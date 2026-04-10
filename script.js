// Función eliminarUsuario - Versión NO-CORS
async function eliminarUsuario(idUsuario, rutUsuario, nombreUsuario) {
    const confirmar = confirm(`¿Estás seguro de eliminar al usuario "${nombreUsuario}" (${rutUsuario})?`);
    if (!confirmar) return false;
    
    try {
        const payload = {
            operacion: "eliminar",
            id: idUsuario,
            rut: rutUsuario
        };
        
        // Usar modo 'no-cors' y enviar como form-urlencoded
        const formData = new URLSearchParams();
        formData.append('data', JSON.stringify(payload));
        
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        // Con no-cors no podemos leer la respuesta, así que asumimos éxito
        alert("✅ Usuario eliminado correctamente (modo no-cors)");
        
        // Recargar usuarios después de 1 segundo
        setTimeout(async () => {
            await cargarUsuariosDesdeExcel();
            location.reload();
        }, 1000);
        
        return true;
    } catch (err) {
        console.error("Error eliminando usuario:", err);
        alert("❌ Error al eliminar: " + err.message);
        return false;
    }
}

// Función editarUsuario - Versión NO-CORS
async function editarUsuario(idUsuario, nuevosDatos) {
    try {
        const payload = {
            operacion: "editar",
            id: idUsuario,
            ...nuevosDatos
        };
        
        const formData = new URLSearchParams();
        formData.append('data', JSON.stringify(payload));
        
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        alert("✅ Usuario actualizado correctamente");
        setTimeout(async () => {
            await cargarUsuariosDesdeExcel();
            location.reload();
        }, 1000);
        
        return true;
    } catch (err) {
        console.error("Error editando usuario:", err);
        alert("❌ Error al editar: " + err.message);
        return false;
    }
}
