import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL ?? 'postgresql://awtech:Str0ngP%40ss2024!@localhost:5432/monitor_deploy',
});
