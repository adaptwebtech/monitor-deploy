<script setup lang="ts">
import type { KpiStats } from "../types";

defineProps<{ stats: KpiStats }>();
</script>

<template>
  <div class="row g-3" data-test="kpi-cards">
    <div class="col-6 col-lg-3">
      <div class="card text-center h-100">
        <div class="card-body">
          <h6 class="card-title text-muted">Total</h6>
          <p class="display-6 fw-bold" data-test="kpi-total">
            {{ stats.total }}
          </p>
        </div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="card text-center h-100">
        <div class="card-body">
          <h6 class="card-title text-muted">Succeeded</h6>
          <p class="display-6 fw-bold text-success" data-test="kpi-succeeded">
            {{ stats.succeeded }}
          </p>
        </div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="card text-center h-100">
        <div class="card-body">
          <h6 class="card-title text-muted">Failed</h6>
          <p class="display-6 fw-bold text-danger" data-test="kpi-failed">
            {{ stats.failed }}
          </p>
        </div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="card text-center h-100">
        <div class="card-body">
          <h6 class="card-title text-muted">Taxa de Erro</h6>
          <p class="display-6 fw-bold text-warning" data-test="kpi-error-rate">
            {{ stats.errorRate }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
