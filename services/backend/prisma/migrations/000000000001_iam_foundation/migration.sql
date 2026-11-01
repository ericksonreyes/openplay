-- iam foundation tables (FOUNDATION plan: canonical seeds + identity boundary)
CREATE TABLE "iam_users" (
  "id"            UUID        NOT NULL,
  "scope"         TEXT        NOT NULL,
  "username"      TEXT,
  "email"         TEXT,
  "password_hash" TEXT,
  "display_name"  TEXT,
  "tenant_id"     UUID,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "iam_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_roles" (
  "id"   UUID NOT NULL,
  "key"  TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "iam_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_permissions" (
  "id"   UUID NOT NULL,
  "key"  TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "iam_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_role_permissions" (
  "role_id"       UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "iam_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "iam_role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "iam_roles" ("id") ON DELETE CASCADE,
  CONSTRAINT "iam_role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "iam_permissions" ("id") ON DELETE CASCADE
);

CREATE TABLE "iam_user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "iam_user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "iam_user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users" ("id") ON DELETE CASCADE,
  CONSTRAINT "iam_user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "iam_roles" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "iam_users_scope_username_key" ON "iam_users" ("scope", "username");
CREATE UNIQUE INDEX "iam_users_scope_email_key"    ON "iam_users" ("scope", "email");
CREATE UNIQUE INDEX "iam_roles_key"                ON "iam_roles" ("key");
CREATE UNIQUE INDEX "iam_permissions_key"          ON "iam_permissions" ("key");

-- Bound the pool so one bad query cannot hold every connection.
ALTER DATABASE "openplay" SET "statement_timeout" = '10s';
