/**
 * db-schema.js - Centralized Database Schema for Alliance Hub
 * v18: Single source of truth for all table names and column definitions
 *
 * Usage:
 *   DB.from('players').select(DB.cols.players.basic).eq('id', 1)
 *   DB.selectAll('alliances')
 *   DB.from('matches').select('*').eq(DB.cols.matches.status, 'open')
 *
 * Benefits:
 *   - Table/column names defined once, used everywhere
 *   - Changing a column name requires editing only this file
 *   - Active filters handle missing is_active columns gracefully
 */

var DB = (function() {
    'use strict';

    // ===================== TABLE & COLUMN DEFINITIONS =====================
    var TABLES = {
        // Core entities
        players: {
            name: 'players',
            cols: {
                id: 'id',
                username: 'current_username',
                allianceId: 'current_alliance_id',
                kills: 'total_kills',
                deaths: 'total_deaths',
                gamesPlayed: 'games_played',
                wins: 'wins',
                kdRatio: 'kd_ratio',
                status: 'status',
                lastSeen: 'last_seen',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                basic: 'id, current_username, current_alliance_id, total_kills, total_deaths, games_played, wins, kd_ratio, status',
                ranking: 'id, current_username, current_alliance_id, games_played, total_kills, total_deaths, wins, kd_ratio, status, last_seen',
                full: '*'
            },
            orderBy: 'current_username'
        },
        alliances: {
            name: 'alliances',
            cols: {
                id: 'id',
                name: 'name',
                tag: 'tag',
                description: 'description',
                active: 'active',
                createdAt: 'created_at'
            },
            hasIsActive: false, // uses 'active' instead
            activeFilter: { col: 'active', val: true },
            selectSets: {
                basic: 'id, name, tag, description',
                full: '*'
            },
            orderBy: 'name'
        },
        matches: {
            name: 'matches',
            cols: {
                id: 'id',
                name: 'name',
                description: 'description',
                matchType: 'match_type',
                status: 'status',
                allianceId: 'alliance_id',
                allianceAId: 'alliance_a_id',
                allianceBId: 'alliance_b_id',
                maxPlayers: 'max_players',
                isPrivate: 'is_private',
                shareToken: 'share_token',
                password: 'password',
                gameId: 'game_id',
                gamePassword: 'game_password',
                requiresApproval: 'requires_approval',
                winnersDeclared: 'winners_declared',
                csvImported: 'csv_imported',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                basic: 'id, name, description, match_type, status, alliance_id, alliance_a_id, alliance_b_id, max_players, is_private, requires_approval, winners_declared, csv_imported, created_at',
                full: '*'
            },
            orderBy: 'created_at'
        },
        matchRegistrations: {
            name: 'match_registrations',
            cols: {
                id: 'id',
                matchId: 'match_id',
                playerId: 'player_id',
                username: 'username',
                nation: 'nation',
                status: 'status',
                registeredAt: 'registered_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'registered_at'
        },
        matchResults: {
            name: 'match_results',
            cols: {
                id: 'id',
                matchId: 'match_id',
                playerId: 'player_id',
                nation: 'nation',
                kills: 'kills',
                deaths: 'deaths',
                kdRatio: 'kd_ratio'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'kd_ratio'
        },
        matchWinners: {
            name: 'match_winners',
            cols: {
                id: 'id',
                matchId: 'match_id',
                playerId: 'player_id',
                position: 'position'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'position'
        },
        allianceMemberships: {
            name: 'alliance_memberships',
            cols: {
                id: 'id',
                playerId: 'player_id',
                allianceId: 'alliance_id',
                status: 'status',
                role: 'role',
                requestedBy: 'requested_by',
                requestedAt: 'requested_at',
                approvedAt: 'approved_at',
                joinedAt: 'joined_at'
            },
            hasIsActive: false,
            selectSets: {
                basic: 'player_id, alliance_id, status, role, requested_by, requested_at, approved_at, joined_at',
                full: '*'
            },
            orderBy: 'joined_at'
        },
        ruleSections: {
            name: 'rule_sections',
            cols: {
                id: 'id',
                title: 'title',
                content: 'content',
                visibility: 'visibility',
                orderIndex: 'order_index',
                isActive: 'is_active'
            },
            hasIsActive: true,
            activeFilter: { col: 'is_active', val: true },
            selectSets: {
                basic: 'id, title, content, visibility, order_index',
                full: '*'
            },
            orderBy: 'order_index'
        },
        rulePrecedents: {
            name: 'rule_precedents',
            cols: {
                id: 'id',
                title: 'title',
                description: 'description',
                ruleSectionId: 'rule_section_id',
                severity: 'severity',
                strikeType: 'strike_type',
                resolution: 'resolution',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                basic: 'id, title, description, rule_section_id, severity, strike_type, resolution, created_at',
                full: '*'
            },
            orderBy: 'created_at'
        },
        playerReports: {
            name: 'player_reports',
            cols: {
                id: 'id',
                reportedPlayerId: 'reported_player_id',
                reporterPlayerId: 'reporter_player_id',
                ruleSectionId: 'rule_section_id',
                description: 'description',
                evidenceUrl: 'evidence_url',
                status: 'status',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        playerStrikes: {
            name: 'player_strikes',
            cols: {
                id: 'id',
                playerId: 'player_id',
                isActive: 'is_active',
                createdAt: 'created_at'
            },
            hasIsActive: true,
            activeFilter: { col: 'is_active', val: true },
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        playerSanctions: {
            name: 'player_sanctions',
            cols: {
                id: 'id',
                playerId: 'player_id',
                killsAfter: 'kills_after',
                penaltyPct: 'penalty_pct',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        matchNullifiedKills: {
            name: 'match_nullified_kills',
            cols: {
                id: 'id',
                playerId: 'player_id',
                killsNullified: 'kills_nullified'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'id'
        },
        allianceOfficers: {
            name: 'alliance_officers',
            cols: {
                id: 'id',
                playerId: 'player_id',
                allianceId: 'alliance_id',
                role: 'role',
                title: 'title',
                permissions: 'permissions',
                isActive: 'is_active'
            },
            hasIsActive: true,
            activeFilter: { col: 'is_active', val: true },
            selectSets: {
                full: '*'
            },
            orderBy: 'id'
        },
        adminUsers: {
            name: 'admin_users',
            cols: {
                id: 'id',
                role: 'role',
                allianceId: 'alliance_id',
                status: 'status',
                displayName: 'display_name',
                supremacyPlayerId: 'supremacy_player_id'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        adminInvites: {
            name: 'admin_invites',
            cols: {
                id: 'id',
                code: 'code',
                role: 'role',
                used: 'used',
                createdAt: 'created_at',
                expiresAt: 'expires_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        allianceLeaderRequests: {
            name: 'alliance_leader_requests',
            cols: {
                id: 'id',
                requesterPlayerId: 'requester_player_id',
                status: 'status',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        chatMessages: {
            name: 'chat_messages',
            cols: {
                id: 'id',
                channel: 'channel',
                senderName: 'sender_name',
                senderAdminId: 'sender_admin_id',
                senderRole: 'sender_role',
                message: 'message',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        directMessages: {
            name: 'direct_messages',
            cols: {
                id: 'id',
                senderAdminId: 'sender_admin_id',
                recipientAdminId: 'recipient_admin_id',
                content: 'content',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        notifications: {
            name: 'notifications',
            cols: {
                id: 'id',
                userId: 'user_id',
                title: 'title',
                message: 'message',
                isRead: 'is_read',
                createdAt: 'created_at'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'created_at'
        },
        pushSubscriptions: {
            name: 'push_subscriptions',
            cols: {
                id: 'id',
                endpoint: 'endpoint',
                playerId: 'player_id'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'id'
        },
        playerTokens: {
            name: 'player_tokens',
            cols: {
                id: 'id',
                playerId: 'player_id',
                token: 'token'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'id'
        },
        strikeTypes: {
            name: 'strike_types',
            cols: {
                id: 'id',
                name: 'name',
                severity: 'severity'
            },
            hasIsActive: false,
            selectSets: {
                full: '*'
            },
            orderBy: 'severity'
        }
    };

    // ===================== PUBLIC API =====================

    var cols = {};
    for (var key in TABLES) {
        if (TABLES[key].selectSets) {
            cols[key] = TABLES[key].selectSets;
        }
    }

    /**
     * Start a query builder chain for a table.
     * Usage: DB.from('players').select(DB.cols.players.basic).eq('id', 1)
     */
    function from(tableKey) {
        var t = TABLES[tableKey];
        if (!t) { console.error('[DB] Unknown table key:', tableKey); return null; }
        return supabase.from(t.name);
    }

    /**
     * Select all records from a table with active filter applied.
     * Usage: DB.selectAll('alliances')
     */
    function selectAll(tableKey) {
        var t = TABLES[tableKey];
        if (!t) { console.error('[DB] Unknown table key:', tableKey); return null; }
        var q = supabase.from(t.name).select(t.selectSets.basic || '*');
        return applyActiveFilter(q, t);
    }

    /**
     * Select a single record by ID.
     * Usage: DB.selectById('players', 123)
     */
    function selectById(tableKey, id) {
        var t = TABLES[tableKey];
        if (!t) { console.error('[DB] Unknown table key:', tableKey); return null; }
        return supabase.from(t.name).select(t.selectSets.basic || '*').eq('id', id).single();
    }

    /**
     * Get the column name for a table key and column key.
     * Usage: DB.col('players', 'username') -> 'current_username'
     */
    function col(tableKey, colKey) {
        var t = TABLES[tableKey];
        if (!t) return null;
        return t.cols[colKey] || colKey;
    }

    /**
     * Get the full column definitions for a table.
     * Usage: DB.tableCols('players') -> { id: 'id', username: 'current_username', ... }
     */
    function tableCols(tableKey) {
        var t = TABLES[tableKey];
        if (!t) return null;
        return t.cols;
    }

    /**
     * Get the raw table name.
     * Usage: DB.tableName('players') -> 'players'
     */
    function tableName(tableKey) {
        var t = TABLES[tableKey];
        if (!t) return tableKey;
        return t.name;
    }

    /**
     * Get the active filter for a table, if any.
     * Returns { col, val } or null.
     */
    function activeFilter(tableKey) {
        var t = TABLES[tableKey];
        if (!t) return null;
        if (t.activeFilter) return t.activeFilter;
        if (t.hasIsActive) return { col: 'is_active', val: true };
        return null;
    }

    // ===================== INTERNAL HELPERS =====================

    function applyActiveFilter(query, tableDef) {
        if (!tableDef) return query;
        if (tableDef.activeFilter) {
            return query.eq(tableDef.activeFilter.col, tableDef.activeFilter.val);
        }
        return query;
    }

    // ===================== EXPORTS =====================

    return {
        from: from,
        selectAll: selectAll,
        selectById: selectById,
        col: col,
        tableCols: tableCols,
        tableName: tableName,
        cols: cols,
        activeFilter: activeFilter,
        // Raw tables access for debugging
        _tables: TABLES
    };
})();

window.DB = DB;
