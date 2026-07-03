// ============================================================
// assets/js/auth-core.js v19
// Sistema de autenticacion centralizado para Alliance Hub
// Maneja sesiones de admin (Supabase Auth) y jugador (token custom)
// ============================================================

(function() {
    'use strict';

    // ===================== ESTADO =====================
    var currentAdmin = null;
    var currentAdminRole = null;
    var currentPlayer = null;
    var authListeners = [];

    function notifyAuthChange() {
        authListeners.forEach(function(cb) {
            try { cb(currentAdmin, currentPlayer); } catch(e) { console.error('[Auth] Listener error:', e); }
        });
    }

    function onAuthChange(cb) {
        authListeners.push(cb);
        // Llamar inmediatamente con estado actual
        cb(currentAdmin, currentPlayer);
    }

    // ===================== INICIALIZACION =====================
    async function initAuth() {
        try {
            // Verificar sesion de Supabase (admin)
            var { data: { session }, error } = await supabase.auth.getSession();
            if (session) {
                await loadAdminSession(session);
            }

            // Verificar sesion de jugador (token custom)
            var playerData = getPlayerData();
            if (playerData && playerData.playerId) {
                currentPlayer = playerData;
            }

            notifyAuthChange();

            // Escuchar cambios de autenticacion
            supabase.auth.onAuthStateChange(function(event, session) {
                if (event === 'SIGNED_IN' && session) {
                    loadAdminSession(session).then(notifyAuthChange);
                } else if (event === 'SIGNED_OUT') {
                    currentAdmin = null;
                    currentAdminRole = null;
                    notifyAuthChange();
                }
            });
        } catch(e) {
            console.error('[Auth] Init error:', e);
        }
    }

    // ===================== SESION DE ADMIN =====================
    async function loadAdminSession(session) {
        try {
            var { data: admin, error } = await supabase
                .from('admin_users')
                .select('*, alliances(alliance_id, name)')
                .eq('id', session.user.id)
                .single();

            if (admin) {
                currentAdmin = admin;
                currentAdminRole = admin.role;
            }
        } catch(e) {
            console.error('[Auth] Error cargando admin:', e);
        }
    }

    // ===================== SESION DE JUGADOR =====================
    function getPlayerData() {
        try {
            var data = localStorage.getItem('ah_player_data');
            return data ? JSON.parse(data) : null;
        } catch(e) {
            return null;
        }
    }

    function setPlayerData(data) {
        localStorage.setItem('ah_player_data', JSON.stringify(data));
        currentPlayer = data;
        notifyAuthChange();
    }

    function clearPlayerData() {
        localStorage.removeItem('ah_player_data');
        currentPlayer = null;
        notifyAuthChange();
    }

    // ===================== LOGIN/LOGOUT =====================
    async function loginAdmin(email, password) {
        try {
            var { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
            if (error) throw error;
            await loadAdminSession(data.session);
            notifyAuthChange();
            return { success: true, admin: currentAdmin };
        } catch(e) {
            return { success: false, error: e.message };
        }
    }

    async function logoutAdmin() {
        try {
            await supabase.auth.signOut();
            currentAdmin = null;
            currentAdminRole = null;
            notifyAuthChange();
            return { success: true };
        } catch(e) {
            return { success: false, error: e.message };
        }
    }

    async function logoutAll() {
        clearPlayerData();
        return await logoutAdmin();
    }

    // ===================== REGISTRO CON INVITE =====================
    async function signupWithInvite(email, password, inviteCode) {
        try {
            // 1. Verificar invite code
            var { data: invite, error: inviteError } = await supabase
                .from('admin_invites')
                .select('*')
                .eq('code', inviteCode)
                .eq('used', false)
                .single();

            if (inviteError || !invite) {
                return { success: false, error: 'Codigo de invitacion invalido o ya usado' };
            }

            // 2. Login (el admin ya debe existir en Supabase Auth)
            var { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError) {
                return { success: false, error: 'Credenciales incorrectas. Contacta al superadmin.' };
            }

            // 3. Verificar que el usuario no sea ya admin
            var { data: existingAdmin } = await supabase
                .from('admin_users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (existingAdmin) {
                return { success: false, error: 'Este usuario ya es administrador' };
            }

            // 4. Crear registro en admin_users con el rol del invite
            var { error: insertError } = await supabase
                .from('admin_users')
                .insert({
                    id: authData.user.id,
                    role: invite.role || 'moderator',
                    approved_by: invite.created_by,
                    approved_at: new Date().toISOString(),
                    status: 'active'
                });

            if (insertError) throw insertError;

            // 5. Marcar invite como usado
            await supabase
                .from('admin_invites')
                .update({ used: true, used_by: authData.user.id, used_at: new Date().toISOString() })
                .eq('id', invite.id);

            await loadAdminSession(authData.session);
            notifyAuthChange();

            return { success: true, admin: currentAdmin };
        } catch(e) {
            console.error('[Auth] Signup error:', e);
            return { success: false, error: e.message };
        }
    }

    // ===================== VERIFICACION DE ROLES =====================
    function isAdmin() {
        return !!currentAdmin;
    }

    function isSuperAdmin() {
        return currentAdminRole === 'superadmin';
    }

    function isEventAdmin() {
        return currentAdminRole === 'event_admin';
    }

    function isModerator() {
        return currentAdminRole === 'moderator';
    }

    function isAllianceLeader() {
        return currentAdminRole === 'alliance_leader';
    }

    function isCoLeader() {
        return currentAdminRole === 'co_leader';
    }

    function isOfficer() {
        return currentAdminRole === 'officer';
    }

    function isPlayer() {
        return !!currentPlayer;
    }

    function requireAdmin() {
        if (!currentAdmin) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    function requireSuperAdmin() {
        if (!isSuperAdmin()) {
            window.location.href = '/admin/index.html';
            return false;
        }
        return true;
    }

    function requireRole(roles) {
        if (!currentAdminRole) return false;
        if (typeof roles === 'string') roles = [roles];
        return roles.includes(currentAdminRole);
    }

    // ===================== PERMISOS POR FEATURE =====================
    function canManage(managerRole, targetRole) {
        if (!managerRole || !targetRole) return false;
        var hierarchy = ['superadmin', 'event_admin', 'moderator', 'alliance_leader', 'co_leader', 'officer'];
        var managerIndex = hierarchy.indexOf(managerRole);
        var targetIndex = hierarchy.indexOf(targetRole);
        if (targetRole === 'superadmin') return managerRole === 'superadmin';
        return managerIndex !== -1 && targetIndex !== -1 && managerIndex <= targetIndex;
    }

    function canView(myRole, targetRole) {
        if (myRole === 'superadmin') return true;
        if (myRole === 'event_admin') return targetRole !== 'superadmin';
        if (myRole === 'moderator') return targetRole === 'moderator' || targetRole === 'officer' || targetRole === 'co_leader' || targetRole === 'alliance_leader';
        if (myRole === 'alliance_leader') return targetRole === 'officer' || targetRole === 'co_leader' || targetRole === 'alliance_leader';
        if (myRole === 'co_leader') return targetRole === 'officer' || targetRole === 'co_leader';
        if (myRole === 'officer') return targetRole === 'officer';
        return false;
    }

    // ===================== GETTERS =====================
    function getCurrentAdmin() {
        return currentAdmin;
    }

    function getCurrentRole() {
        return currentAdminRole;
    }

    function getCurrentPlayer() {
        return currentPlayer;
    }

    // ===================== API PUBLICA =====================
    window.AuthCore = {
        init: initAuth,
        onChange: onAuthChange,
        loginAdmin: loginAdmin,
        logoutAdmin: logoutAdmin,
        logoutAll: logoutAll,
        signupWithInvite: signupWithInvite,
        getPlayerData: getPlayerData,
        setPlayerData: setPlayerData,
        clearPlayerData: clearPlayerData,
        isAdmin: isAdmin,
        isSuperAdmin: isSuperAdmin,
        isEventAdmin: isEventAdmin,
        isModerator: isModerator,
        isAllianceLeader: isAllianceLeader,
        isCoLeader: isCoLeader,
        isOfficer: isOfficer,
        isPlayer: isPlayer,
        requireAdmin: requireAdmin,
        requireSuperAdmin: requireSuperAdmin,
        requireRole: requireRole,
        canManage: canManage,
        canView: canView,
        getCurrentAdmin: getCurrentAdmin,
        getCurrentRole: getCurrentRole,
        getCurrentPlayer: getCurrentPlayer
    };

    // Inicializar al cargar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
})();
