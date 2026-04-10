// ===== ELIMINAR USUARIOS =====
function eliminarUsuario(id, nombre) {
    console.log("🗑️ Eliminar usuario - ID:", id, "Nombre:", nombre);
    
    window.usuarioIdAEliminar = id;
    window.usuarioNombreAEliminar = nombre;
    
    document.getElementById('confirmMessage').innerHTML = `¿Eliminar a <strong>${nombre}</strong>?<br><br><span style="color: #e74c3c;">⚠️ Esta acción no se puede deshacer</span>`;
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
    
    console.log("📤 Confirmando eliminación del ID:", id);
    updateStatus("Eliminando usuario...", "fa-spinner fa-pulse");
    
    try {
        const payload = { 
            accion: 'delete', 
            id: id
        };
        
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log("Respuesta:", result);
        
        if (result.success) {
            alert(`✅ ${result.message}`);
        } else {
            alert(`❌ ${result.message}`);
        }
        
        cerrarModal();
        location.reload();
        
    } catch (err) {
        console.error("❌ Error:", err);
        // Fallback a no-cors
        await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ accion: 'delete', id: id })
        });
        alert(`✅ Solicitud enviada. Usuario ${nombre} debería estar eliminado.`);
        cerrarModal();
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.onclick = confirmarEliminacion;
    }
});
