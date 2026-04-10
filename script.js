// ===== ELIMINAR USUARIO CORREGIDO =====
function cargarListaUsuariosEnSelect() {
    const select = document.getElementById('deleteUserSelect');
    if (!select) return;
    
    // Filtrar usuarios vacíos
    const usuariosValidos = usuariosRegistrados.filter(u => u.name && u.name !== "");
    
    if (usuariosValidos.length === 0) {
        select.innerHTML = '<option value="">No hay usuarios registrados</option>';
        return;
    }
    
    select.innerHTML = '<option value="">Selecciona un usuario...</option>';
    usuariosValidos.forEach(usuario => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ 
            id: usuario.id, 
            rut: usuario.rut, 
            name: usuario.name, 
            empresa: usuario.empresa 
        });
        option.textContent = `${usuario.name} | ${usuario.rut} | ${usuario.empresa}`;
        select.appendChild(option);
    });
}

let usuarioAEliminar = null;

function eliminarUsuario() {
    const select = document.getElementById('deleteUserSelect');
    const selectedValue = select.value;
    
    if (!selectedValue || selectedValue === "No hay usuarios registrados") {
        alert("❌ Selecciona un usuario para eliminar");
        return;
    }
    
    usuarioAEliminar = JSON.parse(selectedValue);
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmMessage').innerHTML = `¿Eliminar a <strong>${usuarioAEliminar.name}</strong><br>RUT: <strong>${usuarioAEliminar.rut}</strong>?<br><br><span style="color: #e74c3c;">⚠️ Esta acción no se puede deshacer</span>`;
    modal.style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('confirmModal').style.display = 'none';
    usuarioAEliminar = null;
}

async function confirmarEliminacion() {
    if (!usuarioAEliminar) return;
    
    updateStatus("Eliminando usuario...", "fa-spinner fa-pulse");
    
    try {
        const payload = { 
            accion: 'delete', 
            id: usuarioAEliminar.id, 
            rut: usuarioAEliminar.rut 
        };
        
        console.log("📤 Eliminando:", payload);
        
        // Intentar con CORS primero
        const response = await fetch(SCRIPT_URL_USUARIOS, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ ${result.message}: ${usuarioAEliminar.name}`);
        } else {
            alert(`❌ Error: ${result.message}`);
        }
        
    } catch (error) {
        console.error("Error CORS, intentando no-cors:", error);
        
        // Fallback a no-cors
        try {
            await fetch(SCRIPT_URL_USUARIOS, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ accion: 'delete', id: usuarioAEliminar.id, rut: usuarioAEliminar.rut })
            });
            alert(`✅ Solicitud enviada. Usuario ${usuarioAEliminar.name} debería estar eliminado.`);
        } catch (e) {
            alert("❌ Error al eliminar. Revisa la consola.");
        }
    }
    
    cerrarModal();
    setTimeout(() => location.reload(), 1500);
}
