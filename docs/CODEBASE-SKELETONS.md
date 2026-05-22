## 12. Padrões de Referência (Skeletons)

Esqueletos canônicos por tipo de artefato. **Use copy-paste daqui em vez de `Read` em arquivos `src/` existentes.** Se necessidade não couber num destes skeletons, pare e avise usuário antes de prosseguir.

### Backend — NestJS module

```ts
// server/src/<feature>/<feature>.module.ts
import { Module } from '@nestjs/common';
import { <Feature>Controller } from './<feature>.controller';
import { <Feature>Service } from './<feature>.service';

@Module({
  controllers: [<Feature>Controller],
  providers: [<Feature>Service],
  exports: [<Feature>Service],
})
export class <Feature>Module {}
```

### Backend — Controller (JWT-guarded + Swagger PT-BR)

```ts
// server/src/<feature>/<feature>.controller.ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { <Feature>Service } from './<feature>.service';
import { Create<Feature>Dto } from './dto/create-<feature>.dto';
import { <Feature>ResponseDto } from './dto/<feature>-response.dto';

@ApiTags('<Feature PT-BR>')
@ApiBearerAuth('bearer')
@Controller('<feature-kebab>')
@UseGuards(JwtAuthGuard)
export class <Feature>Controller {
  constructor(private readonly service: <Feature>Service) {}

  @Post()
  @ApiOperation({ summary: 'Cria <feature>', description: '...' })
  @ApiResponse({ status: 201, type: <Feature>ResponseDto })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido.' })
  create(@Body() dto: Create<Feature>Dto) {
    return this.service.create(dto);
  }
}
```

**Rota pública (sem JWT):** decorar com `@SkipApiKey()` se também deve pular `ApiKeyGuard`; caso contrário enviar header `apikey`. Padrão exige JWT (`@UseGuards(JwtAuthGuard)`).

### Backend — Service (Prisma + Logger + ResponseDto)

```ts
// server/src/<feature>/<feature>.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Create<Feature>Dto } from './dto/create-<feature>.dto';
import { <Feature>ResponseDto } from './dto/<feature>-response.dto';

@Injectable()
export class <Feature>Service {
  private readonly logger = new Logger(<Feature>Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: Create<Feature>Dto): Promise<<Feature>ResponseDto> {
    const entity = await this.prisma.<model>.create({ data: dto });
    return this.toResponse(entity);
  }

  async findById(id: string): Promise<<Feature>ResponseDto> {
    const entity = await this.prisma.<model>.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`<Feature> ${id} não encontrado.`);
    return this.toResponse(entity);
  }

  private toResponse(entity: any): <Feature>ResponseDto {
    return { id: entity.id /* … */ };
  }
}
```

### Backend — DTO (class-validator + Swagger)

```ts
// server/src/<feature>/dto/create-<feature>.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create<Feature>Dto {
  @ApiProperty({ description: 'Nome do recurso', example: 'exemplo' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Id do usuário relacionado', example: 'uuid-v4' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
```

```ts
// server/src/<feature>/dto/<feature>-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class <Feature>ResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id!: string;
}
```

```ts
// server/src/<feature>/dto/update-<feature>.dto.ts
import { PartialType } from '@nestjs/swagger';
import { Create<Feature>Dto } from './create-<feature>.dto';
export class Update<Feature>Dto extends PartialType(Create<Feature>Dto) {}
```

### Backend — Rota pública / health (sem ApiKey, sem JWT, com checagem Postgres)

```ts
// server/src/health/health.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  constructor(private readonly prisma: PrismaService) {}
  async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

// server/src/health/health.controller.ts
import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipApiKey } from '../auth/decorators/skip-api-key.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @SkipApiKey()
  @ApiOperation({ summary: 'Healthcheck', description: 'Verifica se o serviço e o banco de dados estão operacionais.' })
  @ApiResponse({ status: 200, description: 'Serviço operacional.' })
  @ApiResponse({ status: 503, description: 'Banco de dados inacessível.' })
  async check() {
    try {
      await this.healthService.checkDatabase();
      return { status: 'ok' };
    } catch (err) {
      this.logger.error('Health check failed', err);
      throw new HttpException({ status: 'error' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

// server/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  // PrismaModule é @Global — não precisa importar aqui
})
export class HealthModule {}
```

### Frontend — Pinia store

```ts
// frontend/src/stores/<feature>.store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiFetch } from '../lib/apiFetch';
import type { <Feature> } from '../types';

export const use<Feature>Store = defineStore('<feature>', () => {
  const items = ref<<Feature>[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch('/<feature-kebab>');
      items.value = await res.json();
    } catch (e: any) {
      error.value = e?.message ?? 'Erro';
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, error, fetchAll };
});
```

### Frontend — Composable

```ts
// frontend/src/composables/use<Feature>.ts
import { onMounted, onBeforeUnmount, ref } from 'vue';

export function use<Feature>() {
  const state = ref<unknown>(null);

  onMounted(() => { /* setup */ });
  onBeforeUnmount(() => { /* teardown */ });

  return { state };
}
```

### Frontend — View (Vue 3 `<script setup>`)

```vue
<!-- frontend/src/views/<Feature>View.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { use<Feature>Store } from '../stores/<feature>.store';

const store = use<Feature>Store();
onMounted(() => store.fetchAll());
</script>

<template>
  <section class="container py-4" data-test="<feature>-view">
    <h1 class="h3 mb-3">Título</h1>
    <div v-if="store.loading" data-test="<feature>-loading">Carregando…</div>
    <div v-else-if="store.error" class="alert alert-danger" data-test="<feature>-error">
      {{ store.error }}
    </div>
    <ul v-else data-test="<feature>-list">
      <li v-for="item in store.items" :key="item.id">{{ item.name }}</li>
    </ul>
  </section>
</template>
```

### Frontend — Component reutilizável

```vue
<!-- frontend/src/components/<Name>.vue -->
<script setup lang="ts">
defineProps<{ label: string }>();
const emit = defineEmits<{ (e: 'clicked'): void }>();
</script>

<template>
  <button class="btn btn-primary" data-test="<name>-btn" @click="emit('clicked')">
    {{ label }}
  </button>
</template>
```

### Frontend — Rota (Vue Router 4, nomeada)

```ts
// frontend/src/router/index.ts (trecho)
{
  path: '/<feature-kebab>',
  name: '<feature>',
  component: () => import('../views/<Feature>View.vue'),
  meta: { requiresAuth: true /*, requiresRoot: true */ },
},
```

### k8s — Base Deployment + Service (NXX prefix)

```yaml
# k8s/base/3X-<name>-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <name>
spec:
  replicas: 1
  selector:
    matchLabels: { app: <name> }
  template:
    metadata:
      labels: { app: <name> }
    spec:
      containers:
        - name: <name>
          image: registry.example.com/<name>:base
          ports: [{ containerPort: 3000 }]
          envFrom: [{ configMapRef: { name: env-config } }]
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits:   { cpu: 250m, memory: 256Mi }
```

```yaml
# k8s/base/4X-<name>-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: <name>
spec:
  type: ClusterIP
  selector: { app: <name> }
  ports: [{ port: 3000, targetPort: 3000 }]
```

### k8s — Overlay deployment patch

```yaml
# k8s/overlays/<env>/<name>-deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <name>
spec:
  template:
    spec:
      containers:
        - name: <name>
          image: registry.example.com/<name>:<env-name-or-sha>
```

### Tests — backend unit (Jest + AC ref)

```ts
// server/src/<feature>/<feature>.service.spec.ts
import { Test } from '@nestjs/testing';
import { <Feature>Service } from './<feature>.service';
import { PrismaService } from '../prisma/prisma.service';

describe('<Feature>Service', () => {
  let service: <Feature>Service;
  const prisma = { <model>: { create: jest.fn(), findUnique: jest.fn() } } as any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [<Feature>Service, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(<Feature>Service);
  });

  it('AC-1: cria <feature>', async () => {
    prisma.<model>.create.mockResolvedValue({ id: 'x' });
    expect(await service.create({ name: 'a' } as any)).toEqual({ id: 'x' });
  });
});
```

### Tests — frontend component (Vitest + data-test)

```ts
// frontend/src/components/__tests__/<Name>.spec.ts
import { mount } from '@vue/test-utils';
import <Name> from '../<Name>.vue';

describe('<Name>', () => {
  it('AC-1: emite clicked ao apertar botão', async () => {
    const w = mount(<Name>, { props: { label: 'ok' } });
    await w.find('[data-test="<name>-btn"]').trigger('click');
    expect(w.emitted('clicked')).toBeTruthy();
  });
});
```

---

