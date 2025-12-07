import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { Permission as PermissionEntity } from '../../entities/permission.entity';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { PERMISSION_SLUG_ALIASES } from '../../common/enums/permission.enum';
import { PERMISSION_CATALOG, PermissionCatalogEntry, mapToClientSlug } from './permission-catalog';

type RoleResponse = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
};

type PermissionResponse = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  module: string;
  moduleLabel: string;
  order: number;
};

@Injectable()
export class AclService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepo: Repository<RolePermission>,
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepo: Repository<PermissionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureCatalogPermissions();
    await this.ensureAdminHasManageRoles();
  }

  async listRoles(): Promise<RoleResponse[]> {
    const roles = await this.rolesRepo.find({
      relations: {
        rolePermissions: { permission: true },
      },
      order: { name: 'ASC' },
    });

    return roles.map((role) => this.formatRole(role));
  }

  async listPermissions(): Promise<PermissionResponse[]> {
    const permissions = await this.permissionsRepo.find({ order: { slug: 'ASC' } });

    const entries = permissions.map((permission) => {
      const slug = this.toClientPermissionSlug(permission.slug);
      const catalog = this.lookupCatalog(permission.slug) ?? this.lookupCatalog(slug);

      return {
        id: permission.id,
        slug,
        name: permission.name,
        description: permission.description ?? null,
        module: catalog?.module ?? 'general',
        moduleLabel: catalog?.moduleLabel ?? 'General',
        order: catalog?.order ?? 1000,
      } satisfies PermissionResponse;
    });

    const knownSlugs = new Set(entries.map((entry) => entry.slug));
    // Asegura que permisos declarados en catálogo sin registro en DB igual aparezcan.
    for (const catalog of PERMISSION_CATALOG) {
      const clientSlug = mapToClientSlug(catalog.slug);
      if (!knownSlugs.has(clientSlug)) {
        entries.push({
          id: 0,
          slug: clientSlug,
          name: catalog.name,
          description: catalog.description ?? null,
          module: catalog.module,
          moduleLabel: catalog.moduleLabel,
          order: catalog.order,
        });
      }
    }

    return entries
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }

  async createRole(dto: CreateRoleDto): Promise<RoleResponse> {
    const slug = this.normalizeRoleSlug(dto.slug);
    const existing = await this.rolesRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Ya existe un rol con slug ${slug}`);
    }

    const role = this.rolesRepo.create({
      slug,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
    });

    const saved = await this.rolesRepo.save(role);

    if (Array.isArray(dto.permissions)) {
      await this.replaceRolePermissions(saved.id, dto.permissions);
    }

    const withRelations = await this.rolesRepo.findOne({
      where: { id: saved.id },
      relations: { rolePermissions: { permission: true } },
    });

    if (!withRelations) {
      throw new NotFoundException('Rol creado pero no encontrado');
    }

    return this.formatRole(withRelations);
  }

  async updateRole(id: number, dto: UpdateRoleDto): Promise<RoleResponse> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (dto.slug) {
      const slug = this.normalizeRoleSlug(dto.slug);
      const existing = await this.rolesRepo.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Ya existe un rol con slug ${slug}`);
      }
      role.slug = slug;
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede quedar vacío');
      }
      role.name = name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description?.trim() || null;
    }

    await this.rolesRepo.save(role);

    if (Array.isArray(dto.permissions)) {
      await this.replaceRolePermissions(role.id, dto.permissions);
    }

    const withRelations = await this.rolesRepo.findOne({
      where: { id: role.id },
      relations: { rolePermissions: { permission: true } },
    });

    if (!withRelations) {
      throw new NotFoundException('Rol actualizado pero no encontrado');
    }

    return this.formatRole(withRelations);
  }

  async updateRolePermissions(id: number, dto: UpdateRolePermissionsDto): Promise<RoleResponse> {
    await this.replaceRolePermissions(id, dto.permissions);

    const withRelations = await this.rolesRepo.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });

    if (!withRelations) {
      throw new NotFoundException('Rol no encontrado');
    }

    return this.formatRole(withRelations);
  }

  private lookupCatalog(slug: string): PermissionCatalogEntry | undefined {
    const normalized = String(slug ?? '').toLowerCase();
    return (
      PERMISSION_CATALOG.find((entry) => entry.slug === normalized) ||
      PERMISSION_CATALOG.find((entry) => entry.legacySlugs?.includes(normalized))
    );
  }

  private normalizeRoleSlug(slug: string): string {
    const trimmed = String(slug ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('El slug del rol es obligatorio');
    }
    return trimmed.toUpperCase();
  }

  private toClientPermissionSlug(slug: string): string {
    const normalized = String(slug ?? '').toLowerCase();
    return mapToClientSlug(normalized);
  }

  private toStoragePermissionSlugs(slugs: string[]): string[] {
    const normalized = (Array.isArray(slugs) ? slugs : [])
      .map((slug) => String(slug ?? '').toLowerCase())
      .filter((slug) => slug);

    return normalized.map((slug) => PERMISSION_SLUG_ALIASES[slug] ?? slug);
  }

  private async replaceRolePermissions(roleId: number, permissions: string[]): Promise<void> {
    const role = await this.rolesRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    const normalized = [...new Set(this.toStoragePermissionSlugs(permissions))];
    if (normalized.length === 0) {
      await this.rolePermissionsRepo.delete({ roleId });
      return;
    }

    const permissionEntities = await this.permissionsRepo.find({
      where: { slug: In(normalized) as any },
    });

    const missing = normalized.filter(
      (slug) => !permissionEntities.some((perm) => perm.slug === slug),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Los siguientes permisos no existen: ${missing.join(', ')}`,
      );
    }

    await this.rolePermissionsRepo.delete({ roleId });

    const links = permissionEntities.map((permission) =>
      this.rolePermissionsRepo.create({ roleId, permissionId: permission.id }),
    );

    if (links.length > 0) {
      await this.rolePermissionsRepo.save(links);
    }
  }

  private formatRole(role: Role): RoleResponse {
    const permissions = Array.from(
      new Set(
        (role.rolePermissions ?? [])
          .map((link) => link.permission?.slug ?? null)
          .filter((slug): slug is string => !!slug)
          .map((slug) => this.toClientPermissionSlug(slug)),
      ),
    ).sort();

    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description ?? null,
      permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private async ensureCatalogPermissions(): Promise<void> {
    for (const entry of PERMISSION_CATALOG) {
      const slug = String(entry.slug);
      let permission = await this.permissionsRepo.findOne({ where: { slug } });

      if (!permission) {
        permission = this.permissionsRepo.create({
          slug,
          name: entry.name,
          description: entry.description ?? null,
        });
        await this.permissionsRepo.save(permission);
      }
    }
  }

  private async ensureAdminHasManageRoles(): Promise<void> {
    const adminRole = await this.rolesRepo.findOne({ where: { slug: 'ADMIN' } });
    if (!adminRole) {
      return;
    }

    const manageRoles = await this.permissionsRepo.findOne({ where: { slug: 'manage_roles' } });
    if (!manageRoles) {
      return;
    }

    const existingLink = await this.rolePermissionsRepo.findOne({
      where: { roleId: adminRole.id, permissionId: manageRoles.id },
    });

    if (!existingLink) {
      await this.rolePermissionsRepo.save(
        this.rolePermissionsRepo.create({
          roleId: adminRole.id,
          permissionId: manageRoles.id,
        }),
      );
    }
  }
}
