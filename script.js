// Eliminar usuario - VERSIÓN CORREGIDA
async function eliminarUsuario(idUsuario, rutUsuario, nombreUsuario) {
    const confirmar = confirm(`¿Estás seguro de eliminar al usuario "${nombreUsuario}" (${rutUsuario})?`);
    if (!confirmar) return false;
    
    try {
        console.log("🗑️ Intentando eliminar usuario:", { id: idUsuario, rut: rutUsuario });
        
        const payload = {
            operacion: "eliminar",
            id: idUsuario,
            rut: rutUsuario
        };
        
        console.log("📤 Enviando payload:", payload);
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log("📥 Respuesta status:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const resultado = await response.json();
        console.log("📥 Resultado:", resultado);
        
        if (resultado.success) {
            alert("✅ Usuario eliminado correctamente");
            await cargarUsuariosDesdeExcel(); // Recargar lista
            
            // Cerrar el panel admin si está abierto
            const panelAdmin = document.getElementById('panel-admin-modal');
            if (panelAdmin) panelAdmin.remove();
            
            // Refrescar el panel si está abierto
            refrescarListaAdmin();
            return true;
        } else {
            alert("❌ Error: " + (resultado.error || "Error desconocido"));
            return false;
        }
    } catch (err) {
        console.error("❌ Error detallado al eliminar:", err);
        alert("❌ Error al eliminar: " + err.message + "\n\nVerifica la consola (F12) para más detalles.");
        return false;
    }
}
