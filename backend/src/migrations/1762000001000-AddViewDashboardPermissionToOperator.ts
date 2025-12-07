import { MigrationInterface, QueryRunner } from 'typeorm';
import { buildRolePermissionsMap } from './helpers/role-permissions-map';

export class AddViewDashboardPermissionToOperator1762000001000 implements MigrationInterface {
  name = 'AddViewDashboardPermissionToOperator1762000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles = (await queryRunner.query(
      `SELECT id, slug FROM \`roles\``,
    )) as Array<{ id: number; slug: string }>;

    const permissions = (await queryRunner.query(
      `SELECT id, slug FROM \`permissions\``,
    )) as Array<{ id: number; slug: string }>;

    if (!roles.length || !permissions.length) {
      return;
    }

    const roleIdBySlug = new Map<string, number>();
    for (const role of roles) {
      roleIdBySlug.set(String(role.slug ?? '').toUpperCase(), role.id);
    }

    const permissionIdBySlug = new Map<string, number>();
    for (const permission of permissions) {
      permissionIdBySlug.set(String(permission.slug ?? '').toLowerCase(), permission.id);
    }

    const allPermissionSlugs = permissions.map((permission) => String(permission.slug ?? ''));
    const rolePermissionsMap = buildRolePermissionsMap(allPermissionSlugs);
    const operatorPermissions = new Set(rolePermissionsMap.OPERATOR ?? []);

    const operatorRoleId = roleIdBySlug.get('OPERATOR');
    if (!operatorRoleId || operatorPermissions.size === 0) {
      return;
    }

    for (const permissionSlug of operatorPermissions) {
      const permissionId = permissionIdBySlug.get(String(permissionSlug ?? '').toLowerCase());
      if (!permissionId) {
        continue;
      }

      const [existing] = (await queryRunner.query(
        `SELECT id FROM \`role_permissions\` WHERE \`role_id\` = ? AND \`permission_id\` = ? LIMIT 1`,
        [operatorRoleId, permissionId],
      )) as Array<{ id: number }>;

      if (!existing) {
        await queryRunner.query(
          `INSERT INTO \`role_permissions\` (\`role_id\`, \`permission_id\`) VALUES (?, ?)`,
          [operatorRoleId, permissionId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [operatorRole] = (await queryRunner.query(
      `SELECT id FROM \`roles\` WHERE \`slug\` = ? LIMIT 1`,
      ['OPERATOR'],
    )) as Array<{ id: number }>;

    const [viewDashboard] = (await queryRunner.query(
      `SELECT id FROM \`permissions\` WHERE \`slug\` = ? LIMIT 1`,
      ['view_dashboard'],
    )) as Array<{ id: number }>;

    if (!operatorRole?.id || !viewDashboard?.id) {
      return;
    }

    await queryRunner.query(
      `DELETE FROM \`role_permissions\` WHERE \`role_id\` = ? AND \`permission_id\` = ?`,
      [operatorRole.id, viewDashboard.id],
    );
  }
}
