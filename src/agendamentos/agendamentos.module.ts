import { Module } from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service.js';
import { AgendaLeituraService } from './agenda-leitura.service.js';
import { AgendamentosController } from './agendamentos.controller.js';
import { EmpresasModule } from '../empresas/empresas.module.js';

@Module({
  controllers: [AgendamentosController],
  providers: [AgendamentosService, AgendaLeituraService],
  imports: [EmpresasModule],
})
export class AgendamentosModule {}
