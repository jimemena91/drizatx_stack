import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiError } from "@/lib/api-client";

describe("apiClient.getRolesWithPermissions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ApiClientConstructor = (apiClient as any).constructor as { new (): typeof apiClient };

  it.each([401, 403])("returns [] when API responds with %s", async (status) => {
    const client = new ApiClientConstructor();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const requestMock = vi.fn().mockRejectedValue(new ApiError(status, "Forbidden"));
    (client as any).request = requestMock;

    const result = await client.getRolesWithPermissions();

    expect(result).toEqual([]);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `[api] rolesWithPermissions sin autorización (${status}), devolviendo [].`,
    );
  });
});
