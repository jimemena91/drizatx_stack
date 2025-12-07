import React, { useEffect } from "react";
import { render, waitFor, screen } from "@testing-library/react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

import { AuthProvider, useAuth } from "../auth-context";
import { ApiError } from "@/lib/api-client";

const mockSetAuthToken = vi.fn();
const mockGetCurrentUserPermissions = vi.fn();
const mockGetRolesWithPermissions = vi.fn();
const mockLoginWithUsername = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/api-mode", () => ({
  isApiMode: () => true,
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api-client")>("../../lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      setAuthToken: mockSetAuthToken,
      getCurrentUserPermissions: mockGetCurrentUserPermissions,
      getRolesWithPermissions: mockGetRolesWithPermissions,
      loginWithUsername: mockLoginWithUsername,
    },
  };
});

function LoginHarness() {
  const { login, state } = useAuth();

  useEffect(() => {
    void login({ username: "operator", password: "secret" });
  }, [login]);

  return (
    <div>
      <span data-testid="auth-status">{state.isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="permission-count">{state.permissions.length}</span>
      <span data-testid="role-permission-count">{Object.keys(state.rolePermissions ?? {}).length}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetCurrentUserPermissions.mockReset();
    mockGetRolesWithPermissions.mockReset();
    mockGetCurrentUserPermissions.mockResolvedValue(["view_dashboard"]);
    mockGetRolesWithPermissions.mockResolvedValue([
      {
        id: 1,
        slug: "admin",
        name: "Admin",
        permissions: ["manage_settings"],
      },
    ]);
    mockLoginWithUsername.mockResolvedValue({
      token: "token-123",
      user: {
        id: 1,
        username: "operator",
        email: "operator@example.com",
        name: "Operator",
        role: "SUPERVISOR",
        active: true,
        position: "Desk",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ["view_dashboard"],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch role permissions when API denies admin capabilities", async () => {
    mockGetCurrentUserPermissions.mockResolvedValueOnce(["view_dashboard"]);
    mockGetCurrentUserPermissions.mockResolvedValueOnce(["manage_settings"]);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("yes"));
    await waitFor(() => expect(screen.getByTestId("permission-count")).toHaveTextContent("1"));

    expect(mockGetRolesWithPermissions).not.toHaveBeenCalled();
    const tooManyRerendersLogged = consoleError.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("Too many re-renders")),
    );
    expect(tooManyRerendersLogged).toBe(false);

    consoleError.mockRestore();
  });

  it("skips role catalog when fallback suggests admin but API does not", async () => {
    mockLoginWithUsername.mockResolvedValueOnce({
      token: "token-123",
      user: {
        id: 1,
        username: "operator",
        email: "operator@example.com",
        name: "Operator",
        role: "SUPERVISOR",
        active: true,
        position: "Desk",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ["manage_roles"],
      },
    });
    mockGetCurrentUserPermissions.mockResolvedValue(["view_dashboard"]);

    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("yes"));
    await waitFor(() => expect(screen.getByTestId("permission-count")).toHaveTextContent("1"));

    expect(mockGetRolesWithPermissions).not.toHaveBeenCalled();
  });

  it("keeps authentication working when role permissions API responds 403", async () => {
    mockGetCurrentUserPermissions.mockResolvedValue(["manage_roles"]);
    mockGetRolesWithPermissions.mockRejectedValue(new ApiError(403, "Forbidden"));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("yes"));
    await waitFor(() => expect(screen.getByTestId("permission-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("role-permission-count")).toHaveTextContent("0");
    expect(mockGetRolesWithPermissions).toHaveBeenCalledTimes(1);

    const unauthorizedLogged = consoleWarn.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" && arg.includes("[AuthProvider] rolesWithPermissions sin autorización (403)"),
      ),
    );
    expect(unauthorizedLogged).toBe(true);

    consoleWarn.mockRestore();
  });
});
