export const ROLE_TEMPLATES = [
  'React Developer',
  'Node.js / Backend Developer',
  'Full Stack Engineer',
  'Python Developer',
  'Data Engineer',
  'DevOps / Platform Engineer',
  'Mobile Developer (React Native)',
  'Technical Product Manager',
] as const

export type RoleTemplate = typeof ROLE_TEMPLATES[number]
