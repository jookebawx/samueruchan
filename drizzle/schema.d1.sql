CREATE TABLE users (
  id integer primary key autoincrement,
  openId text not null unique,
  name text,
  email text,
  avatarUrl text,
  loginMethod text,
  role text not null default 'user',
  createdAt integer not null default (unixepoch() * 1000),
  updatedAt integer not null default (unixepoch() * 1000),
  lastSignedIn integer not null default (unixepoch() * 1000)
);

CREATE TABLE case_studies (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  thumbnail_url text,
  thumbnail_key text,
  category text not null,
  tools text not null,
  challenge text not null,
  solution text not null,
  steps text not null,
  impact text,
  tags text not null,
  is_recommended integer not null default 0,
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000)
);

CREATE TABLE favorites (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  case_study_id integer not null references case_studies(id) on delete cascade,
  created_at integer not null default (unixepoch() * 1000)
);

CREATE UNIQUE INDEX favorites_user_case_unique
  ON favorites(user_id, case_study_id);

CREATE TABLE reports (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  case_study_id integer not null references case_studies(id) on delete cascade,
  created_at integer not null default (unixepoch() * 1000)
);

CREATE UNIQUE INDEX reports_user_case_unique
  ON reports(user_id, case_study_id);

CREATE TABLE quests (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  content text not null,
  status text not null default 'open',
  solved_answer_id integer,
  solver_user_id integer,
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000),
  closed_at integer
);

CREATE INDEX quests_status_idx
  ON quests(status);

CREATE TABLE quest_answers (
  id integer primary key autoincrement,
  quest_id integer not null references quests(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  content text not null,
  created_at integer not null default (unixepoch() * 1000),
  updated_at integer not null default (unixepoch() * 1000)
);

CREATE INDEX quest_answers_quest_idx
  ON quest_answers(quest_id);
