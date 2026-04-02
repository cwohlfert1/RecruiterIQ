export const ROLE_TEMPLATES = [
  'React Developer',
  'Node.js / Backend Developer',
  'Full Stack Engineer',
  'Python Developer',
  'Data Engineer',
  'Data Scientist',
  'SQL / Data Analyst',
  'SAP / ERP Consultant',
  'ServiceNow Developer',
  'Network Engineer',
  'GIS Analyst',
  'Cybersecurity Analyst',
  'DevOps / Platform Engineer',
  'Mobile Developer (React Native)',
  'Technical Product Manager',
] as const

export type RoleTemplate = typeof ROLE_TEMPLATES[number]

export type TemplateConfig = {
  role:        RoleTemplate
  label:       string
  description: string
  icon:        string
  accent:      string
  tags:        string[]
}

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    role:        'React Developer',
    label:       'React Developer',
    description: 'Component design, hooks, state management, performance optimization',
    icon:        '⚛️',
    accent:      'indigo',
    tags:        ['React', 'TypeScript', 'Hooks', 'Redux'],
  },
  {
    role:        'Full Stack Engineer',
    label:       'Full Stack Engineer',
    description: 'Frontend + backend, APIs, databases, deployment pipelines',
    icon:        '🔧',
    accent:      'violet',
    tags:        ['React', 'Node.js', 'SQL', 'REST'],
  },
  {
    role:        'Node.js / Backend Developer',
    label:       'Node.js / Backend Dev',
    description: 'REST APIs, authentication, database design, async patterns',
    icon:        '🟢',
    accent:      'emerald',
    tags:        ['Node.js', 'Express', 'PostgreSQL', 'Auth'],
  },
  {
    role:        'Python Developer',
    label:       'Python Developer',
    description: 'Python fundamentals, OOP, scripting, frameworks like FastAPI/Django',
    icon:        '🐍',
    accent:      'yellow',
    tags:        ['Python', 'FastAPI', 'OOP', 'Testing'],
  },
  {
    role:        'Data Engineer',
    label:       'Data Engineer',
    description: 'ETL pipelines, data modeling, Spark, cloud data warehouses',
    icon:        '🏗️',
    accent:      'orange',
    tags:        ['Spark', 'dbt', 'Airflow', 'SQL'],
  },
  {
    role:        'Data Scientist',
    label:       'Data Scientist',
    description: 'ML models, statistics, feature engineering, model evaluation',
    icon:        '🔬',
    accent:      'blue',
    tags:        ['Python', 'ML', 'Stats', 'Pandas'],
  },
  {
    role:        'SQL / Data Analyst',
    label:       'SQL / Data Analyst',
    description: 'Complex queries, aggregations, dashboards, business intelligence',
    icon:        '📊',
    accent:      'cyan',
    tags:        ['SQL', 'Tableau', 'Excel', 'BI'],
  },
  {
    role:        'SAP / ERP Consultant',
    label:       'SAP / ERP Consultant',
    description: 'SAP modules, ABAP, integration, business process configuration',
    icon:        '⚙️',
    accent:      'slate',
    tags:        ['SAP', 'ABAP', 'SD/MM', 'Integration'],
  },
  {
    role:        'ServiceNow Developer',
    label:       'ServiceNow Developer',
    description: 'Platform development, scripting, workflows, ITSM configuration',
    icon:        '🔄',
    accent:      'purple',
    tags:        ['ServiceNow', 'JavaScript', 'ITSM', 'Flows'],
  },
  {
    role:        'Network Engineer',
    label:       'Network Engineer',
    description: 'Routing/switching, protocols, security, troubleshooting methodologies',
    icon:        '🌐',
    accent:      'teal',
    tags:        ['Cisco', 'TCP/IP', 'BGP', 'VLANs'],
  },
  {
    role:        'GIS Analyst',
    label:       'GIS Analyst',
    description: 'Spatial analysis, ArcGIS/QGIS, coordinate systems, geodatabases',
    icon:        '🗺️',
    accent:      'green',
    tags:        ['ArcGIS', 'QGIS', 'SQL', 'Spatial'],
  },
  {
    role:        'Cybersecurity Analyst',
    label:       'Cybersecurity Analyst',
    description: 'Threat analysis, SIEM, incident response, vulnerability management',
    icon:        '🛡️',
    accent:      'red',
    tags:        ['SIEM', 'SOC', 'MITRE ATT&CK', 'IR'],
  },
  {
    role:        'DevOps / Platform Engineer',
    label:       'DevOps / Platform Eng',
    description: 'CI/CD, Kubernetes, infrastructure as code, cloud platforms',
    icon:        '🚀',
    accent:      'rose',
    tags:        ['K8s', 'Terraform', 'Docker', 'AWS'],
  },
  {
    role:        'Mobile Developer (React Native)',
    label:       'React Native Dev',
    description: 'Cross-platform mobile, navigation, native APIs, performance',
    icon:        '📱',
    accent:      'pink',
    tags:        ['React Native', 'Expo', 'iOS', 'Android'],
  },
  {
    role:        'Technical Product Manager',
    label:       'Technical PM',
    description: 'Product strategy, user stories, technical scoping, stakeholder management',
    icon:        '📋',
    accent:      'amber',
    tags:        ['Roadmap', 'Agile', 'Scrum', 'Strategy'],
  },
]
