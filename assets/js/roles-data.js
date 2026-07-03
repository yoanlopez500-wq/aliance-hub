const ROLE_HIERARCHY = [
    'superadmin',
    'event_admin',
    'moderator',
    'alliance_leader',
    'co_leader',
    'officer',
];

// Verifica si un rol puede actuar sobre otro
function canManage(managerRole, targetRole) {
    if (!managerRole || !targetRole) return false;
    const managerIndex = ROLE_HIERARCHY.indexOf(managerRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);
    // Solo superadmin puede gestionar a otros superadmins
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

const ROLE_CONFIG = {
    superadmin: {
        label: 'Superadmin',
        badgeClass: 'bg-red-500',
        icon: '&#9881;&#65039;',
    },
    event_admin: {
        label: 'Admin de Eventos',
        badgeClass: 'bg-yellow-500',
        icon: '&#127942;',
    },
    moderator: {
        label: 'Moderador',
        badgeClass: 'bg-blue-500',
        icon: '&#128737;&#65039;',
    },
    alliance_leader: {
        label: 'Lider de Alianza',
        badgeClass: 'bg-green-500',
        icon: '&#127988;',
    },
    co_leader: {
        label: 'Co-Lider',
        badgeClass: 'bg-teal-500',
        icon: '&#11088;',
    },
    officer: {
        label: 'Oficial',
        badgeClass: 'bg-cyan-500',
        icon: '&#127775;',
    },
};

const ROLE_PANELS = {
    superadmin: {
        label: 'Panel de Superadmin',
        badgeClass: 'bg-red-500',
        icon: '&#9881;&#65039;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/admins.html', label: '&#128110; Administradores', section: 'main' },
            { href: 'admin/invites.html', label: '&#127381; Invitaciones', section: 'main' },
            { href: 'admin/import.html', label: '&#128229; Importar CSV', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'admin/review-committee.html', label: '&#128736;&#65039; Comite', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '&#128220; Reglamento', section: 'tools' },
            { href: 'admin/inbox.html', label: '&#128172; Inbox', section: 'comms' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Crear Partida', action: 'openMatchModal()' },
            { label: '&#128110; Gestionar Admins', href: 'admin/admins.html' },
            { label: '&#127381; Crear Invitacion', action: 'createInvite()' },
        ]
    },
    event_admin: {
        label: 'Panel de Eventos',
        badgeClass: 'bg-yellow-500',
        icon: '&#127942;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/import.html', label: '&#128229; Importar CSV', section: 'tools' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'admin/review-committee.html', label: '&#128736;&#65039; Comite', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Crear Partida', action: 'openMatchModal()' },
            { label: '&#128229; Importar CSV', href: 'admin/import.html' },
        ]
    },
    moderator: {
        label: 'Panel de Moderador',
        badgeClass: 'bg-blue-500',
        icon: '&#128737;&#65039;',
        navLinks: [
            { href: 'admin/index.html', label: '&#128202; Dashboard', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'admin/review-committee.html', label: '&#128736;&#65039; Comite', section: 'tools' },
            { href: 'admin/rules-editor.html', label: '&#128220; Reglamento', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#9889; Ver Strikes', href: 'admin/strikes.html' },
            { label: '&#128680; Ver Reportes', href: 'admin/reports.html' },
        ]
    },
    alliance_leader: {
        label: 'Panel de Lider',
        badgeClass: 'bg-green-500',
        icon: '&#127988;',
        navLinks: [
            { href: 'leader-dashboard.html', label: '&#127968; Mi Alianza', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/duel-manager.html', label: '&#9876;&#65039; Duelos', section: 'main' },
            { href: 'admin/officers.html', label: '&#11088; Mi Equipo', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Crear Partida', action: 'openMatchModal()' },
            { label: '&#9876;&#65039; Preparar Duelo', href: 'admin/duel-manager.html' },
        ]
    },
    co_leader: {
        label: 'Panel de Co-Lider',
        badgeClass: 'bg-teal-500',
        icon: '&#11088;',
        navLinks: [
            { href: 'leader-dashboard.html', label: '&#127968; Mi Alianza', section: 'main' },
            { href: 'admin/matches.html', label: '&#127918; Partidas', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/duel-manager.html', label: '&#9876;&#65039; Duelos', section: 'main' },
            { href: 'admin/officers.html', label: '&#11088; Mi Equipo', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'admin/reports.html', label: '&#128680; Reportes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#10133; Crear Partida', action: 'openMatchModal()' },
            { label: '&#9876;&#65039; Preparar Duelo', href: 'admin/duel-manager.html' },
        ]
    },
    officer: {
        label: 'Panel de Oficial',
        badgeClass: 'bg-cyan-500',
        icon: '&#127775;',
        navLinks: [
            { href: 'leader-dashboard.html', label: '&#127968; Mi Alianza', section: 'main' },
            { href: 'admin/players.html', label: '&#128100; Jugadores', section: 'main' },
            { href: 'admin/strikes.html', label: '&#9889; Strikes', section: 'tools' },
            { href: 'chat.html', label: '&#128172; Chat', section: 'comms' },
        ],
        quickActions: [
            { label: '&#128100; Ver Jugadores', href: 'admin/players.html' },
        ]
    }
};

// Panel por defecto (fallback)
const DEFAULT_PANEL = ROLE_PANELS.moderator;

// Obtener el panel de navegacion segun el rol
function getRolePanel(role) {
    return ROLE_PANELS[role] || DEFAULT_PANEL;
}

// Obtener la configuracion de un rol especifico
function getRoleConfig(role) {
    return ROLE_CONFIG[role] || { label: role, badgeClass: 'bg-gray-500', icon: '&#128100;' };
}

// Obtener el indice jerarquico de un rol (0 = mas alto)
function getRoleIndex(role) {
    return ROLE_HIERARCHY.indexOf(role);
}

// Verificar si un rol es superior a otro
function isRoleAbove(roleA, roleB) {
    return getRoleIndex(roleA) < getRoleIndex(roleB);
}

// Verificar si un rol es igual o superior a otro
function isRoleAtLeast(roleA, roleB) {
    return getRoleIndex(roleA) <= getRoleIndex(roleB);
}

// Obtener todos los roles disponibles
function getAllRoles() {
    return ROLE_HIERARCHY.map(role => ({
        value: role,
        label: ROLE_CONFIG[role]?.label || role,
        ...ROLE_CONFIG[role]
    }));
}

// Obtener roles que un usuario puede asignar segun su rol
function getAssignableRoles(userRole) {
    if (!userRole) return [];
    const userIndex = ROLE_HIERARCHY.indexOf(userRole);
    if (userIndex === -1) return [];
    
    // Superadmin puede asignar cualquier rol excepto superadmin (salvo que sea el unico)
    if (userRole === 'superadmin') {
        return ROLE_HIERARCHY.filter((_, i) => i >= userIndex).map(role => ({
            value: role,
            label: ROLE_CONFIG[role]?.label || role
        }));
    }
    
    // Otros roles solo pueden asignar roles iguales o inferiores a ellos
    return ROLE_HIERARCHY.filter((_, i) => i >= userIndex).map(role => ({
        value: role,
        label: ROLE_CONFIG[role]?.label || role
    }));
}

// Exportar para uso en modulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ROLE_HIERARCHY,
        ROLE_CONFIG,
        ROLE_PANELS,
        canManage,
        canView,
        getRolePanel,
        getRoleConfig,
        getRoleIndex,
        isRoleAbove,
        isRoleAtLeast,
        getAllRoles,
        getAssignableRoles
    };
}
