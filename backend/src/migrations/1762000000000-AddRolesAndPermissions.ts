import { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from "bcryptjs";
import { buildRolePermissionsMap } from "./helpers/role-permissions-map";

export class AddRolesAndPermissions1762000000000 implements MigrationInterface {
    name = 'AddRolesAndPermissions1762000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`roles\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(100) NOT NULL, \`name\` varchar(150) NOT NULL, \`description\` varchar(255) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_roles_slug\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`permissions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(100) NOT NULL, \`name\` varchar(150) NOT NULL, \`description\` varchar(255) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_permissions_slug\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`role_permissions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`role_id\` int NOT NULL, \`permission_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_role_permissions_unique\` (\`role_id\`, \`permission_id\`), INDEX \`IDX_role_permissions_permission\` (\`permission_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`operator_roles\` (\`id\` int NOT NULL AUTO_INCREMENT, \`operator_id\` int NOT NULL, \`role_id\` int NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_operator_roles_unique\` (\`operator_id\`, \`role_id\`), INDEX \`IDX_operator_roles_role\` (\`role_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_role_permissions_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_role_permissions_permission\` FOREIGN KEY (\`permission_id\`) REFERENCES \`permissions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`operator_roles\` ADD CONSTRAINT \`FK_operator_roles_operator\` FOREIGN KEY (\`operator_id\`) REFERENCES \`operators\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`operator_roles\` ADD CONSTRAINT \`FK_operator_roles_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);

        const roleSeeds = [
            { slug: 'SUPERADMIN', name: 'Super Administrador', description: 'Acceso irrestricto y bypass de ACL' },
            { slug: 'ADMIN', name: 'Administrador', description: 'Acceso completo al sistema' },
            { slug: 'SUPERVISOR', name: 'Supervisor', description: 'Gestión y monitoreo de operaciones' },
            { slug: 'OPERATOR', name: 'Operador', description: 'Atiende tickets y operaciones básicas' },
        ];
        for (const role of roleSeeds) {
            await queryRunner.query(`INSERT INTO \`roles\` (\`slug\`, \`name\`, \`description\`) VALUES (?, ?, ?)`, [role.slug, role.name, role.description]);
        }

        const permissionSeeds = [
            { slug: 'view_dashboard', name: 'Ver dashboard', description: 'Acceder al panel principal e indicadores resumidos' },
            { slug: 'manage_clients', name: 'Gestionar clientes', description: 'Crear y administrar fichas de clientes' },
            { slug: 'manage_services', name: 'Gestionar servicios', description: 'Administrar configuraciones de servicios' },
            { slug: 'manage_operators', name: 'Gestionar operadores', description: 'Crear, editar y desactivar operadores' },
            { slug: 'serve_tickets', name: 'Atender tickets', description: 'Llamar y gestionar tickets de clientes' },
            { slug: 'view_reports', name: 'Ver reportes', description: 'Acceder a paneles y reportes operativos' },
            { slug: 'manage_roles', name: 'Administrar roles y permisos', description: 'Configurar roles del sistema' },
            { slug: 'manage_settings', name: 'Configurar sistema', description: 'Modificar ajustes globales de la plataforma' },
            { slug: 'view_system_logs', name: 'Ver auditoría', description: 'Consultar registros de auditoría' },
        ];
        for (const permission of permissionSeeds) {
            await queryRunner.query(`INSERT INTO \`permissions\` (\`slug\`, \`name\`, \`description\`) VALUES (?, ?, ?)`, [permission.slug, permission.name, permission.description]);
        }

        const roles = (await queryRunner.query(`SELECT id, slug FROM \`roles\``)) as Array<{ id: number; slug: string }>;
        const roleIdBySlug = new Map<string, number>();
        for (const role of roles) {
            roleIdBySlug.set(role.slug.toUpperCase(), role.id);
        }

        const permissions = (await queryRunner.query(`SELECT id, slug FROM \`permissions\``)) as Array<{ id: number; slug: string }>;
        const permissionIdBySlug = new Map<string, number>();
        for (const permission of permissions) {
            permissionIdBySlug.set(permission.slug.toLowerCase(), permission.id);
        }

        const allPermissionSlugs = permissions.map((permission) => String(permission.slug).toLowerCase());

        const rolePermissionsMap = buildRolePermissionsMap(allPermissionSlugs);

        for (const [slug, perms] of Object.entries(rolePermissionsMap)) {
            const roleId = roleIdBySlug.get(slug);
            if (!roleId) continue;
            for (const permSlug of perms) {
                const permId = permissionIdBySlug.get(permSlug);
                if (!permId) continue;
                await queryRunner.query(`INSERT INTO \`role_permissions\` (\`role_id\`, \`permission_id\`) VALUES (?, ?)`, [roleId, permId]);
            }
        }

        const operators = (await queryRunner.query(`SELECT id, role FROM \`operators\``)) as Array<{ id: number; role: string | null }>;
        for (const operator of operators) {
            const slug = (operator.role ?? 'OPERATOR').toUpperCase();
            const roleId = roleIdBySlug.get(slug) ?? roleIdBySlug.get('OPERATOR');
            if (!roleId) continue;
            await queryRunner.query(`INSERT INTO \`operator_roles\` (\`operator_id\`, \`role_id\`) VALUES (?, ?)`, [operator.id, roleId]);
        }

        await queryRunner.query(`ALTER TABLE \`operators\` DROP COLUMN \`role\``);

        const superAdminRoleId = roleIdBySlug.get('SUPERADMIN');
        if (superAdminRoleId) {
            const [existingSuperAdmin] = await queryRunner.query(
                `SELECT 1 FROM \`operator_roles\` WHERE \`role_id\` = ? LIMIT 1`,
                [superAdminRoleId],
            );

            if (!existingSuperAdmin) {
                const [preexisting] = (await queryRunner.query(
                    `SELECT id FROM \`operators\` WHERE TRIM(LOWER(username)) = 'superadmin' OR TRIM(LOWER(email)) = 'superadmin@drizatx.com' LIMIT 1`,
                )) as Array<{ id: number }>;

                let operatorId = preexisting?.id ?? null;

                if (!operatorId) {
                    const passwordHash = await bcrypt.hash('superadmin123', 10);
                    const result: any = await queryRunner.query(
                        `INSERT INTO \`operators\` (\`name\`, \`username\`, \`email\`, \`password_hash\`, \`position\`, \`active\`)
                         VALUES (?, ?, ?, ?, ?, 1)`,
                        ['Super Administrador', 'superadmin', 'superadmin@drizatx.com', passwordHash, 'SuperAdmin'],
                    );

                    if (typeof result?.insertId === 'number') {
                        operatorId = result.insertId;
                    } else {
                        const [lookup] = (await queryRunner.query(
                            `SELECT id FROM \`operators\` WHERE TRIM(LOWER(username)) = 'superadmin' ORDER BY id DESC LIMIT 1`,
                        )) as Array<{ id: number }>;
                        operatorId = lookup?.id ?? null;
                    }
                }

                if (operatorId) {
                    await queryRunner.query(
                        `INSERT INTO \`operator_roles\` (\`operator_id\`, \`role_id\`) VALUES (?, ?)`,
                        [operatorId, superAdminRoleId],
                    );
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`operators\` ADD \`role\` varchar(30) NOT NULL DEFAULT 'OPERATOR'`);

        const operatorRoleRows = (await queryRunner.query(
            `SELECT oroles.operator_id as operatorId, r.slug as slug FROM \`operator_roles\` oroles INNER JOIN \`roles\` r ON r.id = oroles.role_id`,
        )) as Array<{ operatorId: number; slug: string }>;
        const ranking: Record<string, number> = { OPERATOR: 1, SUPERVISOR: 2, ADMIN: 3, SUPERADMIN: 4 };
        const bestRoleByOperator = new Map<number, { slug: string; rank: number }>();
        for (const row of operatorRoleRows) {
            const slug = (row.slug ?? 'OPERATOR').toUpperCase();
            const rank = ranking[slug] ?? 0;
            const current = bestRoleByOperator.get(row.operatorId);
            if (!current || rank > current.rank) {
                bestRoleByOperator.set(row.operatorId, { slug, rank });
            }
        }
        for (const [operatorId, info] of bestRoleByOperator.entries()) {
            await queryRunner.query(`UPDATE \`operators\` SET \`role\` = ? WHERE \`id\` = ?`, [info.slug, operatorId]);
        }

        await queryRunner.query(`ALTER TABLE \`operator_roles\` DROP FOREIGN KEY \`FK_operator_roles_role\``);
        await queryRunner.query(`ALTER TABLE \`operator_roles\` DROP FOREIGN KEY \`FK_operator_roles_operator\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_role_permissions_permission\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_role_permissions_role\``);

        await queryRunner.query(`DROP TABLE \`operator_roles\``);
        await queryRunner.query(`DROP TABLE \`role_permissions\``);
        await queryRunner.query(`DROP TABLE \`permissions\``);
        await queryRunner.query(`DROP TABLE \`roles\``);
    }
}
