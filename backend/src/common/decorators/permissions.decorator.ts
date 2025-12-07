import { SetMetadata } from '@nestjs/common';

import type { AppPermission } from '../../common/enums/permission.enum';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
