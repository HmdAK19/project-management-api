import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.API_URL ?? "http://localhost:4000/api";
const runId = Date.now().toString(36);
const prisma = new PrismaClient();

const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? undefined : await response.json();
  return { status: response.status, payload };
};

const expectStatus = (result, expected, label) => {
  if (result.status !== expected) {
    throw new Error(
      `${label}: expected ${expected}, received ${result.status}\n${JSON.stringify(result.payload)}`,
    );
  }
  console.log(`✓ ${label}`);
};

const register = async (label) => {
  const result = await request("/auth/register", {
    method: "POST",
    body: {
      name: `RBAC ${label}`,
      email: `rbac-${label}-${runId}@example.test`,
      password: "Portfolio123!",
      confirmPassword: "Portfolio123!",
    },
  });
  expectStatus(result, 201, `register ${label}`);
  return {
    id: result.payload.user.id,
    token: result.payload.accessToken,
  };
};

const main = async () => {
  const owner = await register("owner");
  const admin = await register("admin");
  const member = await register("member");
  const viewer = await register("viewer");
  const outsider = await register("outsider");

  const created = await request("/projects", {
    token: owner.token,
    method: "POST",
    body: {
      name: `RBAC portfolio ${runId}`,
      key: `R${runId}`.slice(0, 10).toUpperCase(),
      category: "Integration test",
      rgb: "#635BFF",
    },
  });
  expectStatus(created, 201, "owner creates a private project");
  const projectId = created.payload.data.id;

  const addMember = async (userId, role) => {
    const result = await request(`/projects/${projectId}/members`, {
      token: owner.token,
      method: "POST",
      body: { userId, role },
    });
    expectStatus(result, 201, `owner adds ${role.toLowerCase()}`);
    return result.payload.data;
  };

  const adminMembership = await addMember(admin.id, "ADMIN");
  await addMember(member.id, "MEMBER");
  await addMember(viewer.id, "VIEWER");

  expectStatus(
    await request(`/projects/${projectId}`, { token: outsider.token }),
    403,
    "non-member cannot read the project",
  );
  expectStatus(
    await request(`/projects/${projectId}`, { token: viewer.token }),
    200,
    "viewer can read the project",
  );
  expectStatus(
    await request("/tasks", {
      token: viewer.token,
      method: "POST",
      body: { projectId, title: "Viewer must not create this" },
    }),
    403,
    "viewer cannot create tasks",
  );
  expectStatus(
    await request("/tasks", {
      token: member.token,
      method: "POST",
      body: { projectId, title: "Member-created task" },
    }),
    201,
    "member can create tasks",
  );
  expectStatus(
    await request("/sprints", {
      token: member.token,
      method: "POST",
      body: { projectId, name: "Forbidden member sprint" },
    }),
    403,
    "member cannot manage sprints",
  );
  expectStatus(
    await request(`/projects/${projectId}`, {
      token: admin.token,
      method: "PUT",
      body: {
        name: `RBAC portfolio ${runId}`,
        key: `R${runId}`.slice(0, 10).toUpperCase(),
        category: "Admin updated",
        rgb: "#635BFF",
      },
    }),
    200,
    "project admin can update settings",
  );
  expectStatus(
    await request(
      `/projects/${projectId}/members/${adminMembership.id}`,
      { token: admin.token, method: "DELETE" },
    ),
    400,
    "project admin cannot remove themself through member management",
  );
  expectStatus(
    await request(`/projects/${projectId}/members/me`, {
      token: viewer.token,
      method: "DELETE",
    }),
    204,
    "non-owner can leave the project",
  );
  expectStatus(
    await request(`/projects/${projectId}`, { token: viewer.token }),
    403,
    "access is revoked immediately after leaving",
  );

  const transfer = await request(
    `/projects/${projectId}/members/${adminMembership.id}/transfer-ownership`,
    { token: owner.token, method: "POST" },
  );
  expectStatus(transfer, 200, "owner transfers ownership");

  const projects = await request("/projects", { token: admin.token });
  expectStatus(projects, 200, "new owner can list the project");
  const transferredProject = projects.payload.data.data.find(
    (project) => project.id === projectId,
  );
  if (transferredProject?.leadId !== admin.id) {
    throw new Error("ownership transfer did not synchronize the project lead");
  }
  console.log("✓ ownership transfer synchronizes project lead");

  expectStatus(
    await request(`/projects/${projectId}`, {
      token: owner.token,
      method: "DELETE",
    }),
    403,
    "previous owner cannot delete after transfer",
  );
  expectStatus(
    await request(`/projects/${projectId}`, {
      token: admin.token,
      method: "DELETE",
    }),
    200,
    "new owner can delete the project",
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${runId}@example.test` } },
    });
    await prisma.$disconnect();
  });
