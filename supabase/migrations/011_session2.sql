-- Migration 011: Session 2 — Company ID on projects

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id uuid references companies(id);
