-- auth-service owns sessions, password resets and the sign-in history. IF NOT EXISTS everywhere: safe on the
-- Laravel-built database. user_id / tokenable_id are users.id (user-service), referenced by id only.

-- One row per signed-in session: bearer tokens are "<id>|<secret>", the SHA-256 of the secret is stored
create table if not exists personal_access_tokens (
  id bigserial primary key,
  tokenable_type varchar(255) not null,
  tokenable_id bigint not null,
  name text not null, -- the browser's user agent
  token varchar(64) not null constraint personal_access_tokens_token_unique unique,
  abilities text,
  ip_address varchar(45),
  location varchar(120),
  location_source varchar(10), -- device | ip
  last_used_at timestamp(0),
  ended_at timestamp(0),
  ended_reason varchar(60),
  expires_at timestamp(0),
  created_at timestamp(0),
  updated_at timestamp(0)
);
create index if not exists personal_access_tokens_tokenable_type_tokenable_id_index on personal_access_tokens (tokenable_type, tokenable_id);
create index if not exists personal_access_tokens_expires_at_index on personal_access_tokens (expires_at);

create table if not exists password_reset_tokens (
  email varchar(255) primary key,
  token varchar(255) not null, -- bcrypt hash of the emailed token
  created_at timestamp(0)
);

-- Every sign-in, kept for access reviews of past periods
create table if not exists account_sign_ins (
  id bigserial primary key,
  user_id bigint not null,
  signed_in_at timestamp(0) not null,
  recorded_at timestamp(0) not null
);
create index if not exists account_sign_ins_user_id_signed_in_at_index on account_sign_ins (user_id, signed_in_at);
